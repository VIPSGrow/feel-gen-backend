const pool = require("../config/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

function getArgValue(name, defaultValue) {
  const idx = process.argv.findIndex((a) => a === name);
  if (idx === -1) return defaultValue;
  const v = process.argv[idx + 1];
  if (!v) return defaultValue;
  return v;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizePhone(n) {
  const s = String(n);
  return s.length < 10 ? s.padStart(10, "0") : s;
}

async function generateUniqueUsername(client) {
  for (let attempts = 0; attempts < 20; attempts++) {
    const username = crypto.randomInt(1000000000, 9999999999).toString();

    const exists = await client.query(
      "SELECT 1 FROM users WHERE username = $1",
      [username],
    );

    if (exists.rows.length === 0) return username;
  }

  throw new Error("Failed to generate unique username");
}

async function generateUniqueReferralCode(client) {
  const now = new Date();
  const year = (now.getFullYear() % 100).toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const prefix = `FS${year}${month}`;

  for (let sn = 1; sn <= 9999; sn++) {
    const snStr = sn.toString().padStart(4, "0");
    const candidate = `${prefix}${snStr}`;

    const exists = await client.query(
      "SELECT 1 FROM users WHERE referral_code = $1",
      [candidate],
    );

    if (exists.rows.length === 0) return candidate;
  }

  throw new Error("Referral code limit reached");
}

async function findReferrerByPhone(client, phone) {
  const ref = await client.query(
    "SELECT id, username, node_path, binary_path FROM users WHERE phone = $1 LIMIT 1 FOR UPDATE",
    [phone],
  );

  if (ref.rows.length === 0) {
    throw new Error(`No referrer found with phone ${phone}`);
  }

  return ref.rows[0];
}

async function getOrThrowRoot(client) {
  const root = await client.query(
    "SELECT id, username, node_path, binary_path FROM users WHERE binary_path = '1' LIMIT 1 FOR UPDATE",
  );

  if (root.rows.length === 0) {
    throw new Error(
      "No root user found (binary_path='1'). Provide --referrerPhone or create root first.",
    );
  }

  return root.rows[0];
}

async function createWallet(client, userId) {
  await client.query(
    "INSERT INTO wallets (user_id, total_amount, left_count, right_count, paid_pairs) VALUES ($1, 0, 0, 0, 0) ON CONFLICT DO NOTHING",
    [userId],
  );
}

async function seedUsers() {
  const count = parseInt(getArgValue("--count", "1"), 10);
  const password = getArgValue("--password", "12345678");
  const referrerPhone = getArgValue("--referrerPhone", "9999999912");
  const startingPhone = getArgValue("--startingPhone", "9999999122");
  const fullNamePrefix = getArgValue("--fullNamePrefix", "User 122");
  const skipQr = hasFlag("--skipQr"); // currently unused (QR generation is intentionally not done for speed)

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("--count must be a positive integer");
  }

  const client = await pool.connect();
  const created = [];

  try {
    await client.query("BEGIN");

    const parent = referrerPhone
      ? await findReferrerByPhone(client, referrerPhone)
      : await getOrThrowRoot(client);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let phoneCursor = startingPhone
      ? parseInt(startingPhone, 10)
      : parseInt(referrerPhone ? referrerPhone : "9999999900", 10);

    for (let i = 0; i < count; i++) {
      const username = await generateUniqueUsername(client);
      const phone = normalizePhone(phoneCursor + i);

      // Skip existing phones
      const phoneExists = await client.query(
        "SELECT 1 FROM users WHERE phone = $1",
        [phone],
      );
      if (phoneExists.rows.length > 0) continue;

      // Lock and decide next available position under parent's binary leg
      const children = await client.query(
        `SELECT position
         FROM users
         WHERE subpath(binary_path, 0, nlevel(binary_path)-1) = $1
         FOR UPDATE`,
        [parent.binary_path],
      );

      const taken = children.rows.map((r) => r.position);

      let position;
      if (!taken.includes(1)) position = 1;
      else if (!taken.includes(2)) position = 2;
      else {
        throw new Error(
          "Both legs already filled for the given referrer. Pick another referrer.",
        );
      }

      const nodePath = `${parent.node_path}.${username}`;
      const binaryPath = `${parent.binary_path}.${position}`;
      const referral_code = await generateUniqueReferralCode(client);

      const insert = await client.query(
        `INSERT INTO users (
          full_name, aadhaar_no, dob, gender, pan_no, email, phone, whatsapp_no,
          address, city, state, pin,
          bank_name, account_holder_name, account_no, ifsc_code, branch,
          referral_code, referrer_name, referrer_contact,
          nominee_name, nominee_relationship, nominee_age, nominee_contact, nominee_aadhaar,
          business_level, agreed_to_terms, kyc_status,
          username, password_hash, referrer_id,
          node_path, binary_path, position, is_active, gstin
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,
          $18,$19,$20,
          $21,$22,$23,$24,$25,
          $26,$27,$28,
          $29,$30,$31,
          $32,$33,$34,$35, $36
        ) RETURNING id, username, phone, referral_code, node_path, binary_path, position`,
        [
          `${fullNamePrefix} ${i + 1}`,
          null,
          "1970-01-01",
          null,
          null,
          // email is NOT NULL in DB, so generate a safe placeholder
          `seed${phone}@example.com`,
          phone,

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
          referral_code,
          parent.username,
          null,
          null,
          null,
          null,
          null,
          null,
          0,
          true,
          true,
          username,
          hashedPassword,
          parent.id,
          nodePath,
          binaryPath,
          position,
          false,
          "",
        ],
      );

      await createWallet(client, insert.rows[0].id);

      created.push({ ...insert.rows[0], password });
    }

    await client.query("COMMIT");

    if (created.length === 0) {
      console.log("No users created (all phone numbers already existed). ");
    } else {
      console.log(`✅ Seeded ${created.length} users under referrer.`);
      for (const u of created) {
        console.log(
          `- phone=${u.phone} username=${u.username} referral=${u.referral_code} password=${u.password}`,
        );
      }
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error seeding users:", err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

seedUsers();
