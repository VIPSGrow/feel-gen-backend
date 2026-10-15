const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getPendingRankAchievements,
  markRankAchievementsSeen,
} = require("../controllers/rankAchievementController");

router.get("/pending", authMiddleware, getPendingRankAchievements);
router.post("/seen", authMiddleware, markRankAchievementsSeen);

module.exports = router;
