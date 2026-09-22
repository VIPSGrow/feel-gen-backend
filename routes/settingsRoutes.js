const express = require("express");
const router = express.Router();
const {
  getSettings,
  getSettingByKey,
  createSetting,
  updateSetting,
  deleteSetting,
  getLevelCommissions,
  getLevelCommission,
  createLevelCommission,
  updateLevelCommission,
  deleteLevelCommission,
  getLevelCapping,
  createLevelCapping,
  deleteLevelCapping,
  updateLevelCapping,
} = require("../controllers/settingsController");

const authMiddleware = require("../middleware/authMiddleware");
const isSuperAdmin = require("../middleware/isSuperAdmin");
const {
  getPlan,
  updatePlan,
  updateCommission,
  updateRank,
  getRewards,
  getReward,
  createReward,
  updateReward,
  deleteReward,
} = require("../controllers/mlmPlanController");

const adminPlanAccess = [authMiddleware, isSuperAdmin];

router.get("/mlm-plan", adminPlanAccess, getPlan);
router.put("/mlm-plan", adminPlanAccess, updatePlan);
router.put("/mlm-plan/commissions/:level", adminPlanAccess, updateCommission);
router.put("/mlm-plan/ranks/:id", adminPlanAccess, updateRank);
router.get("/mlm-plan/rewards",  getRewards);
router.get("/mlm-plan/rewards/:id", adminPlanAccess, getReward);
router.post("/mlm-plan/rewards", adminPlanAccess, createReward);
router.put("/mlm-plan/rewards/:id", adminPlanAccess, updateReward);
router.delete("/mlm-plan/rewards/:id", adminPlanAccess, deleteReward);

// Public read access
router.get("/", getSettings);
router.get("/:key", getSettingByKey);
router.get("/category/:category", getSettings);

// Admin CRUD - protected
router.post("/", [authMiddleware, isSuperAdmin], createSetting);
router.put("/:key", [authMiddleware, isSuperAdmin], updateSetting);
router.delete("/:key", [authMiddleware, isSuperAdmin], deleteSetting);

// Level Commissions routes
router.get("/commissions/list", getLevelCommissions);
router.get("/level-commissions-by-no/:level_no", getLevelCommission);

router.post(
  "/level-commissions",
  [authMiddleware, isSuperAdmin],
  createLevelCommission,
);
router.put(
  "/level-commissions/:level_id",
  [authMiddleware, isSuperAdmin],
  updateLevelCommission,
);
router.delete(
  "/level-commissions/:level_no",
  [authMiddleware, isSuperAdmin],
  deleteLevelCommission,
);

// Level capping
router.get("/capping/list", getLevelCapping);
router.post(
  "/level-capping",
  [authMiddleware, isSuperAdmin],
  createLevelCapping,
);
router.put(
  "/level-capping/:level_no",
  [authMiddleware, isSuperAdmin],
  updateLevelCapping,
);
router.delete(
  "/level-capping/:id",
  [authMiddleware, isSuperAdmin],
  deleteLevelCapping,
);

module.exports = router;
