const InitiatorCommission = async (client, userId, body) => {
  try {
    const { amount } = body;

    const commissionAmount = amount * (3 / 100);

    // 1. Fetch the initiator_user_id for the given userId
    const initiatorQuery = `
      SELECT initiator_user_id 
      FROM users 
      WHERE id = $1
    `;
    const initiatorRes = await client.query(initiatorQuery, [userId]);

    if (initiatorRes.rows.length === 0) {
      console.log(
        `[InitiatorCommission] No initiator found for user ID ${userId}. Skipping commission distribution.`,
      );
      return;
    }

    const initiatorUserId = initiatorRes.rows[0].initiator_user_id;

    // 2. Update the initiator's wallet with the commission amount
    const txnRemarks = `Direct Join Com : 3%`;

    await client.query(
      `INSERT INTO transactions (user_id, amount, type, category, source_user_id, status, remarks)
               VALUES ($1, $2, 'credit', 'commission', $3, 'completed', $4)`,
      [initiatorUserId, commissionAmount, userId, txnRemarks],
    );

    const updateWalletQuery = `
      UPDATE wallets 
      SET 
        total_amount = total_amount + $1,        
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
      RETURNING user_id, total_amount, pending_amount
    `;
    const walletRes = await client.query(updateWalletQuery, [
      commissionAmount,
      initiatorUserId,
    ]);

    if (walletRes.rows.length === 0) {
      console.log(
        `[InitiatorCommission] No wallet found for initiator user ID ${initiatorUserId}. Skipping commission distribution.`,
      );
      return;
    }

    console.log(
      `[InitiatorCommission] Commission of ${amount} distributed to initiator user ID ${initiatorUserId}. Updated wallet:`,
      walletRes.rows[0],
    );
  } catch (err) {
    console.log("[LevelCommissionDistribution] ERROR", err);
    throw err;
  }
};
module.exports = InitiatorCommission;
