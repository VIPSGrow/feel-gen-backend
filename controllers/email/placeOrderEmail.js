// const nodemailer = require("nodemailer");
const emailTemplates = require("./EmailTemplate.json");
const { transporter } = require("../../utils/otpService");
const crypto = require("crypto");
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: Number(process.env.EMAIL_PORT || 587),
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// A simple function to build a clean HTML table for the cart products
// function generateHtmlItemList(items) {
//   let tableHtml = `
//     <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
//       <thead>
//         <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; font-weight: bold;">
//           <th style="padding: 8px 0;">Product</th>
//           <th style="padding: 8px 0; text-align: center;">Qty</th>
//           <th style="padding: 8px 0; text-align: right;">Price</th>
//         </tr>
//       </thead>
//       <tbody>
//   `;

//   items.forEach((item) => {
//     tableHtml += `
//       <tr style="border-bottom: 1px solid #f1f5f9;">
//         <td style="padding: 10px 0; font-weight: 500;">${item.name}</td>
//         <td style="padding: 10px 0; text-align: center; color: #64748b;">${
//           item.quantity
//         }</td>
//         <td style="padding: 10px 0; text-align: right; font-weight: bold;">₹${(
//           item.price * item.quantity
//         ).toFixed(2)}</td>
//       </tr>
//     `;
//   });

//   tableHtml += "</tbody></table>";
//   return tableHtml;
// }

function generateHtmlItemList(items, shippingCharge) {
  let totalQty = 0;
  let totalNet = 0;
  let totalSGST = 0;
  let totalCGST = 0;

  const shipping = parseFloat(shippingCharge) || 0;

  // Build rows dynamically from your order payload array map
  let itemRows = items
    .map((item) => {
      const qty = parseInt(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      const net = qty * price;

      const taxRate = parseFloat(item.taxRate) || 0;
      const taxAmt = parseFloat(item.taxAmt) || 0;

      const cgstRate = taxRate / 2;
      const cgstAmt = taxAmt / 2;
      const sgstRate = taxRate / 2;
      const sgstAmt = taxAmt / 2;

      totalQty += qty;
      totalSGST += sgstAmt;
      totalCGST += cgstAmt;
      totalNet += net + sgstAmt + cgstAmt;

      // Defaulting tax nodes cleanly as 'nil' or '0%' to match raw invoice state if unspecified
      const hsn = item.hsn_code || "N/A";

      return `
      <tr>
        <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center;">${item.s_no
        }</td>
        <td style="padding: 8px 6px; border: 1px solid #e2e8f0; font-weight: 500; color: #1e293b;">${item.name
        }</td>
        <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center; color: #475569;">${hsn}</td>
        <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center;">${qty}</td>
        <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right;">₹${price.toFixed(
          2,
        )}</td>
        <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right;">₹${net.toFixed(
          2,
        )}</td>
        <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center; color: #94a3b8;">${cgstRate}</td>
        <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; color: #94a3b8;">₹${cgstAmt.toFixed(
          2,
        )}</td>
        <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center; color: #94a3b8;">${sgstRate}</td>
        <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; color: #94a3b8;">₹${sgstAmt.toFixed(
          2,
        )}</td>
        <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center; color: #94a3b8;">nil</td>
        <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; color: #94a3b8;">₹0.00</td>
      </tr>
    `;
    })
    .join("");

  // 2. Append the Shipping Charge row if applicable
  itemRows += `
    <tr style="background-color: #fafafa; font-style: italic;">
      <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">-</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; color: #475569;" colspan="2">Shipping & Handling Charges</td>
      <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">1</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; color: #475569;">₹${shipping.toFixed(
    2,
  )}</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; color: #475569;">₹${shipping.toFixed(
    2,
  )}</td>
      <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center; color: #94a3b8;">nil</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; color: #94a3b8;">₹0.00</td>
      <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center; color: #94a3b8;">nil</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; color: #94a3b8;">₹0.00</td>
      <td style="padding: 8px 4px; border: 1px solid #e2e8f0; text-align: center; color: #94a3b8;">nil</td>
      <td style="padding: 8px 6px; border: 1px solid #e2e8f0; text-align: right; color: #94a3b8;">₹0.00</td>
    </tr>
  `;

  // Helper helper to generate basic invoice word summary string
  const overallGrandTotal = totalNet + shipping;
  const finalInWords =
    numberToIndianWords(Math.round(overallGrandTotal)) + " Only";

  // Return the entire structural transaction block layout directly
  return `
    <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">Transaction Summary</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background-color: #f1f5f9; color: #334155; font-weight: bold;">
          <th style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center;" rowspan="2">S. No.</th>
          <th style="padding: 8px 6px; border: 1px solid #cbd5e1;" rowspan="2">Product Details</th>
          <th style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center;" rowspan="2">HSN code</th>
          <th style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center;" rowspan="2">QTY</th>
          <th style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: right;" rowspan="2">Unit Price</th>
          <th style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: right;" rowspan="2">Net Amount</th>
          <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;" colspan="2">CGST</th>
          <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;" colspan="2">SGST</th>
          <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;" colspan="2">IGST</th>
        </tr>
        <tr style="background-color: #f8fafc; color: #475569;">
          <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">Rate</th>
          <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">Amt.</th>
          <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">Rate</th>
          <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">Amt.</th>
          <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: center;">Rate</th>
          <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">Amt.</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr style="background-color: #f8fafc; font-weight: bold; color: #1e293b;">
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: right;" colspan="3">Grand Total</td>
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1; text-align: center;">${totalQty}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: right;">₹${overallGrandTotal.toFixed(
    2,
  )}</td>
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: right;">₹${totalCGST.toFixed(
    2,
  )}</td>
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: right;">₹${totalSGST.toFixed(
    2,
  )}</td>
          <td style="padding: 8px 4px; border: 1px solid #cbd5e1;">&nbsp;</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: right;">₹0.00</td>
        </tr>
      </tbody>
    </table>
    <table style=\"width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; border: 1px solid #cbd5e1;\">
      <tr>
        <td style=\"padding: 10px 12px; width: 65%; vertical-align: top; border-right: 1px solid #cbd5e1;\">
          <strong style=\"color: #475569; font-size: 11px; text-transform: uppercase;\">Invoice Value (In Words):</strong><br>
          <span style=\"font-style: italic; color: #1e293b; font-weight: 500; display: inline-block; margin-top: 4px;\">${finalInWords}</span>
        </td>
        <td style=\"padding: 10px 12px; width: 35%; text-align: right; vertical-align: middle; background-color: #f8fafc;\">
          <strong style=\"color: #475569; font-size: 11px; text-transform: uppercase;\">Invoice Total:</strong><br>
          <span style=\"font-size: 18px; color: #00A9E0; font-weight: 800; display: inline-block; margin-top: 2px;\">₹${overallGrandTotal.toFixed(
    2,
  )}</span>
        </td>
      </tr>
    </table>
  `;
}

// Basic dynamic text processor algorithm for Indian Numbering System calculations
function numberToIndianWords(num) {
  if (num === 0) return "Rupees Zero";
  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function toWords(n) {
    if (n < 20) return a[n];
    if (n < 100)
      return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        "Hundred " +
        (n % 100 !== 0 ? "and " + toWords(n % 100) : "")
      );
    return "";
  }

  let str = "";
  let lakh = Math.floor(num / 100000);
  num %= 100000;
  let thousands = Math.floor(num / 1000);
  num %= 1000;
  let remaining = num;

  if (lakh > 0) str += toWords(lakh) + "Lakh ";
  if (thousands > 0) str += toWords(thousands) + "Thousand ";
  if (remaining > 0) str += toWords(remaining);

  return "Rupees " + str.trim();
}

// A simple function to generate a text fallback version for older e-mail applications
function generatePlainTextItems(items) {
  return items
    .map(
      (i) =>
        `- ${i.name} (x${i.quantity}): ₹${(i.price * i.quantity).toFixed(2)}`,
    )
    .join("\n");
}

function compileOrderEmail(orderData, templateKey = "order_placed") {
  console.log(
    " \n\n Compiling email for order:",
    orderData.order_id,
    "with status key:",
    templateKey,
  );
  const template =
    emailTemplates.templates[templateKey] ||
    emailTemplates.templates.order_placed;

  if (!template) {
    throw new Error(`Email template not found for key: ${templateKey}`);
  }

  let subject = template.subject;
  let text = template.plainTextMessage;
  let html = template.htmlContent;

  const items = orderData?.items || [];
  const htmlItemsTable = generateHtmlItemList(
    items,
    parseFloat(orderData.shippingCharges),
  );
  const plainTextItems = generatePlainTextItems(items);



  const orderId = String(orderData.order_id);
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now

  // Sign the payload: orderId + expires
  const dataToSign = `${orderId}:${expires}`;
  const signature = crypto
    .createHmac("sha256", process.env.URL_SIGN_SECRET)
    .update(dataToSign)
    .digest("hex");

  // Compact URL with expiry and signature
  const invoiceUrl = `https://feelsafeco.in/account/orders/${orderId}?exp=${expires}&sig=${signature}`;

  console.log(
    " \n\n =============== \n\n Compiling invoice url of order:",
    invoiceUrl
  );

  // const invoiceUrl = `https://feelsafeco.in/account/orders`;
  // const invoiceUrl = `https://feelsafeco.in/account/orders/${orderData.order_id}`;

  const templateVariables = {
    "{{order_id}}": String(orderData.order_id),
    "{{sakhi_distributor_id}}": String(orderData.sakhi_distributor_id),
    "{{transaction_date}}": String(orderData.transaction_date),
    "{{transaction_description}}": String(orderData.transaction_description),
    "{{receipt_no}}": String(orderData.receipt_no),
    "{{invoice_url}}": String(orderData.invoice_url),
    "{{customer_name}}": String(orderData.customer_name),
    "{{invoice_url}}": invoiceUrl,
    "{{residential_address}}": String(orderData.residential_address),
    "{{shipping_address}}": String(orderData.shipping_address),
    "{{shipping_contact_no}}": String(orderData.shipping_contact_no),
    "{{email_address}}": String(orderData.email_address),
    "{{itemList}}": htmlItemsTable,
  };

  // Replace placeholders in subject/html
  Object.keys(templateVariables).forEach((key) => {
    subject = subject.replaceAll(key, templateVariables[key]);
    html = html.replaceAll(key, templateVariables[key]);
  });

  // Replace placeholders in text + append items
  text = text
    .replaceAll("{{order_id}}", templateVariables["{{order_id}}"])
    .replaceAll("{{customer_name}}", templateVariables["{{customer_name}}"])
    .replaceAll("{{invoice_url}}", templateVariables["{{invoice_url}}"])
    .concat(`\n\nItems Ordered:\n${plainTextItems}`);

  return { subject, text, html };
}

// Main mail wrapper compiler function
async function sendPlacedOrderEmail(userEmail, orderData) {
  const { subject, text, html } = compileOrderEmail(orderData);

  await transporter.sendMail({
    from: '"Feel Safe" <no-reply@feelsafeco.in>',
    to: userEmail,
    subject,
    text,
    html,
  });
}

// order status update (currently using same template key: order_placed)
async function sendOrderStatusUpdateEmail(userEmail, orderData) {
  const { subject, text, html } = compileOrderEmail(
    orderData,
    orderData.status,
  );

  await transporter.sendMail({
    from: '"Feel Safe" <no-reply@feelsafeco.in>',
    to: userEmail,
    subject,
    text,
    html,
  });
}

module.exports = { sendPlacedOrderEmail, sendOrderStatusUpdateEmail };
