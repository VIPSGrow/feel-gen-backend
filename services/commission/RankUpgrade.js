// Evaluates a user's downline team size against the active plan's mlm_ranks
// thresholds and upgrades users.current_rank_id when a higher rank is reached,
// granting any mlm_rank_rewards tied to each newly crossed rank.
const evaluateAndUpgradeRank = async (client, userId) => {
  const userRes = await client.query(
    `SELECT id, node_path, current_rank_id FROM users WHERE id = $1`,
    [userId],
  );
  const user = userRes.rows[0];
  if (!user || !user.node_path) return { upgraded: false };

  const planRes = await client.query(
    `SELECT id FROM mlm_plan_settings
     WHERE is_active = TRUE
       AND effective_from <= CURRENT_TIMESTAMP
       AND (effective_to IS NULL OR effective_to > CURRENT_TIMESTAMP)
     ORDER BY effective_from DESC
     LIMIT 1`,
  );
  const plan = planRes.rows[0];
  if (!plan) return { upgraded: false };

  const teamSizeRes = await client.query(
    `SELECT COUNT(*)::int AS team_size
     FROM users sub
     WHERE sub.node_path <@ $1::ltree AND sub.id != $2`,
    [user.node_path, userId],
  );
  const teamSize = teamSizeRes.rows[0].team_size;

  const ranksRes = await client.query(
    `SELECT id, rank_no, rank_name, milestone_threshold
     FROM mlm_ranks
     WHERE plan_settings_id = $1 AND is_active = TRUE AND threshold_type = 'team_size'
     ORDER BY rank_no ASC`,
    [plan.id],
  );
  const ranks = ranksRes.rows;
  if (ranks.length === 0) return { upgraded: false };

  const currentRankNo = user.current_rank_id
    ? Number(
        (await client.query(`SELECT rank_no FROM mlm_ranks WHERE id = $1`, [
          user.current_rank_id,
        ])).rows[0]?.rank_no ?? -1,
      )
    : -1;

  const eligibleRanks = ranks.filter(
    (r) => teamSize >= Number(r.milestone_threshold) && Number(r.rank_no) > currentRankNo,
  );
  if (eligibleRanks.length === 0) return { upgraded: false };

  eligibleRanks.sort((a, b) => Number(a.rank_no) - Number(b.rank_no));
  const grantedRanks = [];

  for (const rank of eligibleRanks) {
    const rewardsRes = await client.query(
      `SELECT * FROM mlm_rank_rewards WHERE rank_id = $1`,
      [rank.id],
    );

    for (const reward of rewardsRes.rows) {
      const isCash = ["cash", "commission", "bonus"].includes(
        String(reward.reward_type || "").toLowerCase(),
      );
      const rewardAmount = Number(reward.reward_value || 0);

      if (isCash && rewardAmount > 0) {
        await client.query(
          `INSERT INTO wallets (
            user_id, total_amount, pending_amount,
            left_count, right_count, paid_pairs, company_fund, withdrawable_amount
          ) VALUES ($1, 0, 0, 0, 0, 0, 0, 0)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId],
        );

        const txn = await client.query(
          `INSERT INTO transactions (user_id, amount, type, category, status, remarks)
           VALUES ($1, $2, 'credit', 'rank_reward', 'completed', $3)
           RETURNING id`,
          [
            userId,
            rewardAmount,
            `Rank reward for reaching ${rank.rank_name}: ${reward.reward_description || reward.reward_type}`,
          ],
        );

        await client.query(
          `UPDATE wallets
           SET total_amount = COALESCE(total_amount, 0) + $1,
               withdrawable_amount = COALESCE(withdrawable_amount, 0) + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [rewardAmount, userId],
        );

        void txn;
      } else {
        await client.query(
          `INSERT INTO notifications (title, message, display_type, target_role, target_id)
           VALUES ($1, $2, 'reward', 'user', $3)`,
          [
            `Rank Reward: ${rank.rank_name}`,
            reward.reward_description || `Reward for reaching ${rank.rank_name}`,
            userId,
          ],
        );
      }
    }

    grantedRanks.push(rank.rank_name);
  }

  const topRank = eligibleRanks[eligibleRanks.length - 1];
  await client.query(`UPDATE users SET current_rank_id = $1 WHERE id = $2`, [
    topRank.id,
    userId,
  ]);

  return { upgraded: true, newRankNo: Number(topRank.rank_no), grantedRanks };
};

module.exports = evaluateAndUpgradeRank;
