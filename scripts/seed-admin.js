const pool = require("../config/db");
const bcrypt = require("bcrypt");

async function seedAdminData() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const username = "8130124630";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("Vats1992*", salt);

    const newUser = await client.query(
      `INSERT INTO users (
        full_name, aadhaar_no, dob, gender, pan_no, email, phone, whatsapp_no,
        address, city, state, pin,
        bank_name, account_holder_name, account_no, ifsc_code, branch,
        referral_code, referrer_name, referrer_contact,
        nominee_name, nominee_relationship, nominee_age, nominee_contact, nominee_aadhaar,
        business_level, agreed_to_terms, kyc_status,
        username, password_hash, referrer_id,
        is_active, role
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,
        $18,$19,$20,
        $21,$22,$23,$24,$25,
        $26,$27,$28,
        $29,$30,$31,
        $32, $33
      ) ON CONFLICT (phone) DO NOTHING RETURNING id`, // Added RETURNING id here
      [
        "Super Admin",
        null,
        "1970-01-01",
        "Male",
        null,
        "eelsafe.pvtltd@gmail.com",
        "8130124630",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        "ADMIN001",
        null,
        null,
        null,
        null,
        18,
        null,
        null,
        0,
        true,
        true,
        username,
        hashedPassword,
        null,
        true,
        "Super Admin",
      ],
    );

    // FIX: Check if newUser.rows[0] exists before accessing .id
    if (newUser.rows.length > 0) {
      const adminId = newUser.rows[0].id;

      await client.query(
        "INSERT INTO wallets (user_id, total_amount, left_count, right_count, paid_pairs) VALUES ($1, 0, 0, 0, 0) ON CONFLICT DO NOTHING",
        [adminId],
      );

      await client.query("COMMIT");
      console.log("✅ Super Admin seeded successfully!");
    } else {
      // If user existed, we don't need to commit a new wallet
      await client.query("ROLLBACK");
      console.log("ℹ️ Super Admin already exists. No changes made.");
    }

    console.log("📱 Phone: 8130124630");
    console.log("🔑 Password: Vats1992*");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error seeding admin data:", error);
  } finally {
    client.release();
    process.exit();
  }
}

seedAdminData();
