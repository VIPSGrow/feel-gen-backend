const SelfCommission = async (client, userId, body) => {
  try {
    const { amount, razorpay_order_id, order_id, orderDbId } = body;

    const commConfigOWN = await client.query(
      `SELECT commission_percentage FROM level_commissions WHERE level_no = 0`,
    );
    const ownRate = Number(commConfigOWN.rows[0]?.commission_percentage || 0);
    const ownCommission = Number((amount * ownRate / 100).toFixed(2));

    if (ownCommission > 0) {
      const planRes = await client.query(
        `SELECT id FROM mlm_plan_settings WHERE is_active = TRUE ORDER BY effective_from DESC LIMIT 1`,
      );
      const planId = planRes.rows[0]?.id;

      const selfTxn = await client.query(
        `INSERT INTO transactions (user_id, amount, type, category, source_user_id, order_id, status, remarks, user_package_id)
         VALUES ($1, $2, 'credit', 'commission_self', $1, $3, 'pending', $4, NULL)
         RETURNING id`,
        [userId, ownCommission, orderDbId, `Self purchase cashback (${ownRate}%) on order ${order_id}`],
      );
      const selfTxnId = selfTxn.rows[0].id;

      await client.query(
        `INSERT INTO mlm_commission_events
          (order_id, user_package_id, source_user_id, beneficiary_user_id,
           commission_type, generation_level, base_amount, commission_percent,
           commission_amount, plan_settings_id, status, transaction_id,
           mlm_order_type, is_self_commission)
         VALUES ($1, NULL, $2, $3, 'self_cashback', 0, $4, $5, $6,
                 $7, 'pending', $8, 'distributor_self_purchase', TRUE)`,
        [orderDbId, userId, userId, amount, ownRate, ownCommission, planId, selfTxnId],
      );

      await client.query(
        `UPDATE wallets
         SET pending_amount = COALESCE(pending_amount, 0) + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [ownCommission, userId],
      );
    }

    // Activation depends on placing a qualifying order, not on the self-commission rate.
    const existingQualifying = await client.query(
      `SELECT COUNT(*) as cnt FROM orders
       WHERE mlm_source_user_id = $1 AND mlm_eligible = TRUE
         AND order_status IN ('confirmed', 'completed', 'delivered')
         AND id <> COALESCE($2, 0)`,
      [userId, orderDbId],
    );
    if (Number(existingQualifying.rows[0].cnt) === 0) {
      await client.query(`UPDATE users SET is_active = TRUE WHERE id = $1`, [userId]);
    }

    return { status: true, commission: ownCommission, rate: ownRate };
  } catch (err) {
    console.log("Self Commission Error log - ", err);
    return { status: false, message: err.message };
  }
};

module.exports = SelfCommission;
