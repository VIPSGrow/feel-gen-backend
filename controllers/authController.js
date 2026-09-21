const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const otpService = require("../utils/otpService");
const evaluateAndUpgradeRank = require("../services/commission/RankUpgrade");

// exports.register = async (req, res) => {
//     const { phone, email, password, referrer_id } = req.body;

//     if (!phone || !password) {
//         return res.status(400).json({ message: 'Phone and password are required' });
//     }

//     try {
//         // Auto-generate unique 10-digit username
//         const generateUsername = async () => {
//             let username;
//             let attempts = 0;
//             while (attempts < 3) {
//                 username = crypto.randomInt(1000000000, 9999999999).toString();
//                 const exists = await db.query('SELECT 1 FROM users WHERE username = $1', [username]);
//                 if (exists.rows.length === 0) return username;
//                 attempts++;
//             }
//             throw new Error('Failed to generate unique username');
//         };

//         const username = await generateUsername();

//         // Hash password
//         const salt = await bcrypt.genSalt(10);
//         const hashedPassword = await bcrypt.hash(password, salt);

//         let nodePath = '';
//         if (referrer_id) {
//             const referrer = await db.query('SELECT node_path FROM users WHERE id = $1', [referrer_id]);
//             if (referrer.rows.length > 0) {
//                 nodePath = `${referrer.rows[0].node_path}.${username}`;
//             }
//         } else {
//             nodePath = username;
//         }

//         // Insert (phone after email)
//         const newUser = await db.query(
//             'INSERT INTO users (username, email, phone, password_hash, referrer_id, node_path) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
//             [username, email, phone, hashedPassword, referrer_id, nodePath]
//         );

//         res.status(201).json({ message: "User registered successfully", user: newUser.rows[0] });
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).send('Server Error');
//     }
// };

exports.register = async (req, res) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { phone, email, password, referrer_id } = req.body;

    if (!phone || !password) {
      return res
        .status(400)
        .json({ message: "Phone and password are required" });
    }

    const generateUsername = async () => {
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

      throw new Error("Username generation failed");
    };

    const username = await generateUsername();

    const generateReferralCode = async () => {
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

        if (exists.rows.length === 0) return candidate;

        sn++;
        if (sn > 9999) throw new Error("Referral code limit reached");
      }
    };

    const referralCode = await generateReferralCode();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let referrerInfo = null;
    let nodePath = username;
    let referrerName = null;
    let referrerContact = null;

    if (referrer_id) {
      const referrerRes = await client.query(
        "SELECT id, node_path, full_name, phone FROM users WHERE id = $1 FOR UPDATE",
        [referrer_id],
      );

      if (referrerRes.rows.length === 0) {
        throw new Error("Invalid referrer");
      }

      referrerInfo = referrerRes.rows[0];
      const parentPath = referrerInfo.node_path || referrerInfo.id.toString();
      const childCount = await client.query(
        "SELECT COUNT(*) FROM users WHERE referrer_id = $1",
        [referrer_id],
      );
      nodePath = `${parentPath}.${parseInt(childCount.rows[0].count) + 1}`;
      referrerName = referrerInfo.full_name;
      referrerContact = referrerInfo.phone;
    } else {
      const rootCheck = await client.query("SELECT 1 FROM users LIMIT 1");
      if (rootCheck.rows.length > 0) {
        throw new Error(
          "A referrer ID is required for new registrations after the first user.",
        );
      }
      nodePath = "root";
    }

    const newUser = await client.query(
      `INSERT INTO users
          (username, email, phone, password_hash, referrer_id, referral_code,
           referrer_name, referrer_contact, node_path, is_active, kyc_status,
           business_level, agreed_to_terms)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          RETURNING *`,
      [
        username,
        email || null,
        phone,
        hashedPassword,
        referrer_id || null,
        referralCode,
        referrerName,
        referrerContact,
        nodePath,
        false,
        false,
        0,
        false,
      ],
    );

    await client.query(
      `INSERT INTO wallets
        (user_id, total_amount, pending_amount, left_count, right_count, paid_pairs, company_fund, withdrawable_amount)
       VALUES ($1, 0, 0, 0, 0, 0, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.rows[0].id],
    );

    // New team member increases team_size for every ancestor - re-evaluate rank for each.
    let ancestorId = referrer_id || null;
    while (ancestorId) {
      await evaluateAndUpgradeRank(client, ancestorId);
      const ancestorRes = await client.query(
        `SELECT referrer_id FROM users WHERE id = $1`,
        [ancestorId],
      );
      ancestorId = ancestorRes.rows[0]?.referrer_id || null;
    }

    await client.query("COMMIT");

    const createdUser = newUser.rows[0];
    delete createdUser.password_hash;

    res.status(201).json({
      message: "User registered successfully",
      user: createdUser,
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error(err.message);

    res.status(400).json({
      message: err.message || "Registration failed",
    });
  } finally {
    client.release();
  }
};

exports.sendLoginOtp = async (req, res) => {
  const { identifier } = req.body;

  if (!identifier) {
    return res
      .status(400)
      .json({ status: false, message: "Identifier required" });
  }

  try {
    const userResult = await db.query(
      "SELECT id FROM users WHERE username = $1 OR phone = $1 OR email = $1 LIMIT 1",
      [identifier],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const result = await otpService.sendOTP(userResult.rows[0].id, "login");

    res.json({
      status: true,
      message: `OTP sent to ${result.sentTo}`,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// exports.login = async (req, res) => {
//   const { identifier, password, otp } = req.body;

//   if (!identifier || !password) {
//     return res.status(400).json({
//       message: "Identifier and password required",
//     });
//   }

//   try {
//     const userResult = await db.query(
//       "SELECT * FROM users WHERE username = $1 OR phone = $1 OR email = $1 LIMIT 1",
//       [identifier],
//     );

//     if (userResult.rows.length === 0) {
//       return res
//         .status(202)
//         .json({ status: false, message: "Invalid credentials" });
//     }

//     const user = userResult.rows[0];
//     const now = new Date();

//     if (user.locked_until && new Date(user.locked_until) > now) {
//       if (!otp) {
//         return res.status(423).json({
//           status: false,
//           requires_otp: true,
//           message: "Account locked. OTP required to unlock.",
//         });
//       }

//       const otpValid = await otpService.verifyOTP(user.id, otp, "login");
//       if (!otpValid) {
//         return res.status(400).json({ status: false, message: "Invalid OTP" });
//       }

//       await db.query(
//         "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1",
//         [user.id],
//       );
//     } else if (user.failed_attempts >= 3) {
//       await db.query(
//         "UPDATE users SET locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $1",
//         [user.id],
//       );
//       return res.status(423).json({
//         status: false,
//         requires_otp: true,
//         message: "Too many attempts. Locked for 15 min. Get OTP first.",
//       });
//     }

//     const isMatch = await bcrypt.compare(password, user.password_hash);
//     console.log("match - ", isMatch);

//     if (!isMatch) {
//       await db.query(
//         "UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = $1",
//         [user.id],
//       );

//       const updated = await db.query(
//         "SELECT failed_attempts FROM users WHERE id = $1",
//         [user.id],
//       );
//       if (updated.rows[0].failed_attempts >= 3) {
//         await db.query(
//           "UPDATE users SET locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $1",
//           [user.id],
//         );
//       }

//       return res
//         .status(202)
//         .json({ status: false, message: "Invalid credentials" });
//     }

//     await db.query(
//       "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1",
//       [user.id],
//     );

//     const profile = await db.query(
//       "SELECT file_url FROM kyc_documents WHERE user_id = $1 AND document_type = 'profile' LIMIT 1",
//       [user.id],
//     );

//     const userWithPic = {
//       ...user.toObject(),
//       profile_pic: profile.rows[0]?.file_url || null,
//     };

//     const token = jwt.sign(
//       {
//         id: user.id,
//         role: user.role || "user",
//         username: user.username,
//         kyc_status: user.kyc_status,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "1d" },
//     );

//     res.json({
//       status: true,
//       token,
//       user: userWithPic,
//     });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).json({ status: false, message: "Server Error" });
//   }
// };

exports.login = async (req, res) => {
  // Destructure phone and email from body in case identifier is just a label
  const { identifier, password, otp, phone, email } = req.body;

  // 1. Resolve the actual identity value
  // If identifier is "phone", use the phone field. If it's "email", use email field.
  // Otherwise, assume identifier itself is the value.
  const identityValue =
    identifier === "phone"
      ? phone
      : identifier === "email"
      ? email
      : identifier;

  if (!identityValue || !password) {
    return res.status(400).json({
      status: false,
      message: "Credentials required",
    });
  }

  try {
    const userResult = await db.query(
      `SELECT u.*, 
        c.name AS city_name, 
        s.name AS state_name,
        COALESCE(r.name, 'user') as role_name, 
        COALESCE(r.permissions, '[]'::JSONB) as role_permissions 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        LEFT JOIN cities c ON u.city::integer = c.id 
        LEFT JOIN states s ON u.state::integer = s.id
        WHERE u.username = $1 OR u.phone = $1 OR u.email = $1 LIMIT 1`,
      [identityValue],
    );

    if (userResult.rows.length === 0) {
      return res
        .status(202)
        .json({ status: false, message: "Invalid credentials" });
    }

    const user = userResult.rows[0];
    const now = new Date();

    // 2. Lock Logic
    if (user.locked_until && new Date(user.locked_until) > now) {
      if (!otp) {
        return res.status(203).json({
          status: false,
          requires_otp: true,
          message: "Account locked. OTP required to unlock.",
        });
      }

      const otpValid = await otpService.verifyOTP(user.id, otp, "login");
      if (!otpValid) {
        return res.status(400).json({ status: false, message: "Invalid OTP" });
      }

      await db.query(
        "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1",
        [user.id],
      );
    } else if (
      user.failed_attempts >= 3 &&
      (!user.locked_until || new Date(user.locked_until) < now)
    ) {
      // If they reached 3 attempts but weren't locked yet, lock them now
      await db.query(
        "UPDATE users SET locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $1",
        [user.id],
      );
      return res.status(423).json({
        status: false,
        message: "Too many attempts. Locked for 15 min.",
      });
    }

    // 3. Password Verification
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      await db.query(
        "UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = $1",
        [user.id],
      );

      // Re-check if this attempt triggered a lock
      if (user.failed_attempts + 1 >= 3) {
        await db.query(
          "UPDATE users SET locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $1",
          [user.id],
        );
      }

      return res
        .status(202)
        .json({ status: false, message: "Invalid credentials" });
    }

    // 4. Success - Clear fails
    await db.query(
      "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1",
      [user.id],
    );

    // 5. Get Profile Pic
    const profile = await db.query(
      "SELECT file_url FROM kyc_documents WHERE user_id = $1 AND document_type = 'profile' LIMIT 1",
      [user.id],
    );

    // FIX: Removed .toObject() because it's PG, not Mongoose
    // Also remove sensitive data before sending to frontend
    const { password_hash, transaction_pin_hash, ...safeUser } = user;

    const userWithPic = {
      ...safeUser,
      profile_pic: profile.rows[0]?.file_url || null,
    };

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role_id ? user.role_name : user.role,
        username: user.username,
        kyc_status: user.kyc_status,
        permissions: Array.isArray(user.role_permissions)
          ? user.role_permissions
          : [],
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      status: true,
      token,
      user: userWithPic,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server Error" });
  }
};

// get user by id
exports.getUserById = async (req, res) => {
  // Destructure phone and email from body in case identifier is just a label
  const { user_id } = req.params;

  try {
    const userResult = await db.query(
      `SELECT u.*, 
        c.name AS city_name, 
        s.name AS state_name,
        COALESCE(r.name, 'user') as role_name, 
        COALESCE(r.permissions, '[]'::JSONB) as role_permissions 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        LEFT JOIN cities c ON u.city::integer = c.id 
        LEFT JOIN states s ON u.state::integer = s.id
        WHERE u.id = $1 LIMIT 1`,
      [user_id],
    );

    if (userResult.rows.length === 0) {
      return res
        .status(202)
        .json({ status: false, message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    // 5. Get Profile Pic
    const profile = await db.query(
      "SELECT file_url FROM kyc_documents WHERE user_id = $1 AND document_type = 'profile' LIMIT 1",
      [user.id],
    );

    // FIX: Removed .toObject() because it's PG, not Mongoose
    // Also remove sensitive data before sending to frontend
    const { password_hash, transaction_pin_hash, ...safeUser } = user;

    const userWithPic = {
      ...safeUser,
      profile_pic: profile.rows[0]?.file_url || null,
    };

    res.json({
      status: true,
      user: userWithPic,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server Error" });
  }
};
