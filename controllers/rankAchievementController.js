const db = require("../config/db");

exports.getPendingRankAchievements = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, rank_no, rank_name, rewards, achieved_at
       FROM rank_achievements
       WHERE user_id = $1 AND is_seen = FALSE
       ORDER BY rank_no ASC`,
      [req.user.id],
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getPendingRankAchievements error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markRankAchievementsSeen = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
    const { rowCount } = await db.query(
      `UPDATE rank_achievements
       SET is_seen = TRUE, seen_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_seen = FALSE
         AND ($2::int[] = '{}' OR id = ANY($2::int[]))`,
      [req.user.id, ids],
    );
    res.json({ success: true, updated: rowCount });
  } catch (err) {
    console.error("markRankAchievementsSeen error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
