const cron = require("node-cron");
const db = require("../config/db");

function getLastDayRangeUTC() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  // Settles the month that just ended (cron runs on the 1st at 00:05 UTC).
  const toExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const from = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0));

  return { from, toExclusive, prevYear, prevMonth };
}

const TAXABLE_CATEGORIES = [
  "commission",
  "commission_self",
  "commission_level",
  "rank_reward",
];

async function getTdsPercent(client) {
  const res = await client.query(
    "SELECT setting_value FROM app_settings WHERE setting_key = 'tax_config' LIMIT 1",
  );
  const row = res.rows[0];
  if (!row?.setting_value) {
    throw new Error("TDS configuration is missing from app_settings.tax_config");
  }

  const tdsPercent = Number(row.setting_value?.tds_percent);
  if (!Number.isFinite(tdsPercent) || tdsPercent < 0 || tdsPercent > 100) {
    throw new Error("Invalid tds_percent in app_settings.tax_config");
  }

  return tdsPercent;
}

/**
 * Monthly settlement:
 * - Released commission accumulates in wallets.total_amount.
 * - For the settled month, gross commission moves out of total_amount and
 *   (gross - TDS) is added to wallets.withdrawable_amount.
 * - TDS is recorded as a 'withdraw' debit transaction with remarks 'TDS Deduction_<cycle>'.
 */
async function processMonthlyTds() {
  console.log("\n Process Start .....");

  const client = await db.connect();
  try {
    const { from, toExclusive, prevYear, prevMonth } = getLastDayRangeUTC();

    console.log("\n ", from, toExclusive, prevYear, prevMonth);

    // Idempotency: store the processed month marker with the deductions.
    await client.query(
      `
      CREATE TABLE IF NOT EXISTS monthly_tds_cycles (
        cycle_key text PRIMARY KEY,
        from_date timestamptz NOT NULL,
        to_date_exclusive timestamptz NOT NULL,
        processed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    );

    console.log("\ntable created...");

    const cycleKey = `
      ${prevYear}-${String(prevMonth + 1).padStart(2, "0")}
    `.trim();

    await client.query("BEGIN");

    // Claim the cycle first: concurrent/duplicate runs get no row and exit,
    // and a failure rolls the claim back together with all wallet changes.
    const claim = await client.query(
      "INSERT INTO monthly_tds_cycles (cycle_key, from_date, to_date_exclusive) VALUES ($1,$2,$3) ON CONFLICT (cycle_key) DO NOTHING RETURNING cycle_key",
      [cycleKey, from.toISOString(), toExclusive.toISOString()],
    );
    if (!claim.rows.length) {
      await client.query("ROLLBACK");
      console.log(`[monthlyTdsCron] Cycle already processed: ${cycleKey}`);
      return;
    }

    console.log("\nFetching TDS Percentage...");

    const tdsPercent = await getTdsPercent(client);

    // Taxable income = completed credit transactions of these categories:
    //   commission (direct/initiator/milestone), commission_self,
    //   commission_level (generation), rank_reward.
    const commissionsByUser = await client.query(
      `
      SELECT
        t.user_id,
        COALESCE(SUM(t.amount), 0)::numeric(18,2) AS commission_total
      FROM transactions t
      WHERE t.type = 'credit'
        AND t.category = ANY($3::text[])
        AND COALESCE(t.completed_at, t.created_at) >= $1
        AND COALESCE(t.completed_at, t.created_at) < $2
        AND t.status = 'completed'
      GROUP BY t.user_id
      HAVING COALESCE(SUM(t.amount), 0) > 0
      `,
      [from.toISOString(), toExclusive.toISOString(), TAXABLE_CATEGORIES],
    );

    console.log(
      "\nCommission byders ...",
      from.toISOString(),
      toExclusive.toISOString(),
      commissionsByUser.rows,
    );

    for (const row of commissionsByUser.rows) {
      const userId = row.user_id;
      const commissionTotal = Number(row.commission_total);
      if (!commissionTotal || commissionTotal <= 0) continue;

      const tdsAmount = Number(
        (commissionTotal * (tdsPercent / 100)).toFixed(2),
      );

      // Strategy:
      // Move wallet to withdrawable by ensuring total_amount is decreased by TDS for this month’s eligible commission.
      // We implement by debiting wallets.total_amount by tdsAmount and creating TDS transaction records.
      //
      // This assumes the eligible commission is already present in wallets.total_amount.
      // If instead it goes to pending_amount, we will change logic.

      console.log(`\nTDS Amount... =  ${tdsAmount} `);

      const netAmount = Number((commissionTotal - tdsAmount).toFixed(2));

      // Month's commission leaves total_amount and becomes withdrawable after TDS.
      const walletUpd = await client.query(
        `UPDATE wallets
         SET total_amount = GREATEST(0, COALESCE(total_amount, 0) - $1),
             withdrawable_amount = COALESCE(withdrawable_amount, 0) + $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3`,
        [commissionTotal, netAmount, userId],
      );
      if (walletUpd.rowCount === 0) {
        throw new Error(`Wallet not found for user ${userId} during monthly settlement`);
      }

      if (tdsAmount > 0) {
        console.log(`\nWallet Updated... transaction inserting `);
        // Audit transaction: TDS Deduction
        const tdsTxnRes = await client.query(
          `
          INSERT INTO transactions (user_id, amount, type, category, remarks, status)
          VALUES ($1, $2, 'debit', 'withdraw', $3, 'completed')
          RETURNING id
          `,
          [userId, tdsAmount, `TDS Deduction_${cycleKey}`],
        );

        // Commission invoice/bill record is not defined in current codebase.
        // If you already have an invoice table, we can insert rows here.
        void tdsTxnRes;
      }

      console.log(
        `[monthlyTdsCron] user=${userId} commission=${commissionTotal} tds=${tdsAmount}`,
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }
    console.error("[monthlyTdsCron] error:", err);
  } finally {
    client.release();
  }
}

// Runs on the 1st of every month at 00:05 UTC and deducts TDS for the month that just ended.
cron.schedule("5 0 1 * *", async () => {
  console.log(`[monthlyTdsCron] running at ${new Date().toISOString()}`);
  await processMonthlyTds();
}, { timezone: "UTC" });

console.log("[monthlyTdsCron] scheduled: 1st of every month 00:05 UTC (settles previous month).");

module.exports = { processMonthlyTds };