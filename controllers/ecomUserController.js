const db = require("../config/db");

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      "SELECT id, name, email, phone, profile_image, distributor_code, status, email_verified_at, created_at FROM ecom_user WHERE id = $1",
      [userId],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ status: false, error: "User not found" });
    res.json({ status: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, email, profile_image, distributor_code } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1; // Hamesha 1 se start hoga

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (email !== undefined) {
      // Email unique check logic
      const current = await db.query(
        "SELECT email FROM ecom_user WHERE id = $1",
        [userId],
      );
      if (email && email !== current.rows[0]?.email) {
        const uniqueCheck = await db.query(
          "SELECT id FROM ecom_user WHERE email = $1 AND id != $2",
          [email, userId],
        );
        if (uniqueCheck.rows.length > 0) {
          return res
            .status(400)
            .json({ status: false, error: "Email already taken" });
        }
      }
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (profile_image !== undefined) {
      updates.push(`profile_image = $${paramIndex++}`);
      values.push(profile_image);
    }
    // Added distributor_code as you had it in your UI
    if (distributor_code !== undefined) {
      updates.push(`distributor_code = $${paramIndex++}`);
      values.push(distributor_code);
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ status: false, error: "No fields to update" });
    }

    // WHERE clause ke liye userId index
    const whereIndex = paramIndex;
    values.push(userId);

    const query = `
      UPDATE ecom_user 
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${whereIndex}
    `;

    await db.query(query, values);

    res.json({ status: true, message: "Profile updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

// exports.updateProfile = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { name, phone, email, profile_image } = req.body;

//     // Dynamic update with validation
//     const updates = [];
//     const values = [];
//     let paramIndex = 1;

//     if (name !== undefined) {
//       updates.push('name = $' + (paramIndex + 1));
//       values.push(name);
//       paramIndex++;
//     }
//     if (phone !== undefined) {
//       updates.push('phone = $' + (paramIndex + 1));
//       values.push(phone);
//       paramIndex++;
//     }
//     if (email !== undefined) {
//       // Check unique email if provided and different from current
//       const current = await db.query('SELECT email FROM ecom_user WHERE id = $1', [userId]);
//       if (email && email !== current.rows[0]?.email) {
//         const uniqueCheck = await db.query('SELECT id FROM ecom_user WHERE email = $1 AND id != $2', [email, userId]);
//         if (uniqueCheck.rows.length > 0) {
//           return res.status(400).json({ status: false, error: 'Email already taken' });
//         }
//       }
//       updates.push('email = $' + (paramIndex + 1));
//       values.push(email);
//       paramIndex++;
//     }
//     if (profile_image !== undefined) {
//       updates.push('profile_image = $' + (paramIndex + 1));
//       values.push(profile_image);
//       paramIndex++;
//     }

//     if (updates.length === 0) {
//       return res.status(400).json({ status: false, error: 'No fields to update' });
//     }

//     values.push(userId);
//     await db.query(
//       `UPDATE ecom_user SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`,
//       values
//     );

//     res.json({ status: true, message: 'Profile updated' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ status: false, error: 'Server error' });
//   }
// };

exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;
    let query =
      "SELECT * FROM e_user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC";
    if (type && type == "distributor") {
      query =
        "SELECT * FROM e_user_addresses WHERE distributor_id = $1 ORDER BY is_default DESC, created_at DESC";
    }
    const result = await db.query(query, [userId]);
    res.json({ status: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;
    const {
      full_name,
      phone,
      address_line1,
      address_line2,
      district,
      city,
      state,
      country,
      pincode,
      landmark,
      is_default,
    } = req.body;

    // Set is_default true only if first or explicitly set
    let hasAddressquery = "SELECT id FROM e_user_addresses WHERE user_id = $1";
    if (type && type == "distributor") {
      hasAddressquery =
        "SELECT id FROM e_user_addresses WHERE distributor_id = $1";
    }

    const hasAddress = await db.query(hasAddressquery, [userId]);
    const defaultVal = !hasAddress.rows.length || is_default === true;

    const result = await db.query(
      `INSERT INTO e_user_addresses (${
        type && type == "distributor" ? "distributor_id" : "user_id"
      }, full_name, phone, address_line1, address_line2, district, city, state, country, pincode, landmark, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        userId,
        full_name,
        phone,
        address_line1,
        address_line2,
        district,
        city,
        state,
        country,
        pincode,
        landmark,
        defaultVal,
      ],
    );

    if (defaultVal) {
      await db.query(
        `UPDATE e_user_addresses SET is_default = false WHERE ${
          type && type == "distributor" ? "distributor_id" : "user_id"
        } = $1 AND id != $2`,
        [userId, result.rows[0].id],
      );
    }

    res.status(201).json({ status: true, address: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const fields = req.body;

    // 1. Filter out keys that shouldn't be updated or are empty
    const keys = Object.keys(fields).filter(
      (key) => key !== "id" && key !== "user_id",
    );

    if (keys.length === 0) {
      return res
        .status(400)
        .json({ status: false, error: "No fields provided for update" });
    }

    const updates = [];
    const values = [];

    // 2. Build dynamic updates
    keys.forEach((key, index) => {
      // index starts at 0, so we use index + 1 for $1, $2, etc.
      updates.push(`${key} = $${index + 1}`);
      values.push(fields[key]);
    });

    // 3. Add userId and id at the end of the values array
    const nextIndex = values.length + 1; // Position for userId
    const lastIndex = values.length + 2; // Position for id
    values.push(userId, id);

    const query = `
      UPDATE e_user_addresses 
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${nextIndex} AND id = $${lastIndex} 
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ status: false, error: "Address not found" });
    }

    // 4. Handle default logic
    if (fields.is_default === true) {
      await db.query(
        "UPDATE e_user_addresses SET is_default = false WHERE user_id = $1 AND id != $2",
        [userId, id],
      );
    }

    res.json({ status: true, address: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await db.query(
      "DELETE FROM e_user_addresses WHERE user_id = $1 AND id = $2",
      [userId, id],
    );
    res.json({ status: true, message: "Address deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await db.query(
      "UPDATE e_user_addresses SET is_default = false WHERE user_id = $1",
      [userId],
    );
    await db.query(
      "UPDATE e_user_addresses SET is_default = true WHERE user_id = $1 AND id = $2",
      [userId, id],
    );
    res.json({ status: true, message: "Default address set" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

// =====================
// ECOM USERS (Admin/Distributor)
// =====================

exports.getAllEcomUsersForSuperAdmin = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, phone, profile_image, distributor_code, status, email_verified_at, created_at FROM ecom_user ORDER BY created_at DESC",
    );
    res.json({ status: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.updateEcomUserStatusForSuperAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    let { status } = req.body;

    if (status === "true") status = true;
    if (status === "false") status = false;

    if (typeof status !== "boolean") {
      return res
        .status(400)
        .json({ status: false, error: "Invalid status value" });
    }

    const result = await db.query(
      "UPDATE ecom_user SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, email, phone, profile_image, distributor_code, status, email_verified_at, created_at",
      [status, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, error: "User not found" });
    }

    res.json({ status: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

// Distributor: get users where ecom_user.distributor_code = users.referral_code
exports.getEcomUsersForDistributor = async (req, res) => {
  try {
    // authMiddleware sets req.user from `users` table in this project
    const distributorUserId = req.user.id;

    const distributorRes = await db.query(
      "SELECT referral_code FROM users WHERE id = $1",
      [distributorUserId],
    );

    if (distributorRes.rows.length === 0) {
      return res
        .status(404)
        .json({ status: false, error: "Distributor not found" });
    }

    const referralCode = distributorRes.rows[0].referral_code;

    const result = await db.query(
      "SELECT id, name, email, phone, profile_image, distributor_code, status, email_verified_at, created_at FROM ecom_user WHERE distributor_code = $1 ORDER BY created_at DESC",
      [referralCode],
    );

    res.json({ status: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.updateEcomUserStatusForDistributor = async (req, res) => {
  try {
    const distributorUserId = req.user.id;
    const { id } = req.params;

    let { status } = req.body;
    if (status === "true") status = true;
    if (status === "false") status = false;

    if (typeof status !== "boolean") {
      return res
        .status(400)
        .json({ status: false, error: "Invalid status value" });
    }

    const distributorRes = await db.query(
      "SELECT referral_code FROM users WHERE id = $1",
      [distributorUserId],
    );

    if (distributorRes.rows.length === 0) {
      return res
        .status(404)
        .json({ status: false, error: "Distributor not found" });
    }

    const referralCode = distributorRes.rows[0].referral_code;

    const result = await db.query(
      "UPDATE ecom_user SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND distributor_code = $3 RETURNING id, name, email, phone, profile_image, distributor_code, status, email_verified_at, created_at",
      [status, id, referralCode],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ status: false, error: "User not found or not permitted" });
    }

    res.json({ status: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};
