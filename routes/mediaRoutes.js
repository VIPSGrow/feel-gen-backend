const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const isAdminOrSuperAdmin = require("../middleware/isAdminOrSuperAdmin");
const c = require("../controllers/mediaController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// Public (frontend)
router.get("/images", c.getImages);
router.get("/videos", c.getVideos);

// Admin
const admin = [authMiddleware, isAdminOrSuperAdmin];
router.get("/admin", admin, c.adminList);
router.post("/", admin, upload.any(), c.uploadMedia);
router.all("/:id/toggle", admin, c.toggleStatus);
router.delete("/:id", admin, c.deleteMedia);

module.exports = router;
