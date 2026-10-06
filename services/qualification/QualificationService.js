const db = require("../../config/db");

const CYCLE_DAYS = 28;
const REQUIRED_UNIQUE_BUYERS = 10;

/**
 * SQL select-expression (alias `u` = users) giving the same shape as getStatus(),
 * for embedding in list/tree queries without N+1 queries.
 */
const QUALIFICATION_SELECT_SQL = `
  jsonb_build_object(
    'is_qualified', u.is_qualified,
    'qualification_cycle_start', u.qualification_cycle_start,
    'qualification_cycle_end', u.qualification_cycle_start + (${CYCLE_DAYS} * INTERVAL '1 day'),
    'downline_purchased_count', (
      SELECT COUNT(*)::int FROM qualification_cycle_purchases qp
      WHERE qp.upline_id = u.id AND qp.cycle_start = u.qualification_cycle_start
    ),
    'required_count', ${REQUIRED_UNIQUE_BUYERS},
    'days_remaining', GREATEST(0, CEIL(EXTRACT(EPOCH FROM
      (u.qualification_cycle_start + (${CYCLE_DAYS} * INTERVAL '1 day') - CURRENT_TIMESTAMP)) / 86400))::int
  ) AS qualification`;
/**
 * Records a completed purchase for the buyer's direct upline (referrer).
 * Idempotent: a buyer counts once per upline per cycle, so repeated orders or
 * webhook retries do not inflate the count.
 * Pass `client` to run inside the caller's transaction (uses a savepoint),
 * or null to use its own transaction. Never throws, so order flows are not broken.
 */
async function recordPurchase(client, { buyerId, orderId = null, purchasedAt = null }) {
  if (!buyerId) return { counted: false, reason: "no_buyer" };

  const ownTx = !client;
  const c = client || (await db.connect());
  const done = async () =>
    ownTx ? c.query("COMMIT") : c.query("RELEASE SAVEPOINT qualification_sp");

  try {
    if (ownTx) await c.query("BEGIN");
    else await c.query("SAVEPOINT qualification_sp");

    try {
      const buyer = await c.query(`SELECT referrer_id FROM users WHERE id = $1`, [buyerId]);
      const uplineId = buyer.rows[0]?.referrer_id;
      if (!uplineId || Number(uplineId) === Number(buyerId)) {
        await done();
        return { counted: false, reason: "no_upline" };
      }

      // Row lock serializes concurrent purchases for the same upline.
      const up = await c.query(
        `SELECT qualification_cycle_start::text AS cycle_start FROM users WHERE id = $1 FOR UPDATE`,
        [uplineId],
      );
      if (!up.rows.length) {
        await done();
        return { counted: false, reason: "upline_missing" };
      }
      // Kept as text to preserve microsecond precision (JS Date truncates to ms).
      const cycleStart = up.rows[0].cycle_start;

      const ins = await c.query(
        `INSERT INTO qualification_cycle_purchases (upline_id, buyer_id, order_id, cycle_start)
         SELECT $1::int, $2::int, $3::int, $4::timestamptz
         WHERE COALESCE($5::timestamptz, CURRENT_TIMESTAMP) >= $4::timestamptz
           AND COALESCE($5::timestamptz, CURRENT_TIMESTAMP)
               < $4::timestamptz + ($6::int * INTERVAL '1 day')
         ON CONFLICT (upline_id, buyer_id, cycle_start) DO NOTHING
         RETURNING id`,
        [uplineId, buyerId, orderId, cycleStart, purchasedAt, CYCLE_DAYS],
      );

      let state = {};
      if (ins.rowCount > 0) {
        const upd = await c.query(
          `WITH cnt AS (
             SELECT COUNT(*)::int AS n FROM qualification_cycle_purchases
             WHERE upline_id = $1::int AND cycle_start = $2::timestamptz
           )
           UPDATE users
           SET downline_purchased_count = cnt.n,
               is_qualified = (cnt.n >= $3::int)
           FROM cnt
           WHERE users.id = $1::int
           RETURNING users.downline_purchased_count, users.is_qualified`,
          [uplineId, cycleStart, REQUIRED_UNIQUE_BUYERS],
        );
        state = upd.rows[0] || {};
      }

      await done();
      return { counted: ins.rowCount > 0, uplineId, ...state };
    } catch (err) {
      if (ownTx) await c.query("ROLLBACK");
      else await c.query("ROLLBACK TO SAVEPOINT qualification_sp");
      throw err;
    }
  } catch (err) {
    console.error("[qualification] recordPurchase failed:", err.message);
    return { counted: false, reason: "error" };
  } finally {
    if (ownTx) c.release();
  }
}

/** For webhooks: resolve the buyer from the orders.order_id reference string. */
async function recordPurchaseForOrderRef(orderRef) {
  try {
    const r = await db.query(
      `SELECT id, COALESCE(user_id, mlm_source_user_id, distributor_id) AS buyer_id
       FROM orders WHERE order_id = $1`,
      [orderRef],
    );
    if (!r.rows.length) return { counted: false, reason: "order_not_found" };
    return recordPurchase(null, { buyerId: r.rows[0].buyer_id, orderId: r.rows[0].id });
  } catch (err) {
    console.error("[qualification] recordPurchaseForOrderRef failed:", err.message);
    return { counted: false, reason: "error" };
  }
}

async function getStatus(userId, client = db) {
  const r = await client.query(
    `SELECT u.is_qualified, u.qualification_cycle_start,
            (SELECT COUNT(*)::int FROM qualification_cycle_purchases p
              WHERE p.upline_id = u.id AND p.cycle_start = u.qualification_cycle_start) AS cnt,
            u.qualification_cycle_start + ($2::int * INTERVAL '1 day') AS cycle_end,
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM
              (u.qualification_cycle_start + ($2::int * INTERVAL '1 day') - CURRENT_TIMESTAMP)) / 86400))::int
              AS days_remaining
     FROM users u WHERE u.id = $1`,
    [userId, CYCLE_DAYS],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    is_qualified: row.is_qualified,
    qualification_cycle_start: row.qualification_cycle_start,
    qualification_cycle_end: row.cycle_end,
    downline_purchased_count: row.cnt,
    required_count: REQUIRED_UNIQUE_BUYERS,
    progress_text: `${row.cnt}/${REQUIRED_UNIQUE_BUYERS} completed`,
    days_remaining: row.days_remaining,
  };
}

/** Starts a fresh cycle (advancing in 28-day steps, no drift) for expired users. */
async function resetExpiredCycles() {
  const r = await db.query(
    `UPDATE users
     SET is_qualified = FALSE,
         downline_purchased_count = 0,
         qualification_cycle_start = qualification_cycle_start
           + (FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - qualification_cycle_start))
                    / (86400 * $1::int))::int * $1::int) * INTERVAL '1 day'
     WHERE qualification_cycle_start + ($1::int * INTERVAL '1 day') <= CURRENT_TIMESTAMP`,
    [CYCLE_DAYS],
  );
  return r.rowCount;
}

module.exports = {
  CYCLE_DAYS,
  REQUIRED_UNIQUE_BUYERS,
  QUALIFICATION_SELECT_SQL,
  recordPurchase,
  recordPurchaseForOrderRef,
  getStatus,
  resetExpiredCycles,
};
