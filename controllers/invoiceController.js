const path = require("path");
const db = require("../config/db"); // Replace with your actual DB pool configuration path
const { getOrCreateInvoicePdf } = require("../utils/invoiceServiceNew");

async function generateInvoice(req, res) {
  try {
    const userId = req.user?.id;
    const { orderId } = req.body || req.query || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required to generate invoice",
      });
    }

    // Fetch complete contextual single order profile matching database schema queries
    const orderQuery = `
      SELECT 
        o.*, 
        CASE 
          WHEN o.user_id IS NOT NULL THEN 'User'
          WHEN o.distributor_id IS NOT NULL THEN 'Distributor'
          ELSE 'Unknown'
        END as user_type,
        COALESCE(u.name, d.full_name, d.username) as user_name, 
        COALESCE(u.phone, d.phone) as user_phone,
        COALESCE(u.email, d.email) as user_email,
        COALESCE(d.gstin, 'N/A') as user_gstin,
        CASE 
          WHEN o.distributor_id IS NOT NULL THEN 
            JSON_BUILD_OBJECT(
              'id', d.id,
              'name', COALESCE(d.full_name, d.username),
              'phone', d.phone,
              'username', d.username,
              'email', d.email,
              'gstin', d.gstin,
              'referral_id', d.referral_code
            )
          ELSE NULL 
        END as distributor,
        COALESCE(
          (SELECT json_agg(items)::jsonb 
           FROM (
             SELECT 
               oi.id, oi.product_name, oi.product_image, 
               oi.variant_sku, oi.variant_details, 
               oi.qty, oi.unit_price, oi.total_item_price
             FROM order_items oi 
             WHERE oi.order_id = o.id
           ) items
          ), '[]'::jsonb
        ) as products
      FROM orders o 
      LEFT JOIN ecom_user u ON o.user_id = u.id
      LEFT JOIN users d ON o.distributor_id = d.id 
      WHERE o.order_id = $1 LIMIT 1;
    `;

    const dbResult = await db.query(orderQuery, [orderId]);
    const orderData = dbResult.rows[0];

    if (!orderData) {
      return res.status(404).json({
        success: false,
        message: "Order details record not found",
      });
    }

    if (
      req.user.role !== "Super Admin" &&
      orderData.order_status !== "delivered"
    ) {
      return res.status(202).json({
        success: false,
        message: "The invoice will be generated once the order is delivered.",
      });
    }

    // 🔹 1. GENERATE RECEIPT NO
    // Convert ORD-2606-C9105 -> FS-2606-RN-C9105
    let receiptNo = "";
    if (orderData.order_id) {
      receiptNo = orderData.order_id
        .replace(/^ORD-/, "FS-")
        .replace(/-([A-Z0-9]+)$/, "-RN-$1");
    } else {
      receiptNo = `FS-RN-${orderData.id}`;
    }

    // 🔹 2. GENERATE DYNAMIC INVOICE NO
    let invoiceNo = orderData.invoice_no;
    let finalSno = orderData.invoice_sno; // मान लेते हैं कि आप इसे भी स्टोर कर रहे हैं

    if (!invoiceNo) {
      // S.No Counter अपडेट करें (+11 इंक्रीमेंट लॉक के साथ)
      const seqRes = await db.query(
        "UPDATE invoice_settings SET last_sno = last_sno + 11 WHERE id = 1 RETURNING last_sno",
      );

      // पहली बार के लिए 1, अगली बार के लिए (1 + 11) = 12, फिर 23...
      const currentSno = seqRes.rows[0].last_sno - 11;
      finalSno = currentSno;

      // Date Format: Year (2627) और Month (06) निकालें
      const now = new Date();
      const currentYearShort = now.getFullYear().toString().slice(-2); // "26"
      const nextYearShort = (now.getFullYear() + 1).toString().slice(-2); // "27"
      const invoiceYearFormat = `${currentYearShort}${nextYearShort}`; // "2627"
      const invoiceMonthFormat = String(now.getMonth() + 1).padStart(2, "0"); // "06"

      // User Type Code: D = Distributor, C = Customer/User
      const typeCode = orderData.user_type === "Distributor" ? "D" : "C";

      // Combine Frame: FS-2627-06-IN-D137
      invoiceNo = `FS-${invoiceYearFormat}-${invoiceMonthFormat}-IN-${typeCode}${currentSno}`;

      // न्यूली जनरेटेड नंबर्स को orders टेबल में सेव करें
      await db.query(
        "UPDATE orders SET invoice_no = $1, receipt_no = $2 WHERE id = $3",
        [invoiceNo, receiptNo, orderData.id],
      );

      // स्थानीय ऑब्जेक्ट डेटा को अपडेट करें ताकि PDF में सही डेटा पास हो
      orderData.invoice_no = invoiceNo;
      orderData.receipt_no = receiptNo;
    }

    await db.query("COMMIT");

    const force =
      String(req.query.force || req.body?.force || "false").toLowerCase() ===
      "true";

    const templatePath = path.join(
      process.cwd(),
      "invoice_temp",
      "template.pdf",
    );

    // Call service layer supplying fetched database single row profile directly
    const result = await getOrCreateInvoicePdf({
      order: orderData,
      force,
      templatePath,
    });

    return res.json({
      success: true,
      statusCode: 200,
      url: result.url,
      created: result.created,
      data: {
        orderId: orderData.id,
        invoiceNo: orderData.invoice_no || `ORD_${orderData.id}`,
        created_at: orderData.created_at,
      },
      orderData: orderData,
    });
  } catch (err) {
    console.error("Invoice generation error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error generating dynamic order invoice",
    });
  }
}


const crypto = require("crypto");
async function downloadByEmail(req, res) {
  try {
    const { order_id, exp, sig } = req.body || req.query || {};



    if (!exp || !sig || Date.now() > Number(exp)) {
      return res.status(403).json({ error: "Link expired or missing parameters" });
    }


    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required to generate invoice - " + order_id,
      });
    }

    const dataToVerify = `${order_id}:${exp}`;
    const expectedSig = crypto
      .createHmac("sha256", process.env.URL_SIGN_SECRET)
      .update(dataToVerify)
      .digest("hex");



    // Secure constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expectedSig, "hex")
    );

    if (!isValid) {
      return res.status(403).json({ error: "Tampered or unauthorized request" });
    }

    // Fetch complete contextual single order profile matching database schema queries
    const orderQuery = `
      SELECT 
        o.*, 
        CASE 
          WHEN o.user_id IS NOT NULL THEN 'User'
          WHEN o.distributor_id IS NOT NULL THEN 'Distributor'
          ELSE 'Unknown'
        END as user_type,
        COALESCE(u.name, d.full_name, d.username) as user_name, 
        COALESCE(u.phone, d.phone) as user_phone,
        COALESCE(u.email, d.email) as user_email,
        COALESCE(d.gstin, 'N/A') as user_gstin,
        CASE 
          WHEN o.distributor_id IS NOT NULL THEN 
            JSON_BUILD_OBJECT(
              'id', d.id,
              'name', COALESCE(d.full_name, d.username),
              'phone', d.phone,
              'username', d.username,
              'email', d.email,
              'gstin', d.gstin,
              'referral_id', d.referral_code
            )
          ELSE NULL 
        END as distributor,
        COALESCE(
          (SELECT json_agg(items)::jsonb 
           FROM (
             SELECT 
               oi.id, oi.product_name, oi.product_image, 
               oi.variant_sku, oi.variant_details, 
               oi.qty, oi.unit_price, oi.total_item_price
             FROM order_items oi 
             WHERE oi.order_id = o.id
           ) items
          ), '[]'::jsonb
        ) as products
      FROM orders o 
      LEFT JOIN ecom_user u ON o.user_id = u.id
      LEFT JOIN users d ON o.distributor_id = d.id 
      WHERE o.order_id = $1 LIMIT 1;
    `;

    const dbResult = await db.query(orderQuery, [order_id]);
    const orderData = dbResult.rows[0];

    if (!orderData) {
      return res.status(404).json({
        success: false,
        message: "Order details record not found",
      });
    }

    if (
      orderData.order_status !== "delivered"
    ) {
      return res.status(202).json({
        success: false,
        message: "The invoice will be generated once the order is delivered.",
      });
    }

    // 🔹 1. GENERATE RECEIPT NO
    // Convert ORD-2606-C9105 -> FS-2606-RN-C9105
    let receiptNo = "";
    if (orderData.order_id) {
      receiptNo = orderData.order_id
        .replace(/^ORD-/, "FS-")
        .replace(/-([A-Z0-9]+)$/, "-RN-$1");
    } else {
      receiptNo = `FS-RN-${orderData.id}`;
    }

    // 🔹 2. GENERATE DYNAMIC INVOICE NO
    let invoiceNo = orderData.invoice_no;
    let finalSno = orderData.invoice_sno; // मान लेते हैं कि आप इसे भी स्टोर कर रहे हैं

    if (!invoiceNo) {
      // S.No Counter अपडेट करें (+11 इंक्रीमेंट लॉक के साथ)
      const seqRes = await db.query(
        "UPDATE invoice_settings SET last_sno = last_sno + 11 WHERE id = 1 RETURNING last_sno",
      );

      // पहली बार के लिए 1, अगली बार के लिए (1 + 11) = 12, फिर 23...
      const currentSno = seqRes.rows[0].last_sno - 11;
      finalSno = currentSno;

      // Date Format: Year (2627) और Month (06) निकालें
      const now = new Date();
      const currentYearShort = now.getFullYear().toString().slice(-2); // "26"
      const nextYearShort = (now.getFullYear() + 1).toString().slice(-2); // "27"
      const invoiceYearFormat = `${currentYearShort}${nextYearShort}`; // "2627"
      const invoiceMonthFormat = String(now.getMonth() + 1).padStart(2, "0"); // "06"

      // User Type Code: D = Distributor, C = Customer/User
      const typeCode = orderData.user_type === "Distributor" ? "D" : "C";

      // Combine Frame: FS-2627-06-IN-D137
      invoiceNo = `FS-${invoiceYearFormat}-${invoiceMonthFormat}-IN-${typeCode}${currentSno}`;

      // न्यूली जनरेटेड नंबर्स को orders टेबल में सेव करें
      await db.query(
        "UPDATE orders SET invoice_no = $1, receipt_no = $2 WHERE id = $3",
        [invoiceNo, receiptNo, orderData.id],
      );

      // स्थानीय ऑब्जेक्ट डेटा को अपडेट करें ताकि PDF में सही डेटा पास हो
      orderData.invoice_no = invoiceNo;
      orderData.receipt_no = receiptNo;
    }

    await db.query("COMMIT");

    const force =
      String(req.query.force || req.body?.force || "false").toLowerCase() ===
      "true";

    const templatePath = path.join(
      process.cwd(),
      "invoice_temp",
      "template.pdf",
    );

    // Call service layer supplying fetched database single row profile directly
    const result = await getOrCreateInvoicePdf({
      order: orderData,
      force,
      templatePath,
    });

    return res.json({
      success: true,
      statusCode: 200,
      url: result.url,
      created: result.created,
      data: {
        orderId: orderData.id,
        invoiceNo: orderData.invoice_no || `ORD_${orderData.id}`,
        created_at: orderData.created_at,
      },
      orderData: orderData,
    });
  } catch (err) {
    console.error("Invoice generation error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error generating dynamic order invoice",
    });
  }
}


module.exports = {
  generateInvoice,
  downloadByEmail
};
