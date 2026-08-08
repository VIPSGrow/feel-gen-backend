const express = require("express");
const multer = require("multer");
const path = require("path");
const isSuperAdmin = require("../middleware/isSuperAdmin");
const {
  getCategories,
  getProducts,
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductByslug,
  getProductsForDistributor,
  getProductsSlugs,
  deletePermanantProduct,
} = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getAllAttributes,
  getAttrValues,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  createAttrValue,
  getAttrValuesByIds,
} = require("../controllers/attrController");
const router = express.Router();

// Multer setup for product creation - images only
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

// Middleware to convert files to base64 data URLs in req.body
const processProductFiles = (req, res, next) => {
  if (req.files) {
    // console.log("\n\n\n Files - ", req.files);

    // f_image
    const fImageFile = req.files.find((f) => f.fieldname === "f_image");
    if (fImageFile) {
      req.body.f_image = `data:${
        fImageFile.mimetype
      };base64,${fImageFile.buffer.toString("base64")}`;
    }

    // g_image[0..2]

    for (let i = 0; i < 3; i++) {
      const gImageFile = req.files.find((f) => f.fieldname === `g_image[${i}]`);

      if (gImageFile) {
        req.body[`g_image[${i}]`] = `data:${
          gImageFile.mimetype
        };base64,${gImageFile.buffer.toString("base64")}`;
      }
    }
  }
  next();
};

router.get("/categories", getCategories);
router.get("/products", getProducts);
router.get("/products-slug", getProductsSlugs);
router.get("/getDproducts", getProductsForDistributor);

router.post("/category/create", [authMiddleware, isSuperAdmin], createCategory);
router.put("/category/update", [authMiddleware, isSuperAdmin], updateCategory);
router.delete("/category/:id", [authMiddleware, isSuperAdmin], deleteCategory);

// Attributes CRUD
router.get("/attributes", getAllAttributes);
router.get("/attributes/values", getAttrValuesByIds);
router.get("/attributes/:attrId/values", authMiddleware, getAttrValues);
router.post("/attributes", [authMiddleware, isSuperAdmin], createAttribute);
router.put("/attributes/:id", [authMiddleware, isSuperAdmin], updateAttribute);
router.delete(
  "/attributes/:id",
  [authMiddleware, isSuperAdmin],
  deleteAttribute,
);
router.post(
  "/attributes/:attrId/values",
  [authMiddleware, isSuperAdmin],
  createAttrValue,
);

// Product CRUD routes - now with multer
router.post(
  "/products",
  upload.any(),
  [authMiddleware, isSuperAdmin, processProductFiles],
  createProduct,
);
router.get("/product-detail/:slug", getProductByslug);
router.get("/products/:id", getProductById);
router.put(
  "/products/:id",
  upload.any(),
  [authMiddleware, isSuperAdmin, processProductFiles],
  updateProduct,
);
router.delete("/products/:id", [authMiddleware, isSuperAdmin], deleteProduct);
router.delete(
  "/productDelete/:id",
  [authMiddleware, isSuperAdmin],
  deletePermanantProduct,
);

module.exports = router;
