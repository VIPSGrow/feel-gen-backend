const db = require("../config/db");

const parseNonNegative = (value, field) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
  return parsed;
};

const getActivePlanId = async (client = db) => {
  const result = await client.query(
    `SELECT id
     FROM mlm_plan_settings
     WHERE is_active = TRUE
       AND effective_from <= CURRENT_TIMESTAMP
       AND (effective_to IS NULL OR effective_to > CURRENT_TIMESTAMP)
     ORDER BY effective_from DESC
     LIMIT 1`,
  );
  return result.rows[0]?.id;
};

exports.getPlan = async (req, res) => {
  try {
    const planId = await getActivePlanId();
    if (!planId) {
      return res.status(404).json({ success: false, message: "Active MLM plan not found" });
    }

    const [plan, commissions, ranks, rewards] = await Promise.all([
      db.query("SELECT * FROM mlm_plan_settings WHERE id = $1", [planId]),
      db.query(
        "SELECT * FROM mlm_generation_commissions WHERE plan_settings_id = $1 ORDER BY level_no",
        [planId],
      ),
      db.query(
        "SELECT * FROM mlm_ranks WHERE plan_settings_id = $1 ORDER BY rank_no",
        [planId],
      ),
      db.query(
        `SELECT rr.*, r.rank_no, r.rank_name
         FROM mlm_rank_rewards rr
         JOIN mlm_ranks r ON r.id = rr.rank_id
         WHERE r.plan_settings_id = $1
         ORDER BY r.rank_no, rr.id`,
        [planId],
      ),
    ]);

    res.json({
      success: true,
      data: {
        settings: plan.rows[0],
        commissions: commissions.rows,
        ranks: ranks.rows,
        rewards: rewards.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching MLM plan:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updatePlan = async (req, res) => {
  const fields = [
    "mrp",
    "direct_partner_commission_percent",
    "distributor_price",
    "distributor_price_mode",
    "distributor_price_percent",
    "packets_per_package",
    "holding_period_days",
    "max_generation_level",
  ];

  try {
    const updates = [];
    const values = [];
    let index = 1;

    for (const field of fields) {
      if (req.body[field] === undefined) continue;
      if (field.endsWith("percent") || field === "mrp" || field === "distributor_price") {
        values.push(parseNonNegative(req.body[field], field));
      } else {
        values.push(req.body[field]);
      }
      updates.push(`${field} = $${index++}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No plan fields to update" });
    }

    if (req.body.max_generation_level !== undefined) {
      const maxLevel = Number(req.body.max_generation_level);
      if (!Number.isInteger(maxLevel) || maxLevel < 1 || maxLevel > 7) {
        return res.status(400).json({ success: false, message: "max_generation_level must be between 1 and 7" });
      }
    }

    if (req.body.distributor_price_mode !== undefined && !["fixed", "mrp_less_percent"].includes(req.body.distributor_price_mode)) {
      return res.status(400).json({ success: false, message: "Invalid distributor_price_mode" });
    }

    const planId = await getActivePlanId();
    if (!planId) {
      return res.status(404).json({ success: false, message: "Active MLM plan not found" });
    }

    values.push(planId);
    const result = await db.query(
      `UPDATE mlm_plan_settings
       SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${index}
       RETURNING *`,
      values,
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error updating MLM plan:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateCommission = async (req, res) => {
  try {
    const levelNo = Number(req.params.level);
    const percentage = parseNonNegative(req.body.commission_percent, "commission_percent");
    if (!Number.isInteger(levelNo) || levelNo < 1 || levelNo > 7 || percentage > 100) {
      return res.status(400).json({ success: false, message: "level must be 1-7 and percentage must be 0-100" });
    }

    const planId = await getActivePlanId();
    const result = await db.query(
      `UPDATE mlm_generation_commissions
       SET commission_percent = $1,
           level_name = COALESCE($2, level_name),
           updated_at = CURRENT_TIMESTAMP
       WHERE plan_settings_id = $3 AND level_no = $4
       RETURNING *`,
      [percentage, req.body.level_name, planId, levelNo],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Generation commission not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error updating MLM commission:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateRank = async (req, res) => {
  try {
    const rankId = Number(req.params.id);
    const threshold = parseNonNegative(req.body.milestone_threshold, "milestone_threshold");
    if (!Number.isInteger(rankId) || !req.body.rank_name) {
      return res.status(400).json({ success: false, message: "Valid rank id and rank_name are required" });
    }

    const result = await db.query(
      `UPDATE mlm_ranks
       SET rank_name = $1,
           milestone_threshold = $2,
           threshold_type = COALESCE($3, threshold_type),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [req.body.rank_name, threshold, req.body.threshold_type, rankId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Rank not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error updating MLM rank:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.createReward = async (req, res) => {
  try {
    const rankId = Number(req.body.rank_id);
    if (!Number.isInteger(rankId) || !req.body.reward_type) {
      return res.status(400).json({ success: false, message: "rank_id and reward_type are required" });
    }

    const rankResult = await db.query(
      `SELECT r.id
       FROM mlm_ranks r
       JOIN mlm_plan_settings p ON p.id = r.plan_settings_id
       WHERE r.id = $1 AND p.is_active = TRUE
         AND p.effective_from <= CURRENT_TIMESTAMP
         AND (p.effective_to IS NULL OR p.effective_to > CURRENT_TIMESTAMP)`,
      [rankId],
    );
    if (rankResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Rank not found in active MLM plan" });
    }

    const rewardValue = req.body.reward_value === undefined
      ? null
      : parseNonNegative(req.body.reward_value, "reward_value");
    const result = await db.query(
      `INSERT INTO mlm_rank_rewards (rank_id, reward_type, reward_value, reward_description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [rankId, req.body.reward_type, rewardValue, req.body.reward_description || null],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error creating MLM reward:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getRewards = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rr.*, r.rank_no, r.rank_name
       FROM mlm_rank_rewards rr
       JOIN mlm_ranks r ON r.id = rr.rank_id
       JOIN mlm_plan_settings p ON p.id = r.plan_settings_id
       WHERE p.is_active = TRUE
         AND p.effective_from <= CURRENT_TIMESTAMP
         AND (p.effective_to IS NULL OR p.effective_to > CURRENT_TIMESTAMP)
       ORDER BY r.rank_no ASC, rr.id ASC`,
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching MLM rewards:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getReward = async (req, res) => {
  try {
    const rewardId = Number(req.params.id);
    if (!Number.isInteger(rewardId)) {
      return res.status(400).json({ success: false, message: "Invalid reward id" });
    }

    const result = await db.query(
      `SELECT rr.*, r.rank_no, r.rank_name
       FROM mlm_rank_rewards rr
       JOIN mlm_ranks r ON r.id = rr.rank_id
       JOIN mlm_plan_settings p ON p.id = r.plan_settings_id
       WHERE rr.id = $1 AND p.is_active = TRUE
         AND p.effective_from <= CURRENT_TIMESTAMP
         AND (p.effective_to IS NULL OR p.effective_to > CURRENT_TIMESTAMP)`,
      [rewardId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Reward not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error fetching MLM reward:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updateReward = async (req, res) => {
  try {
    const rewardId = Number(req.params.id);
    if (!Number.isInteger(rewardId)) {
      return res.status(400).json({ success: false, message: "Invalid reward id" });
    }
    const rewardValue = req.body.reward_value === undefined
      ? null
      : parseNonNegative(req.body.reward_value, "reward_value");
    const result = await db.query(
      `UPDATE mlm_rank_rewards
       SET reward_type = COALESCE($1, reward_type),
           reward_value = $2,
           reward_description = COALESCE($3, reward_description)
       WHERE id = $4
       RETURNING *`,
      [req.body.reward_type, rewardValue, req.body.reward_description, rewardId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Reward not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error updating MLM reward:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteReward = async (req, res) => {
  try {
    const rewardId = Number(req.params.id);
    if (!Number.isInteger(rewardId)) {
      return res.status(400).json({ success: false, message: "Invalid reward id" });
    }

    const result = await db.query(
      `DELETE FROM mlm_rank_rewards rr
       USING mlm_ranks r, mlm_plan_settings p
       WHERE rr.id = $1 AND rr.rank_id = r.id AND r.plan_settings_id = p.id
         AND p.is_active = TRUE
         AND p.effective_from <= CURRENT_TIMESTAMP
         AND (p.effective_to IS NULL OR p.effective_to > CURRENT_TIMESTAMP)
       RETURNING rr.*`,
      [rewardId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Reward not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error deleting MLM reward:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};
