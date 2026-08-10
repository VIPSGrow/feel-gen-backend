const express = require("express");
const router = express.Router();
const multer = require("multer");
const blogController = require("../controllers/blogController");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(
        new Error("Only image files are allowed: jpeg, png, gif, webp"),
        false,
      );
    }
  },
});

// Helper middleware to catch Multer errors cleanly
const uploadSingleImage = (req, res, next) => {
  upload.single("featured_image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// ==================== CATEGORY ROUTES ====================
// Public - Get all categories
router.get("/categories", blogController.getAllCategories);
// Public - Get single category by ID
router.get("/categories/:id", blogController.getCategoryById);
// Admin - Create category
router.post("/categories", blogController.createCategory);
// Admin - Update category
router.put("/categories/:id", blogController.updateCategory);
// Admin - Delete category
router.delete("/categories/:id", blogController.deleteCategory);

// ==================== POST ROUTES ====================
// --- Public Routes ---
router.get("/", blogController.getAllPosts);
router.get("/:slug", blogController.getPostBySlug); // This now returns post + latest 6 products + comments
router.post("/comment", blogController.addComment); // Public can post comments

// --- Admin Routes ---
router.post("/", uploadSingleImage, blogController.createPost);
router.get("/details/:slug", blogController.getPostDetails); // This now returns post + latest 6 products + comments
router.put("/:id", uploadSingleImage, blogController.updatePost);
router.delete("/:id", blogController.deletePost);
router.put("/comment/approve/:commentId", blogController.approveComment); // Admin approves comments

module.exports = router;
