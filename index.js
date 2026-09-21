const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const fs = require("fs").promises;
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use("/uploads", express.static("uploads"));

// Global multer config (keep existing behavior for other endpoints)
// IMPORTANT: avoid applying to every /api request, it can break multipart parsing
// for specific routes (e.g., ticket raise/reply).
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Only enable global multipart parsing for endpoints that require it.
// (Keep /api/upload as-is; do NOT parse all /api here.)

// Basic Route
app.get("/", (req, res) => {
  res.send("GANESH TECH SOLUTION MLM API is running...");
});

// Add this line
// Razorpay webhook ke liye JSON parsing bypass karna zaroori hai (signature mismatch fix)
app.use("/api/payment/webhook", express.raw({ type: "*/*" }));

// JSON parsing (baki routes ke liye)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/coupons", require("./routes/couponRoutes"));
app.use("/api/static", require("./routes/staticRoutes"));
app.use("/api/wallet", require("./routes/walletRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/tax", require("./routes/taxRoute"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/ecom", require("./routes/ecomRoutes"));
app.use("/api/payment", require("./routes/razorpayRoute"));
app.use("/api/roles", require("./routes/rolesRoutes"));
app.use("/api/staff", require("./routes/staffRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/reports", require("./routes/reportRoute"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/milestones", require("./routes/milestoneRoutes"));
app.use("/api/id-cards", require("./routes/idCardRoutes"));
app.use("/api/letter", require("./routes/welcomeRoute"));
app.use("/api/blog", require("./routes/blogRoute"));
app.use("/api/chatbot", require("./routes/chatbotRoutes"));
app.use("/api/policies", require("./routes/policiesRoutes"));

app.use("/api/support", require("./routes/supportRoutes"));
app.use("/api/business", require("./routes/businessRoutes"));
app.use("/api/sample-requests", require("./routes/sampleRequestRoutes"));
app.use("/api/invoice", require("./routes/invoiceRoutes"));

app.post("/api/upload", async (req, res) => {
  try {
    // 1. चेक करें कि फाइल्स आई हैं या नहीं
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded" });
    }

    const file = req.files[0];
    const uploadDir = "uploads/config";

    // 2. सुनिश्चित करें कि फोल्डर मौजूद है (वरना writeFile एरर देगा)
    await fs.mkdir(uploadDir, { recursive: true });

    // 3. फाइल नेम को क्लीन करें (स्पेस हटाएँ) और पाथ सेट करें
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    const filePath = path.join(uploadDir, fileName);

    // 4. फाइल को राइट करें
    await fs.writeFile(filePath, file.buffer);

    // 5. रिस्पॉन्स भेजें (URL में फॉरवर्ड स्लैश का सही इस्तेमाल)
    res.json({
      success: true,
      url: `${process.env.APP_URL}/${uploadDir}/${fileName}`,
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ success: false, message: "File upload failed" });
  }
});

// Auto-init wallet for new users, seed commissions, cron - handled in scripts
require("./utils/releaseHoldCron");
require("./utils/monthlyTdsCron");

// Run seed if needed (one-time)

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
