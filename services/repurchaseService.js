const db = require("../config/db");

const REPURCHASE_INTERVAL_MONTHS = 2;
const REMINDER_LEAD_DAYS = 7; // popup starts this many days before due date

const LAST_SELF_PURCHASE_SQL = `
  SELECT mlm_source_user_id AS user_id, MAX(created_at) AS last_purchase_at
  FROM orders
  WHERE mlm_order_type = 'distributor_self_purchase'
    AND mlm_source_user_id IS NOT NULL
    AND payment_status = 'paid'
    AND order_status NOT IN ('cancelled', 'returned')
  GROUP BY mlm_source_user_id
`;

// Creates reminders for users whose 2-month window is ending/ended and closes
// those who have already repurchased. Idempotent.
async function scanRepurchaseDue() {
  const completed = await db.query(
    `UPDATE repurchase_reminders r
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       FROM (${LAST_SELF_PURCHASE_SQL}) lp
      WHERE r.user_id = lp.user_id
        AND r.status = 'pending'
        AND lp.last_purchase_at > r.last_purchase_at`,
  );

  const created = await db.query(
    `INSERT INTO repurchase_reminders (user_id, last_purchase_at, due_date)
     SELECT lp.user_id, lp.last_purchase_at,
            lp.last_purchase_at + INTERVAL '${REPURCHASE_INTERVAL_MONTHS} months'
       FROM (${LAST_SELF_PURCHASE_SQL}) lp
       JOIN users u ON u.id = lp.user_id AND u.is_active = TRUE
      WHERE lp.last_purchase_at + INTERVAL '${REPURCHASE_INTERVAL_MONTHS} months'
            <= CURRENT_TIMESTAMP + INTERVAL '${REMINDER_LEAD_DAYS} days'
     ON CONFLICT (user_id, last_purchase_at) DO NOTHING`,
  );

  return { completed: completed.rowCount, created: created.rowCount };
}

// Returns the reminder to show as dashboard popup, or null.
async function getActiveReminder(userId) {
  const { rows } = await db.query(
    `SELECT r.id, r.last_purchase_at, r.due_date,
            (r.due_date < CURRENT_TIMESTAMP) AS is_overdue,
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM (r.due_date - CURRENT_TIMESTAMP)) / 86400))::int AS days_left
       FROM repurchase_reminders r
      WHERE r.user_id = $1
        AND r.status = 'pending'
        AND (r.dismissed_until IS NULL OR r.dismissed_until <= CURRENT_TIMESTAMP)
        AND NOT EXISTS (
          SELECT 1 FROM orders o
           WHERE o.mlm_source_user_id = r.user_id
             AND o.mlm_order_type = 'distributor_self_purchase'
             AND o.payment_status = 'paid'
             AND o.order_status NOT IN ('cancelled', 'returned')
             AND o.created_at > r.last_purchase_at
        )
      ORDER BY r.due_date DESC
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

// "Remind me later": hides the popup for 24 hours.
async function dismissReminder(userId) {
  const { rowCount } = await db.query(
    `UPDATE repurchase_reminders
        SET dismissed_until = CURRENT_TIMESTAMP + INTERVAL '1 day'
      WHERE user_id = $1 AND status = 'pending'`,
    [userId],
  );
  return rowCount;
}

module.exports = { scanRepurchaseDue, getActiveReminder, dismissReminder };
