const fs = require("fs/promises");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { ToWords } = require("to-words");
require("regenerator-runtime/runtime");

const fontkit = require("@pdf-lib/fontkit");

function safeSegment(input) {
  const str = String(input ?? "");
  return str.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 120);
}

const toWords = new ToWords({
  localeCode: "en-IN",
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: false,
    currencyOptions: {
      name: "Rupee",
      plural: "Rupees",
      symbol: "Rs. ",
      fractionalUnit: {
        name: "Paisa",
        plural: "Paisa",
        symbol: "",
      },
    },
  },
});

function convertAmountToWords(amount) {
  try {
    return toWords.convert(Number(amount || 0));
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
  const appUrl = process.env.APP_URL || "";
  const orderIdStr = String(order.id || "");
  const u = safeSegment(order.user_id || order.distributor_id || "guest");
  const i = safeSegment(orderIdStr);

  const orderDate = order.created_at
    ? new Date(order.created_at)
        .toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
        .replace(/ /g, "/")
        .toUpperCase()
    : new Date().toISOString().split("T")[0];

  const invoiceKey = order.order_id ? safeSegment(order.order_id) : i;

  const uploadDir = path.join(process.cwd(), "uploads", "invoices", u, invoiceKey);
  const destPdfPath = path.join(uploadDir, "invoice.pdf");
  const publicUrl = `${appUrl}/uploads/invoices/${u}/${encodeURIComponent(invoiceKey)}/invoice.pdf`;

  const exists = await fileExists(destPdfPath);
  if (exists && !force) {
    return { created: false, url: publicUrl, filePath: destPdfPath };
  }

  await ensureDir(uploadDir);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontPath = path.join(process.cwd(), "assets", "fonts", "NotoSansDevanagari-Regular.ttf");
  let customHindiFont = null;
  try {
    const fontBytes = await fs.readFile(fontPath);
    customHindiFont = await pdfDoc.embedFont(fontBytes);
  } catch (e) {
    console.warn("Hindi font missing, falling back to standard fonts.");
  }

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Assets load
  let embeddedWatermark = null;
  let embeddedPaymentQR = null;
  let embeddedWebsiteQR = null;
  let embeddedStamp = null;

  try {
    const watermarkBytes = await fs.readFile(path.join(process.cwd(), "assets", "image", "image4.png"));
    embeddedWatermark = await pdfDoc.embedPng(watermarkBytes);
  } catch (err) {}

  try {
    const paymentQRBytes = await fs.readFile(path.join(process.cwd(), "assets", "image", "bank.png"));
    embeddedPaymentQR = await pdfDoc.embedPng(paymentQRBytes);
  } catch (err) {}

  try {
    const websiteQRBytes = await fs.readFile(path.join(process.cwd(), "assets", "image", "website.png"));
    embeddedWebsiteQR = await pdfDoc.embedPng(websiteQRBytes);
  } catch (err) {}

  // Load Stamp Image
  try {
    const stampBytes = await fs.readFile(path.join(process.cwd(), "assets", "image", "stamp.png"));
    embeddedStamp = await pdfDoc.embedPng(stampBytes);
  } catch (err) {
    console.warn("Stamp image missing at /assets/image/stamp.png");
  }

  const page = pdfDoc.addPage([595.27, 841.89]);

  // Background Watermark
  if (embeddedWatermark) {
    const wmWidth = 320;
    const wmHeight = 320;
    page.drawImage(embeddedWatermark, {
      x: (page.getWidth() - wmWidth) / 2,
      y: (page.getHeight() - wmHeight) / 2 - 30,
      width: wmWidth,
      height: wmHeight,
      opacity: 0.12,
    });
  }

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
      if (useHindiFont && customHindiFont) chosenFont = customHindiFont;

      const sanitized = String(text).replace(/₹/g, "Rs. ");

      page.drawText(sanitized, {
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

  const drawRect = (x, y, width, height, thickness = 0.5, color = rgb(0, 0, 0)) => {
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

  const leftX = 30;
  const rightX = 565;
  const totalW = rightX - leftX;
  drawRect(leftX, 35, totalW, 775, 1, rgb(0, 0, 0));

  // --- HEADER SECTION ---
  drawText("FEEL SAFE PRIVATE LIMITED", 130, 782, 20, true, rgb(0.42, 0.16, 0.54));
  drawText("Original For Recipient", 445, 784, 8, true, rgb(0, 0.6, 0.2));

  drawText("OFFICE ADDRESS: Pole No.17, Kharkhari Nahar, Near MCD School,", 150, 770, 7.5, true);
  drawText("Najafgarh, South West, New Delhi, Delhi - 110043.", 200, 760, 7.5, true);
  drawText("27x7 Helpline no. +91 9013499385 | Email: support@feelsafeco.in | Website: feelsafeco.in", 125, 749, 7.5, false, rgb(0, 0, 0.8));

  drawText("CIN- U13996DL2026PTC465812", 420, 737, 7.5, true);
  drawText("BILL OF SUPPLY", 240, 730, 11, true, rgb(0.42, 0.16, 0.54));
  drawText("GSTIN:- 07AAHCF0020F1ZA", 420, 725, 7.5, true);

  // --- METADATA SECTION ---
  let curY = 716;
  drawLine(leftX, curY, rightX, curY, 0.75);

  const midX = 310;
  drawLine(midX, curY, midX, curY - 45, 0.5);

  drawText("Sakhi Distributor ID No.:", 33, curY - 11, 7.5, true);
  drawText(order.distributor?.referral_id || order.referral_id || "N/A", 160, curY - 11, 8, true);
  drawLine(leftX, curY - 15, midX, curY - 15, 0.5);

  drawText("Order No:", 33, curY - 26, 7.5, true);
  drawText(order.order_id || "-", 160, curY - 26, 8, true);
  drawLine(leftX, curY - 30, midX, curY - 30, 0.5);

  drawText("Receipt No:", 33, curY - 41, 7.5, true);
  drawText(order.receipt_no || order.order_id || orderIdStr, 160, curY - 41, 8, true);

  drawText("Invoice Date:", midX + 5, curY - 11, 7.5, true);
  drawText(orderDate, midX + 105, curY - 11, 8, true);
  drawLine(midX, curY - 15, rightX, curY - 15, 0.5);

  drawText("Invoice No:", midX + 5, curY - 26, 7.5, true);
  drawText(order.invoice_no || order.order_id || orderIdStr, midX + 105, curY - 26, 8, true);
  drawLine(midX, curY - 30, rightX, curY - 30, 0.5);

  drawText("State Name Code:", midX + 5, curY - 41, 7.5, true);
  drawText(order.state_name_code || "07", midX + 105, curY - 41, 8, true);

  curY -= 45;
  drawLine(leftX, curY, rightX, curY, 0.75);

  // --- ADDRESS SECTION ---
  const addrHeight = 100;
  drawLine(midX, curY, midX, curY - addrHeight, 0.5);

  drawText("Buyer (Bill to):", 35, curY - 12, 8.5, true, rgb(0.1, 0.35, 0.7));
  drawText("Consignee (Ship to):", midX + 5, curY - 12, 8.5, true, rgb(0.1, 0.35, 0.7));
  drawLine(leftX, curY - 16, rightX, curY - 16, 0.5);

  const addressLabels = [
    "Name:",
    "Address:",
    "State:",
    "Pin code:",
    "Phone No:",
    "Email ID:",
    "GSTIN:",
  ];

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

  let addrRowY = curY - 25;
  for (let idx = 0; idx < addressLabels.length; idx++) {
    drawText(addressLabels[idx], 35, addrRowY, 7.5);
    drawText(String(leftVals[idx] || "").slice(0, 38), 85, addrRowY, 7.5);

    drawText(addressLabels[idx], midX + 5, addrRowY, 7.5);
    drawText(String(rightVals[idx] || "").slice(0, 38), midX + 55, addrRowY, 7.5);

    drawLine(leftX, addrRowY - 2.5, rightX, addrRowY - 2.5, 0.25, rgb(0.7, 0.7, 0.7));
    addrRowY -= 12;
  }

  curY -= addrHeight;
  drawLine(leftX, curY, rightX, curY, 0.75);

  // --- TRANSACTION SUMMARY HEADER ---
  drawText("Transaction Summary", 240, curY - 10, 9, true, rgb(0.42, 0.16, 0.54));
  curY -= 14;
  drawLine(leftX, curY, rightX, curY, 0.5);

  const tCols = [leftX, 65, 205, 255, 305, 350, 400, 450, rightX];

  drawText("S. No.", 33, curY - 11, 7, true);
  drawText("Description of Goods", 100, curY - 11, 7, true);
  drawText("HSN/SAC", 212, curY - 11, 7, true);
  drawText("MRP./", 268, curY - 8, 6.5, true);
  drawText("Marginal", 264, curY - 16, 6.5, true);
  drawText("Quantity", 312, curY - 8, 6.5, true);
  drawText("package", 312, curY - 16, 6.5, true);
  drawText("Rate", 368, curY - 11, 7, true);
  drawText("Piece/", 413, curY - 8, 6.5, true);
  drawText("package", 410, curY - 16, 6.5, true);
  drawText("Amount", 488, curY - 11, 7, true);

  const tableHeaderBottom = curY - 20;
  drawLine(leftX, tableHeaderBottom, rightX, tableHeaderBottom, 0.5);

  // --- PRODUCT ROWS ---
  const productsList = order.products || [];
  let itemY = tableHeaderBottom;
  let totalQtyPackages = 0;
  let totalPieces = 0;
  let grossAmount = 0;

  const minRows = 7;
  const rowCount = Math.max(productsList.length, minRows);

  for (let idx = 0; idx < rowCount; idx++) {
    const item = productsList[idx];
    const rowY = itemY - 13;

    if (item) {
      const qty = Number(item.quantity_packages || item.qty || 1);
      const rate = Number(item.rate || item.unit_price || item.price || 0);
      const mrp = Number(item.mrp || rate);
      const pieces = Number(item.pieces_per_package || item.piece_count || 10);
      const amount = qty * rate;

      totalQtyPackages += qty;
      totalPieces += qty * pieces;
      grossAmount += amount;

      drawText(String(idx + 1) + ".", 45, rowY, 7.5);
      drawText(String(item.product_name || item.name || "Product").slice(0, 30), 70, rowY, 7.5);
      drawText(String(item.hsn_sac || item.variant_sku || "96190010"), 212, rowY, 7.5);
      drawText(`Rs. ${mrp.toFixed(2)}`, 260, rowY, 7.5);
      drawText(String(qty), 325, rowY, 7.5);
      drawText(`Rs. ${rate.toFixed(2)}`, 355, rowY, 7.5);
      drawText(String(pieces), 422, rowY, 7.5);
      drawText(`Rs. ${amount.toFixed(2)}`, 485, rowY, 7.5);
    } else {
      drawText(String(idx + 1) + ".", 45, rowY, 7.5);
    }

    itemY -= 16;
  }

  tCols.forEach((colX) => drawLine(colX, curY, colX, itemY, 0.5));
  drawLine(leftX, itemY, rightX, itemY, 0.5);

  // --- GRAND TOTAL ROW ---
  drawText("Grand Total", 170, itemY - 11, 8, true);
  drawText(String(totalQtyPackages), 325, itemY - 11, 8, true);
  drawText(String(totalPieces), 422, itemY - 11, 8, true);
  drawText(`Rs. ${grossAmount.toFixed(2)}`, 485, itemY - 11, 8, true);

  drawLine(leftX, itemY - 16, rightX, itemY - 16, 0.5);
  drawLine(305, itemY, 305, itemY - 16, 0.5);
  drawLine(350, itemY, 350, itemY - 16, 0.5);
  drawLine(400, itemY, 400, itemY - 16, 0.5);
  drawLine(450, itemY, 450, itemY - 16, 0.5);
  itemY -= 16;

  // --- COUPONS ROW ---
  const couponDiscount = Number(order.coupon_discount || order.discount_amount || 0);
  const couponCode = order.coupon_code || (couponDiscount > 0 ? "COUPON APPLIED" : "-");
  const couponPercentage = order.coupon_percentage ? `${order.coupon_percentage}%` : "";

  drawText("Coupons:- " + (couponDiscount > 0 ? "Yes" : "No"), 35, itemY - 11, 7.5, true, rgb(0, 0.5, 0.2));
  if (couponDiscount > 0) {
    drawText(couponCode, 150, itemY - 11, 7.5, true, rgb(0, 0.5, 0.2));
    drawText(couponPercentage, 210, itemY - 11, 7.5, true, rgb(0, 0.5, 0.2));
  }
  drawLine(450, itemY, 450, itemY - 16, 0.5);
  drawText("-", 470, itemY - 11, 8, false, rgb(0, 0.5, 0.2));
  drawText(couponDiscount.toFixed(2), 505, itemY - 11, 7.5, true, rgb(0, 0.5, 0.2));

  drawLine(leftX, itemY - 16, rightX, itemY - 16, 0.5);
  itemY -= 16;

  // --- TAX EXEMPT ROW ---
  const finalPayable = Number(order.final_amount || (grossAmount - couponDiscount) + Number(order.shipping_charges || 0));
  drawText("Sanitary Pad HSN/SAC 96190010 TAX RATE EXEMPT", 175, itemY - 11, 7.5, true, rgb(0.85, 0.1, 0.1));
  drawLine(450, itemY, 450, itemY - 16, 0.5);
  drawText(finalPayable.toFixed(2), 505, itemY - 11, 8, true);

  drawLine(leftX, itemY - 16, rightX, itemY - 16, 0.5);
  itemY -= 16;

  // --- AMOUNT IN WORDS + EO&E ---
  const wordsVal = convertAmountToWords(finalPayable);
  drawText("Amount Chargeable (in words) INR " + wordsVal, 35, itemY - 11, 7.5, true);
  drawLine(470, itemY, 470, itemY - 16, 0.5);
  drawText("E. & O.E", 495, itemY - 11, 7.5, true);

  drawLine(leftX, itemY - 16, rightX, itemY - 16, 0.5);
  itemY -= 16;

  // --- BANK DETAILS & QR CODES ROW ---
  const bankBlockH = 55;
  const qrDivider1 = 300;
  const qrDivider2 = 390;
  const qrDivider3 = 470;

  drawLine(qrDivider1, itemY, qrDivider1, itemY - bankBlockH, 0.5);
  drawLine(qrDivider2, itemY, qrDivider2, itemY - bankBlockH, 0.5);
  drawLine(qrDivider3, itemY, qrDivider3, itemY - bankBlockH, 0.5);

  drawText("Account Holder: FEEL SAFE PRIVATE LIMITED,", 35, itemY - 12, 7.5, true);
  drawText("Account Number: 50200120760164, IFSC: HDFC0000438,", 35, itemY - 24, 7.5, true);
  drawText("Branch: NAJAFGARH, Account Type: Current Account,", 35, itemY - 36, 7.5, true);

  // Payment QR
  if (embeddedPaymentQR) {
    page.drawImage(embeddedPaymentQR, {
      x: qrDivider1 + 10,
      y: itemY - bankBlockH + 12,
      width: 45,
      height: 40,
    });
    drawText("Payment QR Code", qrDivider1 + 5, itemY - bankBlockH + 4, 6, true, rgb(0.1, 0.35, 0.7));
  }

  // Website QR
  if (embeddedWebsiteQR) {
    page.drawImage(embeddedWebsiteQR, {
      x: qrDivider2 + 15,
      y: itemY - bankBlockH + 12,
      width: 45,
      height: 40,
    });
    drawText("Website QR", qrDivider2 + 20, itemY - bankBlockH + 4, 6, true, rgb(0.1, 0.35, 0.7));
  }

  drawLine(leftX, itemY - bankBlockH, rightX, itemY - bankBlockH, 0.5);
  itemY -= bankBlockH;

  // --- DECLARATION SECTION ---
  drawText("Declaration", 60, itemY - 10, 8, true);

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

  let discY = itemY - 22;
  disclaimers.forEach((line, dIdx) => {
    drawText(`${dIdx + 1}.`, 45, discY, 6, true);
    if (line.length > 135) {
      drawText(line.slice(0, 135), 58, discY, 7.8, false, rgb(0.2, 0.2, 0.2));
      discY -= 7.5;
      drawText(line.slice(135), 58, discY, 7.8, false, rgb(0.2, 0.2, 0.2));
    } else {
      drawText(line, 58, discY, 7.8, false, rgb(0.2, 0.2, 0.2));
    }
    discY -= 8;
  });

  // --- BOTTOM BOXES ---
  const bottomBoxY = 45;
  const bottomBoxH = 46;

  // Note Box
  drawRect(65, bottomBoxY, 255, bottomBoxH, 0.5);
  drawText("Note:", 180, bottomBoxY + 34, 7.5, true, rgb(0.8, 0.1, 0.1));
  drawText("Please save/print this receipt for future reference. For assistance under the", 75, bottomBoxY + 22, 6, false);
  drawText("Feel Safe Sakhi Yojana, visit feelsafeco.in or mail us at support@feelsafeco.in", 72, bottomBoxY + 12, 6, false);
  drawText("+91 9013499385", 170, bottomBoxY + 3, 6, true);

  // Authorised Signatory Box with Stamp
  drawRect(375, bottomBoxY, 135, bottomBoxH, 0.5);
  drawText("for Feel Safe Private Limited", 382, bottomBoxY + 35, 7, true);

  if (embeddedStamp) {
    const stampW = 28;
    const stampH = 28;
    page.drawImage(embeddedStamp, {
      x: 375 + (135 - stampW) / 2, // Center horizontally in the box
      y: bottomBoxY + 13,
      width: stampW,
      height: stampH,
    });
  }

  drawText("Authorised Signatory", 400, bottomBoxY + 4, 7, true);

  const finalPdfBytes = await pdfDoc.save();
  await fs.writeFile(destPdfPath, finalPdfBytes);

  return { created: true, url: publicUrl, filePath: destPdfPath };
}

module.exports = { getOrCreateInvoicePdf };