const express = require("express");
const {
  listCoupons,
  createCoupon,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  listPublicCoupons
} = require("../controllers/couponController");
const authMiddleware = require("../middleware/authMiddleware");
const isSuperAdmin = require("../middleware/isSuperAdmin");

const router = express.Router();

// Public list of coupons marked for website display (must be before "/:id")
router.get("/public", listPublicCoupons);

// Admin CRUD - protected
router.get("/",  [authMiddleware, isSuperAdmin], listCoupons);
router.post("/", [authMiddleware, isSuperAdmin], createCoupon);
router.get("/:id", [authMiddleware, isSuperAdmin], getCouponById);
router.put("/:id", [authMiddleware, isSuperAdmin], updateCoupon);
router.delete("/:id", [authMiddleware, isSuperAdmin], deleteCoupon);

// Public validation (no auth needed for checkout)
router.post("/validate", validateCoupon);

module.exports = router;

