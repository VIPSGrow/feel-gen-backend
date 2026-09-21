const cron = require("node-cron");
const db = require("../config/db");

const HOLDING_MIN_FALLBACK = 5;

async function ensureWalletFor(client, userId) {
  await client.query(
    `INSERT INTO wallets (
      user_id, total_amount, pending_amount,
      left_count, right_count, paid_pairs, company_fund, withdrawable_amount
    ) VALUES ($1, 0, 0, 0, 0, 0, 0, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

async function releasePendingCommissions(client) {
  const released = await client.query(
    `UPDATE mlm_commission_events AS mce
     SET status = 'completed'
     FROM transactions AS t
     CROSS JOIN mlm_plan_settings AS plan
     WHERE mce.transaction_id = t.id
       AND plan.id = mce.plan_settings_id
       AND mce.status = 'pending'
       AND t.status = 'pending'
       AND t.created_at
           + (INTERVAL '1 minute' * COALESCE(plan.holding_period_minutes, $1))
           <= CURRENT_TIMESTAMP
     RETURNING
       mce.id,
       mce.beneficiary_user_id,
       mce.commission_amount,
       mce.transaction_id,
       mce.is_self_commission,
       mce.order_id,
       mce.source_user_id,
       mce.base_amount,
       mce.mlm_order_type,
       mce.plan_settings_id,
       t.created_at AS txn_created_at`,
    [HOLDING_MIN_FALLBACK],
  );

  const planIdFromEvent =
    released.rows.length > 0 ? released.rows[0].plan_settings_id : null;

  const selfReleaseCandidates = [];

  for (const event of released.rows) {
    await client.query(
      `UPDATE transactions
       SET status = 'completed'
       WHERE id = $1 AND status = 'pending'`,
      [event.transaction_id],
    );

    await ensureWalletFor(client, event.beneficiary_user_id);

    await client.query(
      `UPDATE wallets
       SET total_amount = COALESCE(total_amount, 0) + $1,
           pending_amount = GREATEST(0, COALESCE(pending_amount, 0) - $1),
           withdrawable_amount = COALESCE(withdrawable_amount, 0) + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [event.commission_amount, event.beneficiary_user_id],
    );

    if (event.is_self_commission && event.order_id && event.source_user_id) {
      selfReleaseCandidates.push(event);

      // Activate user if this is their first qualifying order (self commission release)
      const existingQualifying = await client.query(
        `SELECT COUNT(*) as cnt FROM orders
         WHERE mlm_source_user_id = $1 AND mlm_eligible = TRUE
           AND order_status IN ('confirmed', 'completed', 'delivered')
           AND id <> $2`,
        [event.source_user_id, event.order_id],
      );
      if (Number(existingQualifying.rows[0].cnt) === 0) {
        await client.query(`UPDATE users SET is_active = TRUE WHERE id = $1`, [event.source_user_id]);
      }
    }
  }

  return {
    totalReleased: released.rowCount,
    selfEvents: selfReleaseCandidates,
    planSettingsId: planIdFromEvent,
  };
}

async function releaseHeldCommissions() {
  console.log(" ----- [5-Min Pending Release] Cron Job Started -----");

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const step1 = await releasePendingCommissions(client);

    await client.query("COMMIT");

    console.log(
      `[Cron] Step1: Released ${step1.totalReleased} pending commissions` +
        (step1.selfEvents.length > 0
          ? ` (${step1.selfEvents.length} self releases)`
          : ""),
    );
    console.log(
      `[Cron] Next run in 1 minute.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Pending commission cron critical error: ", error);
  } finally {
    client.release();
    console.log(" ----- [5-Min Pending Release] Cron Job Finished -----");
  }
}

cron.schedule("* * * * *", releaseHeldCommissions);

console.log("\n\n ====== Hold release cron scheduled (every min) ====== ");
