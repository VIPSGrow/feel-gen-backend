const fs = require("fs/promises");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { ToWords } = require("to-words");
// Polyfill required by @pdf-lib/fontkit UMD build in some Node setups
// (fixes: ReferenceError: regeneratorRuntime is not defined)
require("regenerator-runtime/runtime");

// 1. Import fontkit
const fontkit = require("@pdf-lib/fontkit");

function safeSegment(input) {
  const str = String(input ?? "");
  return str.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 120);
}

// 2. Initialize it with Indian Locale configuration
const toWords = new ToWords({
  localeCode: "en-IN",
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: false,
    currencyOptions: {
      // Overrides default "Rupee" to "RUPEES"
      name: "Rupee",
      plural: "Rupees",
      symbol: "₹",
      fractionalUnit: {
        name: "Paisa",
        plural: "Paisa",
        symbol: "",
      },
    },
  },
});

// Custom Helper to transform amount to Indian Currency English words format
// 3. Updated clean wrapper function
function convertAmountToWords(amount) {
  try {
    // toWords.convert(100268.00) outputs: "One Lakh Two Hundred Sixty Eight Rupees Only"
    return toWords.convert(Number(amount)).toUpperCase();
  } catch (e) {
    console.error("Error converting number to words:", e);
    return "N/A";
  }
}
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getOrCreateInvoicePdf({ order, force = false }) {
  // console.log("Generating invoice PDF for order:", order);
  const appUrl = process.env.APP_URL || "";
  const orderIdStr = String(order.id || "");
  const u = safeSegment(order.user_id || order.distributor_id || "guest");
  const i = safeSegment(orderIdStr);

  const orderDate = order.created_at
    ? new Date(order.created_at).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const invoiceKey = order.order_id ? safeSegment(order.order_id) : i;

  const uploadDir = path.join(
    process.cwd(),
    "uploads",
    "invoices",
    u,
    invoiceKey,
  );
  const destPdfPath = path.join(uploadDir, "invoice.pdf");
  const publicUrl = `${appUrl}/uploads/invoices/${u}/${encodeURIComponent(
    invoiceKey,
  )}/invoice.pdf`;

  const exists = await fileExists(destPdfPath);
  if (exists && !force) {
    return { created: false, url: publicUrl, filePath: destPdfPath };
  }

  await ensureDir(uploadDir);

  const pdfDoc = await PDFDocument.create();

  // 2. Register fontkit instance to your PDF document
  pdfDoc.registerFontkit(fontkit);

  // 3. Load and embed your Hindi Font file
  // Adjust this path to wherever you store your custom font
  const fontPath = path.join(
    process.cwd(),
    "assets",
    "fonts",
    "NotoSansDevanagari-Regular.ttf",
  );
  const fontBytes = await fs.readFile(fontPath);
  const customHindiFont = await pdfDoc.embedFont(fontBytes);

  let embeddedWatermark = null;
  let embeddedPaymentQR = null;
  let embeddedWebsiteQR = null;

  // Load Watermark PNG
  try {
    const watermarkPath = path.join(
      process.cwd(),
      "assets",
      "image",
      "image4.png",
    );
    const watermarkBytes = await fs.readFile(watermarkPath);
    embeddedWatermark = await pdfDoc.embedPng(watermarkBytes);
  } catch (err) {
    console.warn("Watermark image missing at - ", err);
  }

  // Load Payment QR PNG
  try {
    const paymentQRPath = path.join(
      process.cwd(),
      "assets",
      "image",
      "bank.png",
    );
    const paymentQRBytes = await fs.readFile(paymentQRPath);
    embeddedPaymentQR = await pdfDoc.embedPng(paymentQRBytes);
  } catch (err) {
    console.warn("Payment QR missing at /assets/image/payment-qr.png");
  }

  // Load Website QR PNG
  try {
    const websiteQRPath = path.join(
      process.cwd(),
      "assets",
      "image",
      "website.png",
    );
    const websiteQRBytes = await fs.readFile(websiteQRPath);
    embeddedWebsiteQR = await pdfDoc.embedPng(websiteQRBytes);
  } catch (err) {
    console.warn("Website QR missing at /assets/image/website-qr.png");
  }

  const page = pdfDoc.addPage([595.27, 841.89]);
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // =================================================================
  // 3. BACKGROUND LAYER LAYER: RENDER WATERMARK FIRST
  // =================================================================
  if (embeddedWatermark) {
    const watermarkWidth = 320;
    const watermarkHeight = 320;
    page.drawImage(embeddedWatermark, {
      x: (page.getWidth() - watermarkWidth) / 2,
      y: (page.getHeight() - watermarkHeight) / 2 + 30, // Offset vertically to align with image template center
      width: watermarkWidth,
      height: watermarkHeight,
      opacity: 0.1, // Transparent, doesn't clash with table text
    });
  }

  // 4. Update helper helper to seamlessly fallback or explicitly use custom fonts
  const drawText = (
    text,
    x,
    y,
    size = 8,
    isBold = false,
    color = rgb(0, 0, 0),
    useHindiFont = false,
  ) => {
    if (text !== undefined && text !== null) {
      let chosenFont = isBold ? fontHelveticaBold : fontHelvetica;
      if (useHindiFont) {
        chosenFont = customHindiFont; // Swaps out to Hindi mapping system
      }

      page.drawText(String(text), {
        x,
        y,
        size,
        font: chosenFont,
        color,
      });
    }
  };

  const drawLine = (x1, y1, x2, y2, thickness = 0.5, color = rgb(0, 0, 0)) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color,
    });
  };

  const drawRect = (
    x,
    y,
    width,
    height,
    thickness = 0.5,
    color = rgb(0, 0, 0),
  ) => {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderWidth: thickness,
      borderColor: color,
      color: rgb(1, 1, 1, 0),
    });
  };

  // Main Outer Box Frame
  drawRect(30, 40, 535, 765, 0.75, rgb(0.2, 0.2, 0.2));

  // --- HEADER BRANDING ---
  drawText(
    "FEEL SAFE PRIVATE LIMITED",
    145,
    780,
    18,
    true,
    rgb(0.42, 0.16, 0.54),
  );
  drawText("Original For Recipient", 475, 782, 7.5, true, rgb(50/255,205/255,50/255));

  drawText(
    "OFFICE ADDRESS: Pole No.17, Kharkhari Nahar, Near MCD School,",
    155,
    768,
    8,
    true,
  );
  drawText(
    "Najafgarh, South West, New Delhi, Delhi – 110043.",
    200,
    757,
    8,
    true,
  );
  drawText(
    "27x7 Helpline no. +91 9013499385 | Email: support@feelsafeco.in | Website: feelsafeco.in",
    130,
    745,
    8,
    false,
    rgb(0, 0, 1),
  );

  drawText("CIN- U13996DL2026PTC465812", 440, 733, 8, true);
  drawText("BILL OF SUPPLY", 255, 725, 12, true, rgb(0.42, 0.16, 0.54));
  drawText("GSTIN:- 07AAHCF0020FIZA", 440, 721, 8, true);

  // --- METADATA SECTION ---
  let metaY = 712;
  drawLine(30, metaY, 565, metaY, 0.5);
  drawLine(310, metaY, 310, metaY - 45, 0.5);

  drawText("Sakhi Distributor ID No.:", 35, metaY - 11, 8, true);
  drawText(order.distributor.referral_id || "N/A", 150, metaY - 11, 8);
  drawLine(30, metaY - 15, 310, metaY - 15, 0.5);

  drawText("Order No:", 35, metaY - 26, 8, true);
  drawText(order.order_id || "-", 85, metaY - 26, 8);
  drawLine(30, metaY - 30, 310, metaY - 30, 0.5);

  drawText("Receipt No:", 35, metaY - 41, 8, true);
  drawText(order.receipt_no || order.order_id || orderIdStr, 85, metaY - 41, 8);

  drawText("Invoice Date:", 315, metaY - 11, 8, true);
  drawLine(310, metaY - 15, 565, metaY - 15, 0.5);
  drawText(orderDate, 410, metaY - 11, 8);

  drawText("Invoice No:", 315, metaY - 26, 8, true);
  drawText(
    order.invoice_no || order.order_id || orderIdStr,
    410,
    metaY - 26,
    8,
  );
  drawLine(310, metaY - 30, 565, metaY - 30, 0.5);
  drawText("State Name Code:", 315, metaY - 41, 8, true);
  drawText(order.state_name_code || "N/A", 410, metaY - 41, 8);

  metaY -= 45;
  drawLine(30, metaY, 565, metaY, 0.5);

  // --- SHIPPING & BILLING ADDRESS ---
  drawLine(300, metaY, 300, metaY - 120, 0.5);

  drawText("Residential Address:", 35, metaY - 12, 9, true, rgb(0.2, 0.4, 0.6));
  drawText(
    "Bill & Shipping Address:",
    305,
    metaY - 12,
    9,
    true,
    rgb(0.2, 0.4, 0.6),
  );
  drawLine(30, metaY - 16, 565, metaY - 16, 0.5);

  const labels = [
    "Name:",
    "Address:",
    "State:",
    "Pin code:",
    "Phone No:",
    "Email ID:",
    "GSTIN:",
  ];
  let labelOffset = metaY - 26;

  const shipping = order.shipping_address || {};
  const billing = order.billing_address || shipping;

  const leftVals = [
    order.user_name || billing.full_name || "",
    (billing.address_line1 || "") + " " + (billing.address_line2 || ""),
    billing.state || "",
    billing.pincode || "",
    order.user_phone || billing.phone || "",
    order.user_email || billing.email || "",
    order.user_gstin || billing.gstin || "",
  ];

  const rightVals = [
    shipping.full_name || order.user_name || "",
    (shipping.address_line1 || "") + " " + (shipping.address_line2 || ""),
    shipping.state || "",
    shipping.pincode || "",
    shipping.phone || order.user_phone || "",
    order.user_email || "",
    shipping.gstin || "",
  ];

  for (let idx = 0; idx < labels.length; idx++) {
    drawText(labels[idx], 35, labelOffset, 8);
    drawText(String(leftVals[idx]), 85, labelOffset, 8);

    drawText(labels[idx], 305, labelOffset, 8);
    drawText(String(rightVals[idx]), 355, labelOffset, 8);

    drawLine(
      30,
      labelOffset - 3,
      565,
      labelOffset - 3,
      0.25,
      rgb(0.8, 0.8, 0.8),
    );
    labelOffset -= 13;
  }

  metaY -= 120;
  drawLine(30, metaY, 565, metaY, 0.5);

  // --- TRANSACTION SUMMARY TABLE ---
  let tableY = metaY - 15;
  drawText(
    "Transaction Summary",
    240,
    tableY + 4,
    10,
    true,
    rgb(0.42, 0.16, 0.54),
  );
  drawLine(30, tableY, 565, tableY, 0.5);

  const cols = [30, 65, 120, 170, 205, 250, 305, 375, 445, 515, 565];

  drawText("S. No.", 33, tableY - 16, 8, true);
  drawText("Product", 73, tableY - 11, 8, true);
  drawText("Details", 74, tableY - 21, 8, true);
  drawText("HSN code", 124, tableY - 16, 8, true);
  drawText("QTY", 177, tableY - 16, 8, true);
  drawText("Unit", 215, tableY - 11, 8, true);
  drawText("Price", 214, tableY - 21, 8, true);
  drawText("Net", 267, tableY - 11, 8, true);
  drawText("Amount", 260, tableY - 21, 8, true);

  drawText("CGST", 332, tableY - 10, 8, true);
  drawLine(305, tableY - 14, 375, tableY - 14, 0.5);
  drawText("Rate", 311, tableY - 23, 7, true);
  drawText("Amt.", 344, tableY - 23, 7, true);
  drawLine(340, tableY - 14, 340, tableY - 26, 0.5);

  drawText("SGST", 402, tableY - 10, 8, true);
  drawLine(375, tableY - 14, 445, tableY - 14, 0.5);
  drawText("Rate", 381, tableY - 23, 7, true);
  drawText("Amt.", 414, tableY - 23, 7, true);
  drawLine(410, tableY - 14, 410, tableY - 26, 0.5);

  drawText("IGST", 472, tableY - 10, 8, true);
  drawLine(445, tableY - 14, 515, tableY - 14, 0.5);
  drawText("Rate", 451, tableY - 23, 7, true);
  drawText("Amt.", 484, tableY - 23, 7, true);
  drawLine(480, tableY - 14, 480, tableY - 26, 0.5);

  drawText("Grand Total", 520, tableY - 16, 8, true);

  tableY -= 26;
  drawLine(30, tableY, 565, tableY, 0.5);

  const productsList = order.products || [];
  let totalNetAmount = 0;
  let totalGrandAmount = 0;

  productsList.forEach((item, index) => {
    const qty = Number(item.qty || 1);
    const price = Number(item.unit_price || item.price || 0);
    const netAmt = price * qty;

    const isInterstate = String(shipping.state || "").toLowerCase() !== "delhi";
    const taxRate = Number(item.variant_details?.tax_data?.percentage || 0);

    let cgstR = "-",
      cgstA = "-",
      sgstR = "-",
      sgstA = "-",
      igstR = "-",
      igstA = "-";
    let taxAmount = netAmt * (taxRate / 100);

    if (isInterstate) {
      igstR = `${taxRate}%`;
      igstA = taxAmount.toFixed(2);
    } else {
      cgstR = `${taxRate / 2}%`;
      cgstA = (taxAmount / 2).toFixed(2);
      sgstR = `${taxRate / 2}%`;
      sgstA = (taxAmount / 2).toFixed(2);
    }

    const itemGrandTotal = netAmt + taxAmount;
    totalNetAmount += netAmt;
    totalGrandAmount += itemGrandTotal;

    drawText(String(index + 1), 43, tableY - 14, 8);
    drawText(
      String(item.product_name || "Product").slice(0, 10),
      68,
      tableY - 14,
      7.5,
    );
    drawText(String(item.variant_sku || "5407"), 123, tableY - 14, 7.5);
    drawText(String(qty), 182, tableY - 14, 8);
    drawText(price.toFixed(2), 210, tableY - 14, 8);
    drawText(netAmt.toFixed(2), 255, tableY - 14, 8);

    drawText(cgstR, 310, tableY - 14, 7.5);
    drawText(cgstA, 343, tableY - 14, 7.5);
    drawText(sgstR, 380, tableY - 14, 7.5);
    drawText(sgstA, 413, tableY - 14, 7.5);
    drawText(igstR, 450, tableY - 14, 7.5);
    drawText(igstA, 483, tableY - 14, 7.5);

    drawText(itemGrandTotal.toFixed(2), 520, tableY - 14, 8, true);

    tableY -= 20;
    drawLine(30, tableY, 565, tableY, 0.25, rgb(0.8, 0.8, 0.8));
  });

  cols.forEach((x) => drawLine(x, metaY - 15, x, tableY, 0.5));

  // shipping_charges
  tableY -= 20;
  drawLine(30, tableY, 565, tableY, 0.5);

  const shippingCharges = Number(order.shipping_charges || 0);

  totalNetAmount += shippingCharges;
  totalGrandAmount += shippingCharges;

  drawText("Shipping Charge", 75, tableY + 8, 8, true);
  drawText(shippingCharges.toFixed(2), 255, tableY + 8, 8, true);
  drawText(shippingCharges.toFixed(2), 520, tableY + 8, 8, true);

  // --- TOTAL ROW ---
  drawText("Grand Total", 75, tableY - 14, 8, true);
  drawText(totalNetAmount.toFixed(2), 255, tableY - 14, 8, true);
  drawText(totalGrandAmount.toFixed(2), 520, tableY - 14, 8, true);

  tableY -= 20;
  drawLine(30, tableY, 565, tableY, 0.5);

  drawLine(340, tableY, 340, tableY - 20, 0.5);
  drawLine(515, tableY, 515, tableY - 20, 0.5);
  drawText("Invoice Value (In Words)", 35, tableY - 10, 8, true);

  const wordsText = convertAmountToWords(totalGrandAmount);
  // Wrap text neatly if it gets too long for the structural grid boundary (max 300px wide)
  if (wordsText.length > 55) {
    drawText(wordsText.slice(0, 55), 35, tableY - 16, 6.5, false);
    // extend down slightly if a wrap occurs
  } else {
    drawText(wordsText, 35, tableY - 17, 6.5, false, rgb(0.3, 0.3, 0.3));
  }

  drawText("Invoice Total", 345, tableY - 14, 8, true);
  drawText(totalGrandAmount.toFixed(2), 520, tableY - 14, 8, true);

  tableY -= 20;
  drawLine(30, tableY, 565, tableY, 0.5);

  // --- CORPORATE BANKING INFO & HINDI TEXT FIX ---
  let bankY = tableY - 15;
  drawText("Account Holder: FEEL SAFE PRIVATE LIMITED", 35, bankY, 9, true);
  drawText("Account Number: 50200120760164", 35, bankY - 13, 9, true);
  drawText("IFSC: HDFC0000438", 35, bankY - 26, 9, true);
  drawText("Branch: NAJAFGARH", 35, bankY - 39, 9, true);
  drawText("Account Type: Current Account", 35, bankY - 52, 9, true);

  
  // Dynamically Draw Payment QR Image or fall back to an outline placeholder
  if (embeddedPaymentQR) {
    page.drawImage(embeddedPaymentQR, {
      x: 345,
      y: bankY - 52,
      width: 65,
      height: 65,
    });
    drawText("Payment QR Code", 343, bankY - 62, 7, true, rgb(0, 0, 1));
  } else {
    drawRect(340, bankY - 60, 75, 70, 0.5);
    drawText(
      "[No Payment QR]",
      346,
      bankY - 30,
      6.5,
      false,
      rgb(0.5, 0.5, 0.5),
    );
    drawText("Payment QR Code", 343, bankY - 70, 7, true, rgb(0, 0, 1));
  }

  // Dynamically Draw Website QR Image or fall back to an outline placeholder
  if (embeddedWebsiteQR) {
    page.drawImage(embeddedWebsiteQR, {
      x: 455,
      y: bankY - 52,
      width: 65,
      height: 65,
    });
    drawText("Website QR", 468, bankY - 62, 7, true, rgb(0, 0, 1));
  } else {
    drawRect(450, bankY - 60, 75, 70, 0.5);
    drawText(
      "[No Website QR]",
      457,
      bankY - 30,
      6.5,
      false,
      rgb(0.5, 0.5, 0.5),
    );
    drawText("Website QR", 468, bankY - 70, 7, true, rgb(0, 0, 1));
  }

  tableY -= 95;
  drawLine(30, tableY, 565, tableY, 0.5);

  // --- TERMS AND CONDITIONS ---
  const disclaimers = [
    "Returns: Due to hygiene standards, goods once sold cannot be returned. Replacement is available only for manufacturing defects reported within 3 days of delivery.",
    "Video Proof: To claim a replacement, a clear and unedited unboxing video and photos of the package must be emailed to support@feelsafeco.in.",
    "Sakhi Buyback: Return and Buyback policies for registered Sakhis and Distributors are strictly applicable as per the terms on our official website feelsafeco.in.",
    "Support: For any product, delivery, support-related queries, email us at support@feelsafeco.in.",
    "Compliance: This invoice is fully subject to the guidelines of Feel Safe Sakhi Yojana and government direct selling regulations.",
    "Payments: Payments must be made only to the company's designated HDFC Bank account, official QR code, or Razorpay on feelsafeco.in. Company is not liable for any cash transactions.",
    "Jurisdiction: All legal disputes are subject to the exclusive jurisdiction of the courts near the Company's Registered Office in Najafgarh, New Delhi only.",
    "Digital Bill: This is a computer-generated document, so it is legally valid without any physical signature.",
  ];

  let discY = tableY - 12;
  drawText("Declaration", 35, discY, 9, true);
  discY = discY - 10;
  disclaimers.forEach((line) => {
    if (line.length > 130) {
      drawText(
        "• " + line.slice(0, 130),
        40,
        discY,
        6.5,
        false,
        rgb(0.2, 0.2, 0.2),
      );
      discY -= 9;
      drawText(line.slice(130), 47, discY, 6.5, false, rgb(0.2, 0.2, 0.2));
    } else {
      drawText("• " + line, 40, discY, 6.5, false, rgb(0.2, 0.2, 0.2));
    }
    discY -= 9;
  });

  // --- HELP BOX FOOTER NOTE ---
  drawRect(40, 48, 515, 26, 0.5);
  drawText(
    "Note: Please save/print this receipt for future reference. For assistance under the Feel Safe Sakhi Yojana, visit feelsafeco.in",
    45,
    62,
    7.5,
    true,
    rgb(0.7, 0.1, 0.1),
  );
  drawText(
    "or mail us at support@feelsafeco.in +91 9013499385",
    45,
    52,
    7.5,
    true,
    rgb(0, 0, 1),
  );

  drawText(
    "This is a computer generated document. No signature is required.",
    195,
    12,
    8,
    true,
  );

  const finalPdfBytes = await pdfDoc.save();
  await fs.writeFile(destPdfPath, finalPdfBytes);

  return { created: true, url: publicUrl, filePath: destPdfPath };
}

module.exports = { getOrCreateInvoicePdf };
