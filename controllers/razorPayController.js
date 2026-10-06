const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("../config/db");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const {
  validateWebhookSignature,
} = require("razorpay/dist/utils/razorpay-utils");

// Step 1: Create Order
exports.createOrder = async (req, res) => {
  console.log("\n[createOrder] Incoming body:", req.body);

  const dbOrderId = req.body?.order_id;
  // if (!dbOrderId) {
  //   return res.status(400).json({
  //     status: false,
  //     message: "Missing required field: order_id (db order id) in request body",
  //   });
  // }

  const options = {
    amount: req.body.amount * 100, // Amount in paise (e.g., 500 INR = 50000)
    currency: "INR",
    receipt: req.body.receipt || `receipt_${Date.now()}`,
    notes: {
      my_database_order_id: dbOrderId,
    },
  };

  try {
    const order = await razorpay.orders.create(options);

    if (order.status === "created") {
      res.json({ status: true, order: order }); // Sends order_id to frontend
    } else {
      res.json({ status: false, errors: order });
    }
  } catch (err) {
    res.status(500).send(err);
  }
};

// Step 2: Verify Payment
exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const sign = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(sign.toString())
    .digest("hex");

  if (razorpay_signature === expectedSign) {
    // Payment is authentic - Update your DB here
    return res.status(200).json({ success: true, message: "Payment verified" });
  } else {
    return res
      .status(400)
      .json({ success: false, message: "Invalid signature" });
  }
};

exports.VerifyPaymentFunc = async (
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
) => {
  const sign = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(sign.toString())
    .digest("hex");

  return razorpay_signature === expectedSign;
};

// exports.razorpayWebhook = async (req, res) => {
//   console.log("\n--------- Received Razorpay Webhook:", req.body);
//   // 1. The secret you set in Razorpay Dashboard -> Settings -> Webhooks
//   const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
//   console.log("Headers:", req.headers, "webhook secret:", WEBHOOK_SECRET);

//   // 2. Razorpay sends the signature in this header
//   const signature = req.headers["x-razorpay-signature"];

//   if (!signature) {
//     return res
//       .status(400)
//       .json({ status: false, message: "Missing signature" });
//   }

//   // 3. Verify the signature
//   const shasum = crypto.createHmac("sha256", WEBHOOK_SECRET);
//   shasum.update(JSON.stringify(req.body));
//   const digest = shasum.digest("hex");

//   if (signature === digest) {
//     console.log("Webhook Verified!");
//     const event = req.body.event;

//     // 4. Handle specific events
//     if (event === "payment.captured") {
//       const paymentData = req.body.payload.payment.entity;
//       // 3. Get the Payment ID (e.g., "pay_NklSdf839xjd")
//       const paymentId = paymentData.id;
//       const orderId = paymentData.order_id;
//       const myCustomDbOrderId = paymentData.notes.my_database_order_id;

//       // UPDATE YOUR DATABASE HERE
//       await db.query(
//         "UPDATE orders SET payment_status = 'paid', total_bv_points = $2 WHERE order_id = $1",
//         [myCustomDbOrderId, `paymentId : ${paymentId} | orderId : ${orderId}`],
//       );
//       console.log(`Order ${myCustomDbOrderId} marked as paid.`);

//       // add a transaction record
//       // await db.query(
//       //   `INSERT INTO transactions (user_id, amount, type, category, source_user_id, order_id, remarks, status)
//       //   VALUES ($1, $2, 'credit', 'purchase', $3, $4, 'Razorpay Payment for purchase order - ${orderId} / ${myCustomDbOrderId}', 'completed')`,
//       //   [
//       //     paymentData.notes.user_id,
//       //     paymentData.amount / 100,
//       //     paymentData.notes.user_id,
//       //     myCustomDbOrderId,
//       //   ],
//       // );
//       // console.log(`Transaction record created for order ${myCustomDbOrderId}.`);
//     }

//     // Always respond with 200 OK to Razorpay
//     res.status(200).json({ status: "ok" });
//   } else {
//     // If signature doesn't match, someone else is trying to call your API
//     res.status(400).send("Invalid signature");
//   }
// };

exports.razorpayWebhook = async (req, res) => {
  console.log("\n=======================================================");
  console.log("📥 NEW RAZORPAY WEBHOOK RECEIVED AT:", new Date().toISOString());
  console.log("=======================================================");

  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  // 🕵️‍♂️ [RAW BODY INSPECTOR] - DETECTING BODY TYPE
  console.log("\n🔍 [DEBUG] INSPECTING INCOMING REQ.BODY TYPE:");

  if (Buffer.isBuffer(req.body)) {
    console.log("✅ RESULT: req.body is a RAW BUFFER (Perfect for Webhooks!)");
    console.log(`📦 Buffer Length: ${req.body.length} bytes`);
  } else if (typeof req.body === "string") {
    console.log(
      "⚠️ RESULT: req.body is a Plain STRING (Raw middleware working, but parsed as string)",
    );
  } else if (typeof req.body === "object" && req.body !== null) {
    console.log("❌ RESULT: req.body is a JAVASCRIPT OBJECT");
    console.log(
      "📢 ALERT: Express global middleware already parsed this! Signature might fail.",
    );
  } else {
    console.log(`❓ RESULT: req.body is unknown type: ${typeof req.body}`);
  }

  if (!signature) {
    console.error(
      "❌ [ERROR] Webhook verification failed: Missing 'x-razorpay-signature' header.",
    );
    return res
      .status(400)
      .json({ status: false, message: "Missing signature" });
  }

  try {
    // 1. Raw body ko string mein extract karna (Safe Conversion)
    const rawBodyString = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : typeof req.body === "object"
      ? JSON.stringify(req.body)
      : req.body;

    console.log(`\n[DEBUG] Configured Webhook Secret: "${WEBHOOK_SECRET}"`);
    console.log(`[DEBUG] Received X-Razorpay-Signature: "${signature}"`);

    // 2. Razorpay SDK Utility Validation
    const isSignatureValid = validateWebhookSignature(
      rawBodyString,
      signature,
      WEBHOOK_SECRET,
    );

    if (isSignatureValid) {
      console.log("✅ [SUCCESS] Webhook Signature Verified via Razorpay SDK!");

      // JSON parsing safe execution
      const parsedBody =
        typeof req.body === "object" && !Buffer.isBuffer(req.body)
          ? req.body
          : JSON.parse(rawBodyString);

      console.log("\n[DEBUG] Full Parsed Body Output:");
      console.dir(parsedBody, { depth: null, colors: true });

      const event = parsedBody.event;
      console.log(`[DEBUG] Handling Event Type: ${event}`);

      if (event === "payment.captured") {
        const paymentData = parsedBody.payload?.payment?.entity;

        if (!paymentData) {
          console.error(
            "❌ [ERROR] Malformed webhook payload. 'payload.payment.entity' is missing.",
          );
          return res
            .status(400)
            .json({ status: false, message: "Invalid payload structure" });
        }

        const paymentId = paymentData.id;
        const orderId = paymentData.order_id;
        // notes can be [] or object depending on Razorpay; log it to debug
        console.log(
          "[webhook] paymentData.notes:",
          paymentData.notes,
          "(type:",
          paymentData.notes && typeof paymentData.notes,
          ")",
        );

        const myCustomDbOrderId = paymentData.notes?.my_database_order_id;
        const userId = paymentData.notes?.user_id;

        console.log("\n[DEBUG] Extracted Payment Variables:");
        console.log(`   - Razorpay Payment ID:  ${paymentId}`);
        console.log(`   - Razorpay Order ID:    ${orderId}`);
        console.log(`   - Your DB Order ID:     ${myCustomDbOrderId}`);

        // DATABASE UPDATE
        if (myCustomDbOrderId) {
          console.log(
            `[DB] Attempting to update order ${myCustomDbOrderId} status to 'paid'...`,
          );
          await db.query(
            "UPDATE orders SET payment_status = 'paid', total_bv_points = $2 WHERE order_id = $1",
            [
              myCustomDbOrderId,
              `paymentId : ${paymentId} | orderId : ${orderId}`,
            ],
          );
          // Idempotent; never throws, so webhook retries are safe.
          await require("../services/qualification/QualificationService").recordPurchaseForOrderRef(
            myCustomDbOrderId,
          );
          console.log(
            `✅ [DB SUCCESS] Order ${myCustomDbOrderId} successfully marked as paid.`,
          );
        }
      }

      return res.status(200).json({ status: "ok" });
    } else {
      console.error(
        "❌ [ERROR] Signature Mismatch! SDK validation returned false.",
      );
      return res.status(400).send("Invalid signature");
    }
  } catch (error) {
    console.error(
      "💥 [CRITICAL ERROR] Exception caught inside webhook handler:",
      error,
    );
    return res.status(500).json({ status: false, error: error.message });
  }
};
