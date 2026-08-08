const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/isAdmin");
const isSuperAdmin = require("../middleware/isSuperAdmin");
const kycMiddleware = require("../middleware/kycMiddleware");
const {
  getKycRequests,
  updateKycRequest,
} = require("../controllers/kycRequestController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const { getUserById } = require("../controllers/authController");

router.get("/all", [auth, isSuperAdmin], userController.getAllUsers);
router.get("/by_id/:user_id", getUserById);
router.get("/downline", auth, userController.getMyDownline);
router.put("/downline/:id", [auth, isSuperAdmin], userController.updateMember);
router.get("/tree", auth, userController.getMyTree);
router.get("/tree-by-id/:id", [auth], userController.getMyTreeById);

router.post("/create", userController.createUser);
router.get("/profile-by-referral", userController.getProfile);
router.put("/me/profile", auth, userController.updateMyProfile);
// Update user account/bank + nominee details
router.put("/account", auth, userController.updateUserAccount);
router.put(
  "/account/:userId",
  [auth, isSuperAdmin],
  userController.updateUserAccount,
);

// Transaction PIN & Password
router.post("/set-pin", auth, userController.setTransactionPin);
router.post("/change-password", auth, userController.changePassword);
router.post("/send-otp", userController.sendOtp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/reset-password", userController.resetPassword);
router.get("/checkGST/:gst_no", userController.checkGST);
// KYC routes
router.get("/kyc-status", kycMiddleware, userController.getKycStatus);

const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post(
  "/kyc/upload",
  // multipart parsing (req.files + req.body)
  kycUpload.any(),
  require("../middleware/processKycUpload"),
  userController.uploadKycDocuments,
);
router.post("/kyc/submit", kycMiddleware, userController.submitKycRequest);

const profilePicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post(
  "/profile-pic",
  [auth, profilePicUpload.single("profile")],
  userController.uploadProfilePicture,
);

router.post(
  "/admin/kyc/:userId",
  [auth, isAdmin],
  userController.updateKycStatus,
);
router.get(
  "/admin/kyc-requests",
  [kycMiddleware, isSuperAdmin],
  getKycRequests,
);
router.put(
  "/admin/kyc-requests/:id",
  [kycMiddleware, isSuperAdmin],
  updateKycRequest,
);
router.put(
  "/kyc/doc-update/:docId",
  [kycMiddleware, isSuperAdmin],
  userController.updateKycDocument,
);

module.exports = router;
