const MilestonDistribution = async (
  client,
  userId,
  currentPaidPairs, // इसे हम सिर्फ लॉगिंग के लिए रखेंगे
  newPairs,
  totalMatchingAmount,
) => {
  try {
    // 1. सबसे पहले यूजर का खुद का बाइनरी डेप्थ (nlevel) पता करें
    const userDepthRes = await client.query(
      `SELECT nlevel(binary_path) as depth FROM users WHERE id = $1`,
      [userId],
    );
    if (userDepthRes.rows.length === 0) return;
    const userBaseDepth = userDepthRes.rows[0].depth;

    // 2. वह माइलस्टोन ढूंढें जो इस यूजर को अभी तक नहीं मिला है
    const milestoneQuery = await client.query(
      `SELECT m.id, m.milestone_name, m.reward_cash, m.cash_com, lc.team_size_threshold AS team_size, lc.level_no
       FROM level_milestones m
       JOIN mlm_generation_commissions lc ON m.level_id = lc.id
       WHERE NOT EXISTS (
         SELECT 1 FROM transactions 
         WHERE user_id = $1 
         AND category = 'milestone' 
         AND remarks LIKE '%' || m.milestone_name || '%'
       )
       ORDER BY lc.level_no ASC LIMIT 1`, // सबसे छोटे अनपेड लेवल से शुरू करें (क्रमशः)
      [userId],
    );

    if (milestoneQuery.rows.length === 0) {
      console.log(
        `[Milestone] All milestones already paid for User ${userId}.`,
      );
      return;
    }

    const milestone = milestoneQuery.rows[0];
    const targetLevelNo = milestone.level_no; // जैसे FAD के लिए level_no = 2 या 3 जो भी टेबल में हो
    const requiredPairsForThisLevel = parseInt(milestone.team_size) / 2; // उस लेयर को पूरा करने के लिए जरूरी पेयर्स (e.g., 4 या 8)

    // 3. 🔥 MAGIC HAPPENS HERE: pair_matches टेबल से चेक करें कि इस विशिष्ट
    // relative level (pair_level) पर यूजर के नीचे वास्तव में कितने पेयर्स कम्प्लीट हो चुके हैं
    const actualLayerPairsQuery = await client.query(
      `SELECT COUNT(id) as completed_pairs_in_layer 
       FROM pair_matches 
       WHERE upline_id = $1 AND pair_level = $2`,
      [userId, targetLevelNo],
    );

    const completedPairsInLayer =
      parseInt(actualLayerPairsQuery.rows[0].completed_pairs_in_layer) || 0;

    console.log(
      `[Milestone Layer Check] User: ${userId} | Milestone: ${milestone.milestone_name} | Layer (Level): ${targetLevelNo} | Pairs Formed in this Layer: ${completedPairsInLayer}/${requiredPairsForThisLevel}`,
    );

    // STRICT LAYER COMPLETION CHECK: जब तक उस लेयर के सारे पेयर (जैसे 8 के 8) एक्टिव होकर
    // पेयर मैच नहीं बना लेते, तब तक माइलस्टोन ब्लॉक रहेगा।
    if (completedPairsInLayer < requiredPairsForThisLevel) {
      console.log(
        `[Milestone Blocked] Layer ${targetLevelNo} is not fully complete yet. Waiting for all members in this row to pair up.`,
      );
      return;
    }

    // 4. अगर लेयर 100% कम्प्लीट हो गई है, तो उस लेयर के सभी पेयर्स का अमाउंट SUM करें
    console.log(
      `🎉 CONGRATULATIONS! Layer ${targetLevelNo} is 100% complete. Releasing ${milestone.milestone_name}...`,
    );

    const accumulatedAmountQuery = await client.query(
      `SELECT SUM(total_matching_amount) as total_layer_volume
       FROM pair_matches 
       WHERE upline_id = $1 AND pair_level = $2`,
      [userId, targetLevelNo],
    );

    let totalLayerVolume =
      parseFloat(accumulatedAmountQuery.rows[0].total_layer_volume) || 0;
    if (totalLayerVolume === 0) {
      totalLayerVolume = totalMatchingAmount;
    }

    const rewardPercent = parseFloat(milestone.reward_cash) || 0;
    const cashComPercent = parseFloat(milestone.cash_com) || 0;

    const rewardAmount = totalLayerVolume * (rewardPercent / 100);
    const cashCommissionAmount = totalLayerVolume * (cashComPercent / 100);

    if (rewardAmount > 0 || cashCommissionAmount > 0) {
      // Wallet अपडेट
      await client.query(
        `UPDATE wallets
         SET company_fund = company_fund + $1,
             total_amount = total_amount + $3
         WHERE user_id = $2`,
        [rewardAmount, userId, cashCommissionAmount],
      );

      // 3a) Milestone reward transaction
      await client.query(
        `INSERT INTO transactions (user_id, amount, type, category, status, remarks)
         VALUES ($1, $2, 'credit', 'milestone', 'completed', $3)`,
        [
          userId,
          rewardAmount,
          `Milestone Layer Completed: ${milestone.milestone_name} (Level ${targetLevelNo} Full Row Active) | Total Volume: ${totalLayerVolume} | reward_cash=${rewardPercent}%`,
        ],
      );

      // 3b) Cash commission transaction
      if (cashCommissionAmount > 0) {
        await client.query(
          `INSERT INTO transactions (user_id, amount, type, category, status, remarks)
           VALUES ($1, $2, 'credit', 'commission', 'completed', $3)`,
          [
            userId,
            cashCommissionAmount,
            `Milestone Layer Upgrade Commission: ${milestone.milestone_name} (Level ${targetLevelNo}) | Total Volume: ${totalLayerVolume} | cash_com=${cashComPercent}%`,
          ],
        );
      }

      console.log(
        `🎉 SUCCESS: Milestone ${milestone.milestone_name} distributed for complete layer!`,
      );
    }
  } catch (error) {
    console.error("Milestone Distribution Error:", error);
  }
};

module.exports = MilestonDistribution;
