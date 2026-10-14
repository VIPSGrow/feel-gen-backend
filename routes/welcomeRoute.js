const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const db = require("../config/db");
const { generateAndSaveIdCard } = require("../utils/idCardService");
const { generateAndSaveWelcomeLetter } = require("../utils/welcomeService");

// Generates (or refreshes) a user's ID card if not present.
// If already generated, it still regenerates to ensure QR/name are up-to-date.
// Frontend can call this after user activation / milestone.
router.post("/generate", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user data needed for overlays/QR
    const userRes = await db.query(
      `SELECT 
      u.id, 
      u.full_name,
      u.referral_code, 
      u.phone, 
      u.business_level, 
      u.created_at,
      l.level_name FROM users u left join mlm_generation_commissions l on l.level_no = u.business_level
         AND l.is_active = TRUE
         AND l.plan_settings_id = (SELECT id FROM mlm_plan_settings WHERE is_active = TRUE ORDER BY effective_from DESC LIMIT 1)
       WHERE u.id = $1`,
      [userId],
    );

    if (!userRes.rows.length) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const user = userRes.rows[0];

    const result = await generateAndSaveWelcomeLetter({
      date: user.created_at,
      userId: user.id,
      fullName: user.full_name,
      referralCode: user.referral_code,
    });

    return res.json({
      status: true,
      message: "ID card generated",
      data: result,
    });
  } catch (err) {
    console.error("ID card generation error:", err);
    return res.status(500).json({
      status: false,
      message: "Server error generating ID card",
    });
  }
});

module.exports = router;
