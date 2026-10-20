const express = require("express");
const router = express.Router();
const {
  getDashboardData,
  getUserDashboardData,
  getAnalytics,
  getEcomDashboardData,
  getDashboardDataV2,
  dismissRepurchaseReminder,
} = require("../controllers/dashboardController");

const authMiddleware = require("../middleware/authMiddleware");
const isAdminOrSuperAdmin = require("../middleware/isAdminOrSuperAdmin");
const ecomAuth = require("../middleware/ecomAuth");

// @route   GET api/dashboard/me
// @desc    Get user/distributor personal dashboard data
// @access  Authenticated User/Distributor
router.get("/me", authMiddleware, getUserDashboardData);

router.post("/repurchase-reminder/dismiss", authMiddleware, dismissRepurchaseReminder);

// @route   GET api/dashboard
// @desc    Get admin dashboard overview data
// @access  Admin/SuperAdmin
router.get("/", authMiddleware, isAdminOrSuperAdmin, getDashboardData);

// @route   GET api/dashboard/v2
// @desc    Get admin dashboard overview data split into distributor & ecom_user
// @access  Admin/SuperAdmin
router.get("/v2", authMiddleware, isAdminOrSuperAdmin, getDashboardDataV2);

// @route   GET api/dashboard/analytics
// @desc    Get MLM analytics metrics (Total Referrals, Active Downline, Commissions, Conversion Rate)
// @access  Admin/SuperAdmin
router.get("/analytics", authMiddleware, getAnalytics);

// dashboard for ecom-user
router.get("/ecom/me", ecomAuth, getEcomDashboardData);

module.exports = router;
