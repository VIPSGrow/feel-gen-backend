const db = require("../config/db");

exports.getSettings = async (req, res) => {
  try {
    const { category } = req.query;
    let query = "SELECT * FROM app_settings";
    const params = [];

    if (category) {
      query += " WHERE category = $1";
      params.push(category);
    }

    query += " ORDER BY category, setting_key";

    const result = await db.query(query, params);

    res.status(200).json({
      success: true,
      message: "Settings fetched successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getSettingByKey = async (req, res) => {
  try {
    const { key } = req.params;

    if (!key || typeof key !== "string" || key.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid setting_key is required",
      });
    }

    const result = await db.query(
      "SELECT * FROM app_settings WHERE setting_key = $1",
      [key.trim()],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Setting not found for the provided key",
      });
    }

    res.status(200).json({
      success: true,
      message: "Setting fetched successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching setting:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.createSetting = async (req, res) => {
  try {
    const { setting_key, setting_value, category } = req.body;

    if (
      !setting_key ||
      typeof setting_key !== "string" ||
      setting_key.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "setting_key is required and must be non-empty string",
      });
    }

    if (!setting_value) {
      return res.status(400).json({
        success: false,
        message: "setting_value is required",
      });
    }

    const result = await db.query(
      "INSERT INTO app_settings (setting_key, setting_value, category) VALUES ($1, $2, $3) RETURNING *",
      [setting_key.trim(), setting_value, category || null],
    );

    res.status(201).json({
      success: true,
      message: "Setting created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      // Unique violation
      return res.status(409).json({
        success: false,
        message: "Setting key already exists",
      });
    }
    console.error("Error creating setting:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { setting_value, category } = req.body;

    if (!key || typeof key !== "string" || key.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid setting_key is required",
      });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (setting_value !== undefined) {
      updates.push(`setting_value = $${paramIndex}`);
      values.push(setting_value);
      paramIndex++;
    }

    if (category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    values.push(key.trim());

    const result = await db.query(
      `UPDATE app_settings SET ${updates.join(
        ", ",
      )}, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Setting not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Setting updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating setting:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.deleteSetting = async (req, res) => {
  try {
    const { key } = req.params;

    if (!key || typeof key !== "string" || key.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid setting_key is required",
      });
    }

    const result = await db.query(
      "DELETE FROM app_settings WHERE setting_key = $1 RETURNING *",
      [key.trim()],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Setting not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Setting deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error deleting setting:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Level Commissions - returns everything the admin needs to manage the live
// commission structure: self cashback, direct partner, generation levels
// (1-7), ranks, and rank rewards.
exports.getLevelCommissions = async (req, res) => {
  try {
    const selfRes = await db.query(
      "SELECT level_no, commission_percentage, level_name FROM level_commissions WHERE level_no = 0",
    );

    const planRes = await db.query(
      `SELECT id, direct_partner_commission_percent
       FROM mlm_plan_settings
       WHERE is_active = TRUE
       ORDER BY effective_from DESC
       LIMIT 1`,
    );
    const plan = planRes.rows[0];

    const [generationRes, ranksRes, rewardsRes] = plan
      ? await Promise.all([
          db.query(
            `SELECT level_no, commission_percent, level_name
             FROM mlm_generation_commissions
             WHERE plan_settings_id = $1
             ORDER BY level_no`,
            [plan.id],
          ),
          db.query(
            `SELECT * FROM mlm_ranks WHERE plan_settings_id = $1 ORDER BY rank_no`,
            [plan.id],
          ),
          db.query(
            `SELECT rr.*, r.rank_no, r.rank_name
             FROM mlm_rank_rewards rr
             JOIN mlm_ranks r ON r.id = rr.rank_id
             WHERE r.plan_settings_id = $1
             ORDER BY r.rank_no, rr.id`,
            [plan.id],
          ),
        ])
      : [{ rows: [] }, { rows: [] }, { rows: [] }];

    const commissions = [
      {
        level_no: 0,
        type: "self_cashback",
        level_name: selfRes.rows[0]?.level_name || "Self Cashback",
        commission_percentage: Number(selfRes.rows[0]?.commission_percentage || 0),
      },
      {
        level_no: 0,
        type: "direct_partner",
        level_name: "Direct Partner",
        commission_percentage: Number(plan?.direct_partner_commission_percent || 0),
      },
      ...generationRes.rows.map((r) => ({
        level_no: Number(r.level_no),
        type: "generation",
        level_name: r.level_name,
        commission_percentage: Number(r.commission_percent),
      })),
    ];

    res.status(200).json({
      success: true,
      message: "Level commissions fetched successfully",
      data: commissions,
      ranks: ranksRes.rows,
      rewards: rewardsRes.rows,
    });
  } catch (error) {
    console.error("Error fetching level commissions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getLevelCommission = async (req, res) => {
  try {
    const { level_no } = req.params;

    const parsedLevelNo = parseInt(level_no);
    if (isNaN(parsedLevelNo) || parsedLevelNo < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid level_no (positive integer) is required",
      });
    }

    const result = await db.query(
      "SELECT * FROM level_commissions WHERE level_no = $1",
      [parsedLevelNo],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Level commission not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Level commission fetched successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching level commission:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.createLevelCommission = async (req, res) => {
  try {
    const {
      level_no,
      commission_percentage,
      level_name,
      team_size,
      ir_direct,
      bima,
      ir_commission,
    } = req.body;

    const parsedLevelNo = parseInt(level_no);
    if (isNaN(parsedLevelNo) || parsedLevelNo < 1) {
      return res.status(400).json({
        success: false,
        message: "level_no must be positive integer",
      });
    }

    if (
      !commission_percentage ||
      isNaN(commission_percentage) ||
      commission_percentage < 0 ||
      commission_percentage > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "commission_percentage must be between 0 and 100",
      });
    }

    const result = await db.query(
      "INSERT INTO level_commissions (level_no, commission_percentage, level_name, team_size, ir_direct, bima, ir_commission) VALUES ($1, $2, $3,$4,$5,$6,$7) RETURNING *",
      [
        parsedLevelNo,
        parseFloat(commission_percentage),
        level_name,
        team_size,
        parseFloat(ir_direct),
        bima,
        parseFloat(ir_commission),
      ],
    );

    res.status(201).json({
      success: true,
      message: "Level commission created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Level commission for this level_no already exists",
      });
    }
    console.error("Error creating level commission:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateLevelCommission = async (req, res) => {
  try {
    const { level_id } = req.params;
    const { type, commission_percentage, level_name } = req.body;
    const percentage = Number(commission_percentage);

    if (type === "direct_partner") {
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        return res.status(400).json({
          success: false,
          message: "commission_percentage must be between 0 and 100",
        });
      }

      const planRes = await db.query(
        `UPDATE mlm_plan_settings
         SET direct_partner_commission_percent = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = (
           SELECT id
           FROM mlm_plan_settings
           WHERE is_active = TRUE
           ORDER BY effective_from DESC
           LIMIT 1
         )
         RETURNING *`,
        [percentage],
      );

      if (planRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Active MLM plan not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Direct partner commission updated successfully",
        data: {
          level_no: 0,
          type,
          level_name: level_name || "Direct Partner",
          commission_percentage: Number(
            planRes.rows[0].direct_partner_commission_percent,
          ),
        },
      });
    }

    if (type === "self_cashback") {
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        return res.status(400).json({
          success: false,
          message: "commission_percentage must be between 0 and 100",
        });
      }

      const selfRes = await db.query(
        `UPDATE level_commissions
         SET commission_percentage = $1,
             level_name = COALESCE($2, level_name)
         WHERE level_no = 0
         RETURNING *`,
        [percentage, level_name],
      );

      if (selfRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Self cashback commission not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Self cashback commission updated successfully",
        data: {
          level_no: 0,
          type,
          level_name: selfRes.rows[0].level_name,
          commission_percentage: Number(
            selfRes.rows[0].commission_percentage,
          ),
        },
      });
    }

    if (type === "generation") {
      const levelNo = Number(level_id);

      if (!Number.isInteger(levelNo) || levelNo < 1 || levelNo > 7) {
        return res.status(400).json({
          success: false,
          message: "Generation level must be between 1 and 7",
        });
      }

      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        return res.status(400).json({
          success: false,
          message: "commission_percentage must be between 0 and 100",
        });
      }

      const planRes = await db.query(
        `SELECT id
         FROM mlm_plan_settings
         WHERE is_active = TRUE
         ORDER BY effective_from DESC
         LIMIT 1`,
      );
      const planId = planRes.rows[0]?.id;

      if (!planId) {
        return res.status(404).json({
          success: false,
          message: "Active MLM plan not found",
        });
      }

      const generationRes = await db.query(
        `UPDATE mlm_generation_commissions
         SET commission_percent = $1,
             level_name = COALESCE($2, level_name),
             updated_at = CURRENT_TIMESTAMP
         WHERE plan_settings_id = $3 AND level_no = $4
         RETURNING *`,
        [percentage, level_name, planId, levelNo],
      );

      if (generationRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Generation commission not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Level commission updated successfully",
        data: generationRes.rows[0],
      });
    }

    const {
      team_size,
      ir_direct,
      bima,
      ir_commission,
      level_no: n_level_no,
    } = req.body;

    const parsedLevelNo = parseInt(level_id);
    if (isNaN(parsedLevelNo) || parsedLevelNo < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid level_id (positive integer) is required",
      });
    }

    const result = await db.query(
      `UPDATE level_commissions SET 
      commission_percentage = $1,
      level_name = $2,
      team_size = $3,
      ir_direct = $4,
      bima = $5,
      ir_commission = $6 ,
      level_no = $8
      WHERE id = $7 RETURNING *`,
      [
        parseFloat(commission_percentage),
        level_name,
        team_size,
        ir_direct,
        bima,
        ir_commission,
        parsedLevelNo,
        n_level_no,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Level commission not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Level commission updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating level commission:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.deleteLevelCommission = async (req, res) => {
  try {
    const { level_no } = req.params;

    const parsedLevelNo = parseInt(level_no);
    if (isNaN(parsedLevelNo) || parsedLevelNo < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid level_no (positive integer) is required",
      });
    }

    const result = await db.query(
      "DELETE FROM level_commissions WHERE level_no = $1 RETURNING *",
      [parsedLevelNo],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Level commission not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Level commission deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error deleting level commission:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// capping
exports.getLevelCapping = async (req, res) => {
  try {
    const { level_no } = req.query;
    let query =
      "SELECT cap.*, lc.level_name, lc.level_no FROM level_cappings cap LEFT JOIN level_commissions lc ON lc.id =  cap.level_id ";
    const params = [];

    if (level_no) {
      query += " WHERE level_no = $1";
      params.push(parseInt(level_no));
    }

    query += " ORDER BY level_id";

    const result = await db.query(query, params);

    res.status(200).json({
      success: true,
      message: "Level capping fetched successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching level capping:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.createLevelCapping = async (req, res) => {
  try {
    const { level_id, day_limit, week_limit, monthly_limit } = req.body;

    // if (!week_limit || isNaN(week_limit) || parseFloat(week_limit) > 100) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'week_limit must be greater than 0'
    //   });
    // }

    const result = await db.query(
      "INSERT INTO level_cappings (level_id, day_limit, week_limit, monthly_limit) VALUES ($1, $2, $3, $4) RETURNING *",
      [level_id, day_limit, week_limit, monthly_limit],
    );

    res.status(201).json({
      success: true,
      message: "Level capping created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Level capping for this level_no already exists",
      });
    }
    console.error("Error creating level capping:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.deleteLevelCapping = async (req, res) => {
  try {
    const { id } = req.params;

    // const parsedLevelNo = parseInt(level_no);
    // if (isNaN(parsedLevelNo) || parsedLevelNo < 1) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Valid level_no (positive integer) is required'
    //   });
    // }

    const result = await db.query(
      "DELETE FROM level_cappings WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Level capping not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Level capping deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error deleting level capping:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateLevelCapping = async (req, res) => {
  try {
    const { level_no } = req.params;
    const { level_id, day_limit, week_limit, monthly_limit } = req.body;

    const parsedLevelNo = parseInt(level_no);
    if (isNaN(parsedLevelNo) || parsedLevelNo < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid level_no (positive integer) is required",
      });
    }

    const result = await db.query(
      `UPDATE level_cappings SET 
      day_limit = $1,
      week_limit = $2,
      monthly_limit = $3      
      WHERE id = $4 RETURNING *`,
      [day_limit, week_limit, monthly_limit, parsedLevelNo],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Level commission not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Level commission updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating level commission:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
