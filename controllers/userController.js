const db = require("../config/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const fs = require("fs/promises");
const pathModule = require("path");
const otpService = require("../utils/otpService");

exports.getAllUsers = async (req, res) => {
  try {
    // We get the logged-in user's path from the request (sent by middleware)
    // const userPath = req.user.node_path;

    // Query: Find everyone whose path starts with the current user's path
    // The <@ operator in ltree means "is a descendant of"
    const downline = await db.query(
      "SELECT id, username, role, node_path, full_name, referrer_id FROM users",
    );

    res.json({ status: true, data: downline.rows });
  } catch (err) {
    console.log("error all user - ", err);

    res.status(500).send("Server Error");
  }
};
exports.getDownline = async (req, res) => {
  try {
    // We get the logged-in user's path from the request (sent by middleware)
    const userPath = req.user.node_path;

    // Query: Find everyone whose path starts with the current user's path
    // The <@ operator in ltree means "is a descendant of"
    const downline = await db.query(
      "SELECT id, username, role, node_path, name, referrer_id FROM users WHERE node_path <@ $1 AND node_path != $1",
      [userPath],
    );

    res.json(downline.rows);
  } catch (err) {
    res.status(500).send("Server Error");
  }
};

exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params; // Get member ID from URL
    const { name, email, phone, status } = req.body;

    // 1. Basic Validation
    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "Member ID is required" });
    }

    // 2. Perform the Update
    // full_name is used here based on your 'getMyDownline' query (u.full_name as name)
    const result = await db.query(
      `UPDATE users 
       SET 
         full_name = $1, 
         email = $2, 
         phone = $3, 
         is_active = $4         
       WHERE id = $5
       RETURNING id, full_name as name, email, phone, is_active,created_at`,
      [name, email, phone, status, id],
    );

    // 3. Check if user existed
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Member not found" });
    }

    // 4. Success Response
    res.status(200).json({
      status: true,
      message: "Member updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    // Check for unique constraint violations (like email already exists)
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ status: false, message: "Email already in use" });
    }

    console.log("error in update member by super admin - ", error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getMyDownline = async (req, res) => {
  try {
    const userResult = await db.query(
      "SELECT node_path FROM users WHERE id = $1",
      [req.user.id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const myPath = userResult.rows[0].node_path;

    const downline = await db.query(
      `SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.phone, 
        u.node_path, 
        u.referrer_id, 
        u.referral_code,
        u.created_at,
        u.full_name as name,
        -- Subquery to count descendants for each row
        (
          SELECT COUNT(*) 
          FROM users sub 
          WHERE sub.node_path <@ u.node_path AND sub.id != u.id
        )::int as referrals_count
       FROM users u
       WHERE u.node_path <@ $1::ltree AND u.id != $2
       ORDER BY u.node_path ASC`,
      [myPath, req.user.id],
    );

    res.json({ success: true, data: downline.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.getMyTree = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch the user AND all their descendants in one query
    // By using <@ (is descendant) and including the user's own path,
    // we get the full subtree in one go.
    const result = await db.query(
      `SELECT 
        u.id, u.username, u.email, u.phone, u.full_name, u.node_path, 
        u.referrer_id, u.referral_code, u.created_at, u.is_active, u.kyc_status,
        -- Total number of descendants under this user (team size)
        (
          SELECT COUNT(*) 
          FROM users sub 
          WHERE sub.node_path <@ u.node_path AND sub.id != u.id
        )::int as team_size,
        -- Match the highest level from level_commissions whose team_size threshold
        -- is less than or equal to this user's team size
        lc.level_no,
        lc.level_name,
        lc.commission_percentage,
        -- Create a JSON object for referrer if it exists
        CASE 
          WHEN p.id IS NOT NULL THEN 
            jsonb_build_object(
              'id', p.id, 
              'full_name', p.full_name, 
              'username', p.username,
              'phone', p.phone
              )
          ELSE NULL 
        END as referrer
       FROM users u
       LEFT JOIN users p ON u.referrer_id = p.id
       LEFT JOIN LATERAL (
         SELECT lc.level_no, lc.level_name, lc.commission_percentage
         FROM level_commissions lc
         WHERE lc.team_size <= (
           SELECT COUNT(*) 
           FROM users sub 
           WHERE sub.node_path <@ u.node_path AND sub.id != u.id
         )
         ORDER BY lc.level_no DESC
         LIMIT 1
       ) lc ON true
       WHERE u.node_path <@ (SELECT node_path FROM users WHERE id = $1)::ltree`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, error: "User not found" });
    }

    const flatData = result.rows;

    // 2. Helper function to build the tree
    const buildTree = (data, rootId) => {
      return data
        .filter((item) => item.referrer_id === rootId)
        .map((item) => ({
          ...item,
          children: buildTree(data, item.id),
        }));
    };

    // 3. Find the "Top Parent" object (the logged-in user)
    const topUser = flatData.find((u) => u.id === userId);

    // 4. Build children for the top user and return as a single object (or array)
    const tree = {
      ...topUser,
      children: buildTree(flatData, userId),
    };

    // Wrapping in an array [tree] to keep it consistent with your previous structure
    res.json({ status: true, data: [tree] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.getMyTreeById = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // 1. Fetch the user AND all their descendants in one query
    // By using <@ (is descendant) and including the user's own path,
    // we get the full subtree in one go.
    const result = await db.query(
      `SELECT 
        u.id, u.username, u.email, u.phone, u.full_name, u.node_path, 
        u.referrer_id, u.referral_code, u.created_at, u.is_active, u.kyc_status,
        -- Total number of descendants under this user (team size)
        (
          SELECT COUNT(*) 
          FROM users sub 
          WHERE sub.node_path <@ u.node_path AND sub.id != u.id
        )::int as team_size,
        -- Match the highest level from level_commissions whose team_size threshold
        -- is less than or equal to this user's team size
        lc.level_no,
        lc.level_name,
        lc.commission_percentage,
        -- Create a JSON object for referrer if it exists
        CASE 
          WHEN p.id IS NOT NULL THEN 
            jsonb_build_object(
              'id', p.id, 
              'full_name', p.full_name, 
              'username', p.username,
              'phone', p.phone
              )
          ELSE NULL 
        END as referrer
       FROM users u
       LEFT JOIN users p ON u.referrer_id = p.id
       LEFT JOIN LATERAL (
         SELECT lc.level_no, lc.level_name, lc.commission_percentage
         FROM level_commissions lc
         WHERE lc.team_size <= (
           SELECT COUNT(*) 
           FROM users sub 
           WHERE sub.node_path <@ u.node_path AND sub.id != u.id
         )
         ORDER BY lc.level_no DESC
         LIMIT 1
       ) lc ON true
       WHERE u.node_path <@ (SELECT node_path FROM users WHERE id = $1)::ltree`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, error: "User not found" });
    }

    const flatData = result.rows;

    // 2. Helper function to build the tree
    const buildTree = (data, rootId) => {
      return data
        .filter((item) => item.referrer_id === rootId)
        .map((item) => ({
          ...item,
          children: buildTree(data, item.id),
        }));
    };

    // 3. Find the "Top Parent" object (the logged-in user)
    const topUser = flatData.find((u) => u.id === userId);

    // 4. Build children for the top user and return as a single object (or array)
    const tree = {
      ...topUser,
      children: buildTree(flatData, userId),
    };

    // Wrapping in an array [tree] to keep it consistent with your previous structure
    res.json({ status: true, data: [tree] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.getProfile = async (req, res) => {
  try {
    const { referral_code } = req.query;

    // 1. Validation: Ensure the parameter exists
    if (!referral_code) {
      return res
        .status(400)
        .json({ status: false, error: "Referral code is required" });
    }

    // 2. Fix: Pass parameters inside an array [referral_code]
    const user = await db.query(
      'SELECT id, full_name AS "name", referral_code, binary_path FROM users WHERE referral_code = $1',
      [referral_code],
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ status: false, error: "User not found" });
    }

    const children = await db.query(
      `SELECT position FROM users 
         WHERE subpath(binary_path, 0, nlevel(binary_path)-1) = $1
         FOR UPDATE`,
      [user.rows[0].binary_path],
    );

    const taken = children.rows.map((r) => r.position);

    // 🔥 AUTO LEFT → RIGHT → REJECT
    let position = 0;
    if (!taken.includes(1)) {
      position = 1;
    } else if (!taken.includes(2)) {
      position = 2;
    } else {
      position = "Both legs are already filled";
    }

    res.json({ status: true, user: user.rows[0], position });
  } catch (err) {
    // 3. Security: Don't send raw error messages to the client in production
    console.error(err);
    res.status(500).json({ status: false, error: "Internal server error" });
  }
};

exports.getKycStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      "SELECT u.kyc_status, k.* FROM users u LEFT JOIN kyc_requests k ON k.user_id = u.id   WHERE u.id = $1",
      [userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, error: "User not found" });
    }
    res.json({
      status: true,
      kyc_status: result.rows[0].kyc_status,
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: false, error: "Unauthorized" });
    }

    const body = req.body || {};

    // Whitelist fields that can be updated in `users` table
    const allowedFields = [
      "full_name",
      "email",
      "phone",
      "whatsapp_no",
      "aadhaar_no",
      "pan_no",
      "dob",
      "gender",
      "address",
      "city",
      "state",
      "pin",
      "bank_name",
      "account_holder_name",
      "account_no",
      "ifsc_code",
      "branch",
    ];

    // Client might send camelCase too (common with your createUser)
    const camelMap = {
      fullName: "full_name",
      whatsappNo: "whatsapp_no",
      aadhaarNo: "aadhaar_no",
      panNo: "pan_no",
      bankName: "bank_name",
      accountHolderName: "account_holder_name",
      accountNo: "account_no",
      ifscCode: "ifsc_code",
    };

    for (const [k, v] of Object.entries(camelMap)) {
      if (body[k] !== undefined && body[v] === undefined) {
        body[v] = body[k];
      }
    }

    const updates = [];
    const values = [];
    let idx = 1;

    // Unique checks (only if changed)
    if (body.email !== undefined) {
      const current = await db.query("SELECT email FROM users WHERE id = $1", [
        userId,
      ]);
      const currentEmail = current.rows[0]?.email;

      if (body.email && body.email !== currentEmail) {
        const exists = await db.query(
          "SELECT id FROM users WHERE email = $1 AND id != $2",
          [body.email, userId],
        );
        if (exists.rows.length > 0) {
          return res
            .status(400)
            .json({ status: false, error: "Email already in use" });
        }
      }
    }

    if (body.phone !== undefined) {
      const current = await db.query("SELECT phone FROM users WHERE id = $1", [
        userId,
      ]);
      const currentPhone = current.rows[0]?.phone;
      if (body.phone && body.phone !== currentPhone) {
        const exists = await db.query(
          "SELECT id FROM users WHERE phone = $1 AND id != $2",
          [body.phone, userId],
        );
        if (exists.rows.length > 0) {
          return res
            .status(400)
            .json({ status: false, error: "Phone already in use" });
        }
      }
    }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ status: false, error: "No valid fields to update" });
    }

    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${idx}
      RETURNING id, full_name, email, phone, whatsapp_no, address, city, state, pin, bank_name, account_holder_name, account_no, ifsc_code, branch, aadhaar_no, pan_no, dob, gender
    `;

    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, error: "User not found" });
    }

    return res.json({
      status: true,
      message: "Profile updated",
      user: result.rows[0],
    });
  } catch (err) {
    // unique constraint fallback (email/phone)
    if (err.code === "23505") {
      return res.status(400).json({ status: false, error: "Duplicate value" });
    }
    console.error(err);
    return res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.updateUserAccount = async (req, res) => {
  try {
    // Support both self-update and admin-update-by-id
    const userId = req.params.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: false, error: "Unauthorized" });
    }

    const body = req.body || {};

    // Whitelist fields that can be updated (bank + nominee + aadhaar/pan)
    const allowedFields = [
      "aadhaar_no",
      "pan_no",
      "bank_name",
      "account_holder_name",
      "account_no",
      "ifsc_code",
      "branch",
      "nominee_name",
      "nominee_relationship",
      "nominee_age",
      "nominee_contact",
      "nominee_aadhaar",
    ];

    // Client might send camelCase too
    const camelMap = {
      aadhaarNo: "aadhaar_no",
      panNo: "pan_no",
      bankName: "bank_name",
      accountHolderName: "account_holder_name",
      accountNo: "account_no",
      ifscCode: "ifsc_code",
      nomineeName: "nominee_name",
      nomineeRelationship: "nominee_relationship",
      nomineeAge: "nominee_age",
      nomineeContact: "nominee_contact",
      nomineeAadhaar: "nominee_aadhaar",
    };

    for (const [k, v] of Object.entries(camelMap)) {
      if (body[k] !== undefined && body[v] === undefined) {
        body[v] = body[k];
      }
    }

    const updates = [];
    const values = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ status: false, error: "No valid fields to update" });
    }

    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${idx}
      RETURNING id, aadhaar_no, pan_no, bank_name, account_holder_name,
        account_no, ifsc_code, branch, nominee_name, nominee_relationship,
        nominee_age, nominee_contact, nominee_aadhaar
    `;

    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, error: "User not found" });
    }

    return res.json({
      status: true,
      message: "User account updated successfully",
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.updateKycStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, remark } = req.body; // status: true/false, remark: optional rejection reason

    if (status === undefined) {
      return res
        .status(400)
        .json({ status: false, error: "Status required (true/false)" });
    }

    const result = await db.query(
      "UPDATE users SET kyc_status = $1 WHERE id = $2 RETURNING id, kyc_status",
      [status, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, error: "User not found" });
    }

    // Optional: Log admin action or notify user
    console.log(
      `KYC ${status ? "approved" : "rejected"} for user ${userId}${
        remark ? ` - ${remark}` : ""
      }`,
    );

    res.json({
      status: true,
      message: `KYC ${status ? "approved" : "rejected"} successfully`,
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

const generateUsername = async (client) => {
  let username;
  let attempts = 0;

  while (attempts < 5) {
    username = crypto.randomInt(1000000000, 9999999999).toString();

    const exists = await client.query(
      "SELECT 1 FROM users WHERE username = $1",
      [username],
    );

    if (exists.rows.length === 0) return username;
    attempts++;
  }

  throw new Error("Failed to generate username");
};

const QRCode = require("qrcode");

const generateQrcode = async (referral_code) => {
  const registrationLink = `https://panel.feelsafeco.in/signup?ref=${referral_code}`;

  // Folder path define karein

  const uploadDir = pathModule.join("uploads", "qrcodes");
  await fs.mkdir(uploadDir, { recursive: true });

  const safeFileName = `${referral_code}.png`;
  const filePath = pathModule.join(uploadDir, safeFileName);

  try {
    // 2. Ab QR code generate karke file system mein save karein
    await QRCode.toFile(filePath, registrationLink, {
      color: {
        dark: "#000000", // Black dots
        light: "#FFFFFF", // White background
      },
      width: 500,
    });

    return filePath;
  } catch (err) {
    console.error("QR generation error details:", err);
    throw new Error(`Qr code generate error - ${err.message}`);
  }
};

exports.createUser = async (req, res) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const {
      fullName: full_name,
      aadhaarNo: aadhaar_no,
      dob,
      gender,
      panNo: pan_no,
      email,
      whatsappNo: whatsapp_no,
      phone,
      address,
      city,
      state,
      pin,
      bankName: bank_name,
      accountHolderName: account_holder_name,
      accountNo: account_no,
      ifscCode: ifsc_code,
      branch,

      referrerName: referrer_name,
      referrerContact: referrer_contact,
      referral_code,
      nomineeName: nominee_name,
      nomineeRelationship: nominee_relationship,
      nomineeAge: nominee_age,
      nomineeContact: nominee_contact,
      nomineeAadhaar: nominee_aadhaar,
      businessLevel: business_level,
      agreedToTerms: agreed_to_terms,
      password,
      referrer_id,
      gstin: gst_no,
    } = req.body;

    if (!password) {
      throw new Error("Password is required");
    }

    // 🔹 Generate Username

    const username = await generateUsername(client);

    // 🔹 Password Hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 🔥 REFERRER + LOCK
    let nodePath = username;
    let binaryPath = "1";
    let position = null;

    let calculatedBusinessLevel = 0; // Default for root

    if (referrer_id) {
      const referrer = await client.query(
        "SELECT node_path, binary_path FROM users WHERE id = $1 FOR UPDATE",
        [referrer_id],
      );

      if (referrer.rows.length === 0) {
        throw new Error("Invalid referrer");
      }

      const parent = referrer.rows[0];

      nodePath = `${parent.node_path}.${username}`;

      // 🔥 LOCK CHILDREN
      const children = await client.query(
        `SELECT position FROM users 
         WHERE subpath(binary_path, 0, nlevel(binary_path)-1) = $1
         FOR UPDATE`,
        [parent.binary_path],
      );

      const taken = children.rows.map((r) => r.position);

      // 🔥 AUTO LEFT → RIGHT → REJECT
      if (!taken.includes(1)) {
        position = 1;
      } else if (!taken.includes(2)) {
        position = 2;
      } else {
        throw new Error("Both legs are already filled");
      }

      binaryPath = `${parent.binary_path}.${position}`;
      // calculatedBusinessLevel = binaryPath.split(".").length;
    } else {
      // Agar referrer_id nahi hai, toh check karein kya system mein pehle se koi Root hai?
      const rootCheck = await client.query(
        "SELECT 1 FROM users WHERE binary_path = '1'",
      );
      if (rootCheck.rows.length > 0) {
        throw new Error(
          "System already has a root user. A referrer ID is required for new registrations.",
        );
      }
      // Agar koi nahi hai, tabhi ise path '1' milega
      binaryPath = "1";
      nodePath = username;
    }

    // 🔹 Referral Code Logic (same as yours)
    let finalReferralCode = referral_code;

    if (finalReferralCode) {
      const exists = await client.query(
        "SELECT 1 FROM users WHERE referral_code = $1",
        [finalReferralCode],
      );
      if (exists.rows.length > 0) {
        throw new Error("Referral code already exists");
      }
    } else {
      const now = new Date();
      const year = (now.getFullYear() % 100).toString().padStart(2, "0");
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      const prefix = `FS${year}${month}`;

      let sn = 1;

      while (true) {
        const snStr = sn.toString().padStart(4, "0");
        const candidate = `${prefix}${snStr}`;

        const exists = await client.query(
          "SELECT 1 FROM users WHERE referral_code = $1",
          [candidate],
        );

        if (exists.rows.length === 0) {
          finalReferralCode = candidate;
          break;
        }

        sn++;
        if (sn > 9999) {
          throw new Error("Referral code limit reached");
        }
      }
    }

    // 🔥 FINAL INSERT
    const newUser = await client.query(
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
      $32,$33,$34, $35, $36
      ) RETURNING *`,
      [
        full_name || null,
        aadhaar_no || null,
        dob,
        gender || null,
        pan_no || null,
        email || null,
        phone || null,
        whatsapp_no || null,
        address || null,
        city || null,
        state || null,
        pin || null,
        bank_name || null,
        account_holder_name || null,
        account_no || null,
        ifsc_code || null,
        branch || null,
        finalReferralCode,
        referrer_name || null,
        referrer_contact || null,
        nominee_name || null,
        nominee_relationship || null,
        nominee_age,
        nominee_contact || null,
        nominee_aadhaar || null,
        0,
        !!agreed_to_terms,
        false,
        username,
        hashedPassword,
        referrer_id || null,
        nodePath,
        binaryPath,
        position,
        false,
        gst_no || "",
      ],
    );

    await client.query(
      "INSERT INTO wallets (user_id, total_amount, left_count, right_count, paid_pairs) VALUES ($1, 0, 0, 0, 0)",
      [newUser.rows[0].id],
    );

    await generateQrcode(finalReferralCode);

    await client.query("COMMIT");

    res.status(201).json({
      status: true,
      message: "User created successfully",
      user: newUser.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error(err.message);

    res.status(400).json({
      status: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};

exports.uploadKycDocuments = async (req, res) => {
  try {
    // multer multipart parse ke baad ye id req.body me aani chahiye
    const userId = req.body?.id;

    console.log("Received KYC upload request for user ID:", req.body);
    console.log("Files received:", req.files);

    if (!userId) {
      return res.status(400).json({
        status: false,
        error: "User id is required (form-data field name: id)",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ status: false, error: "No files uploaded" });
    }

    const uploadDir = pathModule.join("uploads", "kyc", userId.toString());
    await fs.mkdir(uploadDir, { recursive: true });

    const documentTypes = [
      "PAN",
      "Aadhaar_Front",
      "Aadhaar_Back",
      "passbook",
      "profile",
      "gstin",
    ]; // Allowed types
    const uploadedFiles = [];

    for (const file of req.files) {
      const docType = file.fieldname || "unknown"; // fieldname = document_type from form
      if (!documentTypes.includes(docType.replace(/[_-]/g, "_"))) {
        continue; // Skip invalid types
      }

      const safeFileName =
        docType.toLowerCase().replace(/[^a-z0-9]/g, "_") + ".jpg";
      const filePath = pathModule.join(uploadDir, safeFileName);
      const publicUrl = `${process.env.APP_URL}/uploads/kyc/${userId}/${safeFileName}`;

      await fs.writeFile(filePath, file.buffer);

      // Insert or UPSERT document record
      await db.query(
        `
        INSERT INTO kyc_documents (user_id, document_type, file_url, status, doc_no)
        VALUES ($1, $2, $3, 'pending', $4)
        ON CONFLICT (user_id, document_type) 
        DO UPDATE SET file_url = $3, status = 'pending', updated_at = CURRENT_TIMESTAMP
      `,
        [userId, docType.replace(/[_-]/g, " "), publicUrl, ""],
      ); // doc_no optional

      uploadedFiles.push({ type: docType, url: publicUrl });
    }

    res.json({
      status: true,
      message: "KYC documents uploaded successfully",
      files: uploadedFiles,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, error: "Server error uploading files" });
  }
};

exports.updateKycDocument = async (req, res) => {
  try {
    console.log("start");

    const { docId } = req.params;
    const { status } = req.body;

    if (!["pending", "under_review", "approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ status: false, error: "Invalid status value" });
    }

    await db.query(
      `UPDATE kyc_documents 
      SET status = $1, 
      updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 RETURNING user_id, document_type`,
      [status, docId],
    );
    res.json({
      status: true,
      message: `Document status updated to ${status} successfully`,
      document_id: docId,
    });
  } catch (error) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, error: "Server error uploading files" });
  }
};

exports.submitKycRequest = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user already has pending/submitted request
    const existing = await db.query(
      "SELECT id, status FROM kyc_requests WHERE user_id = $1 AND status IN ($2, $3)",
      [userId, "pending", "submitted"],
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        status: false,
        error: `KYC request already ${existing.rows[0].status}`,
      });
    }

    // Check if has all required documents
    const docs = await db.query(
      "SELECT document_type FROM kyc_documents WHERE user_id = $1 AND status = $2",
      [userId, "pending"],
    );
    const required = [
      "PAN",
      "Aadhaar Front",
      "Aadhaar Back",
      "passbook",
      "profile",
    ];
    const hasRequired = required.every((type) =>
      docs.rows.some((d) => d.document_type === type),
    );
    if (!hasRequired) {
      return res.status(400).json({
        status: false,
        error: "Missing required KYC documents. Please upload all first.",
      });
    }

    // Create request + update docs to under_review
    const requestResult = await db.query(
      "INSERT INTO kyc_requests (user_id, status) VALUES ($1, $2) RETURNING *",
      [userId, "under_review"],
    );

    await db.query("UPDATE kyc_documents SET status = $1 WHERE user_id = $2", [
      "under_review",
      userId,
    ]);

    res.json({
      status: true,
      message: "KYC request submitted successfully for admin review",
      request: requestResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, error: "Server error submitting request" });
  }
};

// Set transaction PIN (after KYC)
exports.setTransactionPin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pin } = req.body;

    if (!pin || pin.length < 4 || pin.length > 6 || !/^[0-9]+$/.test(pin)) {
      return res
        .status(400)
        .json({ status: false, error: "PIN must be 4-6 digits" });
    }

    // Check KYC
    const kycStatus = await db.query(
      "SELECT kyc_status FROM users WHERE id = $1",
      [userId],
    );
    if (!kycStatus.rows[0]?.kyc_status) {
      return res
        .status(400)
        .json({ status: false, error: "KYC approval required to set PIN" });
    }

    const hash = await bcrypt.hash(pin, 10);

    await db.query("UPDATE users SET transaction_pin_hash = $1 WHERE id = $2", [
      hash,
      userId,
    ]);

    res.json({
      status: true,
      hash,
      message: "Transaction PIN set successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

// Change password (60 day rule)
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await db.query(
      "SELECT password_hash, last_password_change FROM users WHERE id = $1",
      [userId],
    );
    if (user.rows.length === 0)
      return res.status(404).json({ status: false, error: "User not found" });

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.rows[0].password_hash,
    );
    if (!isMatch)
      return res
        .status(400)
        .json({ status: false, error: "Invalid current password" });

    // 60 day check
    const lastChange = user.rows[0].last_password_change;
    if (
      lastChange &&
      Date.now() - new Date(lastChange).getTime() < 60 * 24 * 60 * 60 * 1000
    ) {
      return res.status(400).json({
        status: false,
        error: "Password must be changed every 60 days minimum",
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      "UPDATE users SET password_hash = $1, last_password_change = CURRENT_TIMESTAMP WHERE id = $2",
      [newHash, userId],
    );

    res.json({ status: true, message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

// reset password flow
// step 1 - send otp
const phoneRegex = /^[6-9]\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.sendOtp = async (req, res) => {
  try {
    const { identifier, purpose = "reset-password" } = req.body;

    if (!identifier) {
      return res
        .status(400)
        .json({ success: false, error: "Identifier is required" });
    }

    // 1. Determine if identifier is email or phone
    let queryField = "";
    if (phoneRegex.test(identifier)) {
      queryField = "phone";
    } else if (emailRegex.test(identifier)) {
      queryField = "email";
    } else {
      return res.status(400).json({
        success: false,
        error: "Enter valid 10-digit phone or email",
      });
    }

    // 2. Find the user by that specific field
    const userResult = await db.query(
      `SELECT id, email, phone FROM users WHERE ${queryField} = $1`,
      [identifier],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = userResult.rows[0];

    // 3. Send OTP using the found user's ID
    const result = await otpService.sendOTP(user.id, purpose);

    res.json({
      success: true,
      message: `OTP sent to ${result.sentTo}`,
      expiresAt: result.expiresAt,
      otp: result.otp,
    });
  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { identifier, otp, purpose = "reset-password", type } = req.body;

    // 1. Basic Validation
    if (!identifier || !otp) {
      return res
        .status(400)
        .json({ success: false, error: "Identifier and OTP are required" });
    }

    // 2. Determine if identifier is email or phone
    let queryField = "";
    if (phoneRegex.test(identifier)) {
      queryField = "phone";
    } else if (emailRegex.test(identifier)) {
      queryField = "email";
    } else {
      return res
        .status(400)
        .json({ success: false, error: "Invalid email or phone format" });
    }

    // 3. Find user and their OTP record in one flow (or two queries)
    const userResult = await db.query(
      `SELECT id FROM users WHERE ${queryField} = $1`,
      [identifier],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const userId = userResult.rows[0].id;

    // 4. Check the OTP table
    const otpResult = await db.query(
      `SELECT * FROM user_otps WHERE user_id = $1 AND purpose = $2`,
      [userId, purpose],
    );

    if (otpResult.rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No OTP found for this user" });
    }

    const dbOtp = otpResult.rows[0];

    // 5. Check if expired
    if (new Date() > new Date(dbOtp.expires_at)) {
      return res.status(400).json({ success: false, error: "OTP has expired" });
    }

    // 6. Check if match
    if (dbOtp.otp !== otp) {
      return res.status(400).json({ success: false, error: "Incorrect OTP" });
    }

    // 7. Success! Delete the OTP so it can't be used again
    await db.query(
      `DELETE FROM user_otps WHERE user_id = $1 AND purpose = $2`,
      [userId, purpose],
    );

    res.json({
      success: true,
      message: "OTP verified successfully",
      userId: userId, // You can return this to proceed with password reset
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { identifier, newPassword, otp } = req.body;

    // 1. Basic Validation
    if (!identifier || !newPassword || !otp) {
      return res
        .status(400)
        .json({ success: false, error: "All fields are required" });
    }

    // 2. Identify if identifier is email or phone
    const phoneRegex = /^[6-9]\d{9}$/;
    const queryField = phoneRegex.test(identifier) ? "phone" : "email";

    // 3. Find user and their OTP
    const userResult = await db.query(
      `SELECT u.id 
       FROM users u        
       WHERE u.${queryField} = $1 `,
      [identifier],
    );

    if (userResult.rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid request or OTP expired" });
    }

    const { id: userId } = userResult.rows[0];

    // 5. Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 6. Update password and delete the used OTP in a transaction
    await db.query("BEGIN");

    await db.query(
      "UPDATE users SET password_hash = $1, last_password_change = NOW() WHERE id = $2",
      [hashedPassword, userId],
    );

    await db.query("COMMIT");

    res.json({
      success: true,
      message: "Password has been reset successfully. You can now login.",
    });
  } catch (error) {
    await db.query("ROLLBACK"); // Cancel database changes if something fails
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: false, error: "Unauthorized" });
    }

    // Expect the file under the field name "profile" (multipart/form-data)
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        status: false,
        error: "Profile image is required (form-data field name: profile)",
      });
    }

    // Ensure the destination folder exists
    const uploadDir = pathModule.join("uploads", "profile_pics");
    await fs.mkdir(uploadDir, { recursive: true });

    // Build a safe file name (keep original extension if present)
    const ext = pathModule.extname(file.originalname) || ".jpg";
    const safeFileName = `${userId}_${Date.now()}${ext}`;
    const filePath = pathModule.join(uploadDir, safeFileName);

    // Save the buffer to disk
    await fs.writeFile(filePath, file.buffer);

    const publicUrl = `${process.env.APP_URL}/uploads/profile_pics/${safeFileName}`;

    // Persist the URL in the kyc_documents table (document_type = 'profile')
    await db.query(
      `UPDATE kyc_documents
       SET file_url = $1, status = 'pending', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND document_type = 'profile'`,
      [publicUrl, userId],
    );

    res.json({
      status: true,
      message: "Profile picture updated successfully",
      profile_pic: publicUrl,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, error: "Server error uploading profile picture" });
  }
};

exports.checkGST = async (req, res) => {
  try {
    const { gst_no } = req.params;

    if (!gst_no) {
      return res
        .status(400)
        .json({ status: false, message: "GST number is required" });
    }

    // Normalize: trim spaces and convert to uppercase for a consistent comparison
    const normalizedGst = gst_no.trim().toUpperCase();

    if (normalizedGst.length < 15) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid GST number format" });
    }

    // Check if the GST number already exists in the users table
    const exists = await db.query(
      "SELECT id FROM users WHERE UPPER(TRIM(gstin)) = $1",
      [normalizedGst],
    );

    if (exists.rows.length > 0) {
      return res.status(200).json({
        status: false,
        exists: true,
        message:
          "GST number already in use. Duplicate GST numbers are not allowed.",
      });
    }

    return res.status(200).json({
      status: true,
      exists: false,
      message: "GST number is available",
    });
  } catch (err) {
    console.error("Error checking GST - ", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
