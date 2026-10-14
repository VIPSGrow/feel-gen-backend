const db = require("../config/db");

exports.getMilestones = async (req, res) => {
  try {
    const { level_id } = req.query;

    // We join level_milestones (m) with level_comission (lc)
    // Adjust 'lc.id' or 'lc.level_no' based on your specific foreign key relationship
    let query = `
      SELECT 
        m.*, 
        gc.level_name, 
        gc.level_no,
        gc.commission_percent AS commission_percentage,
        gc.team_size_threshold as required_team_size
      FROM level_milestones m
      LEFT JOIN mlm_generation_commissions gc ON m.level_id = gc.id
    `;

    const params = [];

    if (level_id) {
      query += " WHERE m.level_id = $1";
      params.push(parseInt(level_id));
    }

    query += " ORDER BY gc.level_no ASC";

    const result = await db.query(query, params);

    res.status(200).json({
      status: true,
      message: "Milestones fetched successfully with level details",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching level_milestones:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.getMilestoneById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "SELECT * FROM level_milestones WHERE id = $1",
      [parseInt(id)],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Milestone not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "Milestone fetched successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching milestone:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.createMilestone = async (req, res) => {
  try {
    const { level_id, milestone_name, tour_details, reward_cash, cash_com } =
      req.body;

    if (!level_id || isNaN(parseInt(level_id)) || parseInt(level_id) < 1) {
      return res.status(400).json({
        status: false,
        message: "Valid level_id (positive integer) is required",
      });
    }

    if (
      !milestone_name ||
      typeof milestone_name !== "string" ||
      milestone_name.trim().length === 0
    ) {
      return res.status(400).json({
        status: false,
        message: "milestone_name is required and must be a non-empty string",
      });
    }

    const parsedRewardCash =
      reward_cash !== undefined ? parseFloat(reward_cash) : 0.0;
    if (isNaN(parsedRewardCash) || parsedRewardCash < 0) {
      return res.status(400).json({
        status: false,
        message: "reward_cash must be a non-negative number",
      });
    }

    const parsedCashCom = cash_com !== undefined ? parseFloat(cash_com) : 0.0;
    if (isNaN(parsedCashCom) || parsedCashCom < 0) {
      return res.status(400).json({
        status: false,
        message: "cash_com must be a non-negative number",
      });
    }

    const result = await db.query(
      "INSERT INTO level_milestones (level_id, milestone_name, tour_details, reward_cash, cash_com) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [
        parseInt(level_id),
        milestone_name.trim(),
        tour_details || null,
        parsedRewardCash,
        parsedCashCom,
      ],
    );

    res.status(201).json({
      status: true,
      message: "Milestone created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating milestone:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.updateMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const { level_id, milestone_name, tour_details, reward_cash, cash_com } =
      req.body;

    const parsedId = parseInt(id);
    if (isNaN(parsedId) || parsedId < 1) {
      return res.status(400).json({
        status: false,
        message: "Valid id (positive integer) is required",
      });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (level_id !== undefined) {
      const parsedLevelId = parseInt(level_id);
      if (isNaN(parsedLevelId) || parsedLevelId < 1) {
        return res.status(400).json({
          status: false,
          message: "level_id must be a positive integer",
        });
      }
      updates.push(`level_id = $${paramIndex}`);
      values.push(parsedLevelId);
      paramIndex++;
    }

    if (milestone_name !== undefined) {
      if (
        typeof milestone_name !== "string" ||
        milestone_name.trim().length === 0
      ) {
        return res.status(400).json({
          status: false,
          message: "milestone_name must be a non-empty string",
        });
      }
      updates.push(`milestone_name = $${paramIndex}`);
      values.push(milestone_name.trim());
      paramIndex++;
    }

    if (tour_details !== undefined) {
      updates.push(`tour_details = $${paramIndex}`);
      values.push(tour_details || null);
      paramIndex++;
    }

    if (reward_cash !== undefined) {
      const parsedRewardCash = parseFloat(reward_cash);
      if (isNaN(parsedRewardCash) || parsedRewardCash < 0) {
        return res.status(400).json({
          status: false,
          message: "reward_cash must be a non-negative number",
        });
      }
      updates.push(`reward_cash = $${paramIndex}`);
      values.push(parsedRewardCash);
      paramIndex++;
    }

    if (cash_com !== undefined) {
      const parsedCashCom = parseFloat(cash_com);
      if (isNaN(parsedCashCom) || parsedCashCom < 0) {
        return res.status(400).json({
          status: false,
          message: "cash_com must be a non-negative number",
        });
      }
      updates.push(`cash_com = $${paramIndex}`);
      values.push(parsedCashCom);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No fields to update",
      });
    }

    values.push(parsedId);

    const result = await db.query(
      `UPDATE level_milestones SET ${updates.join(
        ", ",
      )} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Milestone not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "Milestone updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating milestone:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.deleteMilestone = async (req, res) => {
  try {
    const { id } = req.params;

    const parsedId = parseInt(id);
    if (isNaN(parsedId) || parsedId < 1) {
      return res.status(400).json({
        status: false,
        message: "Valid id (positive integer) is required",
      });
    }

    const result = await db.query(
      "DELETE FROM level_milestones WHERE id = $1 RETURNING *",
      [parsedId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: false,
        message: "Milestone not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "Milestone deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};
