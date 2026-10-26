const express = require("express");
const {
  createOrder,
  verifyPayment,
  cancelPayment,
  razorpayWebhook,
} = require("../controllers/razorPayController");
const ecomAuth = require("../middleware/ecomAuth");
const router = express.Router();

router.post("/create-order", createOrder);
router.post("/verify", verifyPayment);
router.post("/cancel", ecomAuth, cancelPayment);
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);
module.exports = router;
