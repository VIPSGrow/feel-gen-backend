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

// Creates pending upline (direct partner + generation) commission events/transactions
// directly at order time, independent of the self-commission rate/amount.
const distributeParentChainCommission = async (
  client,
  { sourceUserId, orderId, baseAmount, mlmOrderType = "distributor_self_purchase" },
) => {
  const activePlan = (
    await client.query(
      `SELECT id, max_generation_level, holding_period_minutes, direct_partner_commission_percent
       FROM mlm_plan_settings
       WHERE is_active = TRUE AND effective_from <= CURRENT_TIMESTAMP
         AND (effective_to IS NULL OR effective_to > CURRENT_TIMESTAMP)
       ORDER BY effective_from DESC
       LIMIT 1`,
    )
  ).rows[0];

  if (!activePlan) return { inserted: 0 };

  const alreadyLinked = await client.query(
    `SELECT 1 FROM mlm_commission_events
     WHERE order_id = $1
       AND source_user_id = $2
       AND is_self_commission = FALSE
       AND commission_type IN ('direct_partner', 'generation')
     LIMIT 1`,
    [orderId, sourceUserId],
  );
  if (alreadyLinked.rows.length > 0) return { inserted: 0 };

  const maxGen = Number(activePlan.max_generation_level || 7);
  const holdingMin = Number(activePlan.holding_period_minutes ?? HOLDING_MIN_FALLBACK);
  const isPending = holdingMin > 0;

  const uplineRes = await client.query(
    `WITH RECURSIVE upline AS (
       SELECT
         $1::INTEGER AS user_id,
         u.referrer_id,
         -1::INTEGER AS generation
       FROM users u WHERE u.id = $1
       UNION ALL
       SELECT
         r.id AS user_id,
         r.referrer_id,
         up.generation + 1 AS generation
       FROM upline up
       JOIN users r ON r.id = up.referrer_id
       WHERE up.generation + 1 < $2
     )
     SELECT DISTINCT user_id AS beneficiary_user_id, generation
     FROM upline
     WHERE generation >= 0 AND generation < $2
     ORDER BY generation ASC`,
    [sourceUserId, maxGen],
  );

  if (uplineRes.rows.length === 0) return { inserted: 0 };

  const genCfgRows = await client.query(
    `SELECT level_no, commission_percent
     FROM mlm_generation_commissions
     WHERE plan_settings_id = $1
     ORDER BY level_no ASC`,
    [activePlan.id],
  );
  const levelRates = new Map();
  for (const r of genCfgRows.rows) {
    levelRates.set(Number(r.level_no), Number(r.commission_percent));
  }

  const directPartnerRate = Number(activePlan.direct_partner_commission_percent || 0);

  let inserted = 0;

  for (const sponsor of uplineRes.rows) {
    const generation = Number(sponsor.generation);
    const rate = generation === 0 ? directPartnerRate : levelRates.get(generation) || 0;
    if (rate <= 0) continue;

    const commissionAmount = Number((baseAmount * rate / 100).toFixed(2));
    if (commissionAmount <= 0) continue;

    await ensureWalletFor(client, sponsor.beneficiary_user_id);

    const eventRes = await client.query(
      `INSERT INTO mlm_commission_events (
         order_id, user_package_id, source_user_id, beneficiary_user_id,
         commission_type, generation_level, base_amount, commission_percent,
         commission_amount, plan_settings_id, status,
         mlm_order_type, is_self_commission, parent_chain_stage
       ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE, $12)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        orderId,
        sourceUserId,
        sponsor.beneficiary_user_id,
        generation === 0 ? "direct_partner" : "generation",
        generation,
        baseAmount,
        rate,
        commissionAmount,
        activePlan.id,
        isPending ? "pending" : "completed",
        mlmOrderType,
        "unilevel",
      ],
    );

    if (eventRes.rowCount === 0) continue;
    const mceId = eventRes.rows[0].id;

    const txn = await client.query(
      `INSERT INTO transactions (
         user_id, amount, type, category, source_user_id, order_id,
         status, remarks, user_package_id
       ) VALUES ($1, $2, 'credit', $3, $4, $5, $6, $7, NULL)
       RETURNING id`,
      [
        sponsor.beneficiary_user_id,
        commissionAmount,
        generation === 0 ? "commission" : "commission_level",
        sourceUserId,
        orderId,
        isPending ? "pending" : "completed",
        generation === 0
          ? `Direct partner commission (${rate}%) from user ${sourceUserId} order`
          : `Generation Level ${generation} (${rate}%) from user ${sourceUserId} order`,
      ],
    );
    const txnId = txn.rows[0].id;

    await client.query(
      `UPDATE mlm_commission_events SET transaction_id = $1 WHERE id = $2`,
      [txnId, mceId],
    );

    const walletColumn = isPending ? "pending_amount" : "total_amount";
    const withdrawableIncrement = isPending ? 0 : commissionAmount;
    await client.query(
      `UPDATE wallets
       SET ${walletColumn} = COALESCE(${walletColumn}, 0) + $1,
           withdrawable_amount = COALESCE(withdrawable_amount, 0) + $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [commissionAmount, sponsor.beneficiary_user_id, withdrawableIncrement],
    );

    inserted++;
  }

  return { inserted };
};

module.exports = distributeParentChainCommission;
