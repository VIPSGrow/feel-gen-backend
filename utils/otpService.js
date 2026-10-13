const nodemailer = require("nodemailer");
const db = require("../config/db");
const crypto = require("crypto");
const https = require("https");

// Transporter config (use .env: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS)
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST || "smtp.gmail.com",
//   port: process.env.EMAIL_PORT || 587,
//   secure: false, // true for 465
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 465,
//   secure: true, // Use SSL
//   auth: {
//     user: "co0lv7264@gmail.com",
//     pass: "jtdqxcgvskkejeyq", // Paste the new code here
//   },
//   tls: {
//     // This helps if you are running on localhost or a restricted network
//     rejectUnauthorized: false,
//   },
// });

exports.transporter = nodemailer.createTransport({
  host: "webmail.feelsafeco.in",
  port: 587,
  secure: false, // Use SSL
  auth: {
    user: "no-reply@feelsafeco.in",
    pass: "VpS_Secured#2026!Feelsafe", // Paste the new code here
  },
  tls: {
    // This helps if you are running on localhost or a restricted network
    rejectUnauthorized: false,
  },
});

// Verify SMTP connection at startup so failures are visible immediately
exports.transporter
  .verify()
  .then(() => console.log("[EMAIL] SMTP connection verified successfully for no-reply@feelsafeco.in"))
  .catch((err) =>
    console.error("[EMAIL] SMTP connection verification FAILED:", err.message),
  );

async function getUserContact(userId) {
  const result = await db.query(
    "SELECT email, phone, otp_email_count FROM users WHERE id = $1",
    [userId],
  );
  if (result.rows.length === 0) throw new Error("User not found");
  return result.rows[0];
}

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

async function shouldUseEmail(userId) {
  const user = await getUserContact(userId);
  return user.otp_email_count < 2;
}

function sendSmsEdumarc({ phone, otp }) {
  const apiKey = process.env.EDUMARC_SMS_APIKEY;
  if (!apiKey) {
    throw new Error(
      "Missing env var EDUMARC_SMS_APIKEY (required for Edumarc OTP SMS)",
    );
  }

  const payload = {
    message: `Your FEELSAFECO OTP for verification is: ${otp}. OTP is confidential, refrain from sharing it with anyone. By Edumarc Technologies`,
    senderId: "EDUMRC",
    number: [phone],
    templateId: "1707168926925165526",
  };

  const data = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://smsapi.edumarcsms.com/api/v1/sendsms",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          const statusCode = res.statusCode || 0;
          if (statusCode >= 200 && statusCode < 300) {
            return resolve({ statusCode, body });
          }
          return reject(
            new Error(`Edumarc SMS failed (${statusCode}): ${body}`),
          );
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.write(data);
    req.end();
  });
}

exports.sendOTP = async (userId, purpose = "transaction") => {
  const user = await getUserContact(userId);
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  // Store OTP in temp table or redis; here simple users otp field temp (extend schema if needed)
  await db.query(
    "INSERT INTO user_otps (user_id, otp, purpose, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, purpose) DO UPDATE SET otp = $2, expires_at = $4",
    [userId, otp, purpose, expiresAt],
  ); // Assume user_otps table; create if missing

  const useEmail = await shouldUseEmail(userId);
  const message = `Your OTP is ${otp}. Valid for 5 minutes.`;

  if (useEmail) {
    const subject = `Your ${purpose} OTP`;
    console.log(`[EMAIL] Attempting to send OTP to ${user.email} (user_id=${userId}, purpose=${purpose})`);

    try {
      const info = await this.transporter.sendMail({
        to: user.email,
        subject,
        text: message,
      });
      console.log(`[EMAIL] SUCCESS - OTP sent to ${user.email}, messageId=${info.messageId}, response=${JSON.stringify(info.response || {})}`);
    } catch (emailErr) {
      console.error(`[EMAIL] FAILED to send OTP to ${user.email}: ${emailErr.message}`, emailErr.stack);
      throw emailErr;
    }

    await db.query(
      "UPDATE users SET otp_email_count = otp_email_count + 1 WHERE id = $1",
      [userId],
    );
  } else {
    // SMS via Edumarc
    await sendSmsEdumarc({ phone: user.phone, otp });
    console.log(`SMS OTP sent to ${user.phone}`);
  }

  return { sentTo: useEmail ? "email" : "sms", expiresAt, otp: otp };
};

exports.verifyOTP = async (userId, otp, purpose = "transaction") => {
  const result = await db.query(
    "SELECT expires_at FROM user_otps WHERE user_id = $1 AND otp = $2 AND purpose = $3",
    [userId, otp, purpose],
  );
  if (result.rows.length === 0) return false;
  if (new Date() > result.rows[0].expires_at) return false;
  // Cleanup
  await db.query("DELETE FROM user_otps WHERE user_id = $1 AND purpose = $2", [
    userId,
    purpose,
  ]);
  return true;
};
