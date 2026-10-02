const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { generateInvoice, downloadByEmail } = require("../controllers/invoiceController");
const ecomAuth = require("../middleware/ecomAuth");

const router = express.Router();

// Generate (or reuse) invoice PDF
// POST /api/invoice/generate?force=true|false
// body: { invoiceNo?: string, invoiceDate?: string }
router.post("/generate", authMiddleware, generateInvoice);
router.post("/invoice-generate", ecomAuth, generateInvoice);
router.post("/download-invoice",downloadByEmail);

module.exports = router;
