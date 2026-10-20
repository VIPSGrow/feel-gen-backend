const db = require("../config/db");

const parseArrayField = (value) => {
  if (!value || value === "") return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .map((s) => parseInt(s))
      .filter((n) => !isNaN(n));
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .map((s) => parseInt(s))
    .filter((n) => !isNaN(n));
};

const validateDiscountType = (discountType) => {
  const validTypes = ["fixed", "percentage"];
  const normalized = discountType?.trim().toLowerCase();
  if (!validTypes.includes(normalized)) {
    throw new Error(
      `Invalid discount_type: '${discountType}'. Must be 'fixed' or 'percentage'.`,
    );
  }
  return normalized;
};

const calculateDiscount = (type, amount, total, maxDiscount) => {
  let discount = 0;
  if (type === "percentage") {
    discount = (parseFloat(amount) / 100) * parseFloat(total);
  } else {
    discount = parseFloat(amount);
  }
  if (maxDiscount) discount = Math.min(discount, parseFloat(maxDiscount));
  return parseFloat(discount.toFixed(2));
};

// Admin: List all coupons
exports.listCoupons = async (req, res) => {
  try {
    const { status } = req.query;
    let whereClause = "WHERE 1=1";
    const values = [];
    if (status) {
      whereClause += ` AND status = $${values.length + 1}`;
      values.push(status);
    }
    const result = await db.query(
      `
      SELECT 
        c.*, 
        (SELECT COUNT(*) FROM coupon_usages cu WHERE cu.coupon_id = c.id) as actual_used_count,
        COALESCE(
          (SELECT json_agg(p.name) FROM products p WHERE p.id = ANY(c.applicable_products)),
          '[]'::json
        ) as product_names
        
      FROM coupons c       
      ${whereClause}
      ORDER BY c.id DESC
    `,
      values,
    );
    res.status(200).json({
      success: true,
      message: "Coupons fetched successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Public: coupons to show on website
exports.listPublicCoupons = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, code, discount_type, discount_amount, min_order_amount,
             max_discount_amount, expires_at, display_title, display_description, display_order
      FROM coupons
      WHERE show_on_website = true
        AND status = 'active'
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (expires_at IS NULL OR expires_at + INTERVAL '1 day' > NOW())
        AND used_count < usage_limit
        AND (applicable_users IS NULL OR cardinality(applicable_users) = 0)
      ORDER BY display_order ASC, id DESC
    `);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching public coupons:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Admin: Create coupon
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      discount_type,
      discount_amount,
      min_order_amount,
      max_discount_amount,
      usage_limit,
      valid_from,
      expires_at,
      applicable_products,
      applicable_users,
      status,
      show_on_website,
      display_title,
      display_description,
      display_order,
    } = req.body;

    if (!code?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Code is required" });
    }

    // Validate discount_type
    const validatedDiscountType = validateDiscountType(discount_type);

    const products = parseArrayField(applicable_products);
    const users = parseArrayField(applicable_users);

    const result = await db.query(
      `
      INSERT INTO coupons (
        code, discount_type, discount_amount, min_order_amount, max_discount_amount,
        usage_limit, valid_from, expires_at, applicable_products,         applicable_users, status,
                show_on_website, display_title, display_description, display_order
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *
    `,
      [
        code.trim().toUpperCase(),
        validatedDiscountType,
        parseFloat(discount_amount) || 0,
        parseFloat(min_order_amount) || 0,
        max_discount_amount ? parseFloat(max_discount_amount) : null,
        parseInt(usage_limit) || 1,
        valid_from || null,
        expires_at || null,
        products.length ? products : null,
        users.length ? users : null,
        status || "active",
        show_on_website === true || show_on_website === "true",
        display_title?.trim() || null,
        display_description?.trim() || null,
        parseInt(display_order) || 0,
      ],
    );

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get single coupon by ID
exports.getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "SELECT c.*, COUNT(cu.id) as usage_count FROM coupons c LEFT JOIN coupon_usages cu ON c.id = cu.coupon_id WHERE c.id = $1 GROUP BY c.id",
      [parseInt(id)],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });
    }
    res.status(200).json({
      success: true,
      message: "Coupon fetched successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching coupon:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Admin: Update coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = Object.keys(req.body).filter((key) => key !== "id");
    if (updates.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    // Validate discount_type if provided
    if (req.body.discount_type !== undefined) {
      const validatedDiscountType = validateDiscountType(
        req.body.discount_type,
      );
      req.body.discount_type = validatedDiscountType;
    }

    const values = [];
    const setClause = updates
      .map((key) => {
        let val = req.body[key];
        if (key === "applicable_products" || key === "applicable_users") {
          val = parseArrayField(val);
        } else if (key === "max_discount_amount") {
          // If max_discount_amount is 0, empty string, or falsy, set it to null
          const parsed = parseFloat(val);
          val = parsed === 0 || isNaN(parsed) ? null : parsed;
        } else if (["discount_amount", "min_order_amount"].includes(key)) {
          val = parseFloat(val) || 0;
        } else if (key === "usage_limit") {
          val = parseInt(val) || 1;
        } else if (key === "show_on_website") {
          val = val === true || val === "true";
        } else if (key === "display_order") {
          val = parseInt(val) || 0;
        } else if (key === "display_title" || key === "display_description") {
          val = val?.toString().trim() || null;
        }
        values.push(val);
        return `${key} = $${values.length}`;
      })
      .join(", ");

    values.push(parseInt(id));
    const result = await db.query(
      `
      UPDATE coupons SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *
    `,
      values,
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });
    }

    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res
      .status(500)
      .json({ success: false, message: error || "Internal server error" });
  }
};

// Admin: Soft delete (inactive)
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE coupons SET status = 'trash' WHERE id = $1 RETURNING *",
      [parseInt(id)],
    );
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found" });
    }
    res.status(200).json({
      success: true,
      message: "Coupon deactivated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Public: Validate coupon for order
exports.validateCoupon = async (req, res) => {
  const client = await db.connect(); // Transaction for atomicity
  try {
    await client.query("BEGIN");

    const {
      code,
      total_amount,
      user_id,
      phone,
      ip_address,
      user_agent,
      products = [],
    } = req.body;

    if (!code || !total_amount || parseFloat(total_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid code and total_amount required",
      });
    }

    // Fetch coupon
    const couponResult = await client.query(
      `
      SELECT * FROM coupons 
      WHERE code = $1 AND status = 'active' AND used_count < usage_limit
    `,
      [code.trim().toUpperCase()],
    );

    if (couponResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ success: false, message: "Invalid or inactive coupon" });
    }

    const coupon = couponResult.rows[0];

    // Time check
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ success: false, message: "Coupon not yet valid" });
    }
    if (
      coupon.expires_at &&
      new Date(coupon.expires_at).getTime() + 24 * 60 * 60 * 1000 <= now.getTime()
    ) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ success: false, message: "Coupon expired" });
    }

    // Min order
    if (parseFloat(total_amount) < parseFloat(coupon.min_order_amount)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Minimum order ${coupon.min_order_amount} required`,
      });
    }

    // Product restriction
    if (coupon.applicable_products && coupon.applicable_products.length > 0) {
      const productIds = products.map((p) => parseInt(p));
      const invalid = coupon.applicable_products.some(
        (id) => !productIds.includes(id),
      );
      if (invalid) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Coupon not applicable to these products",
        });
      }
    }

    // User restriction
    if (
      coupon.applicable_users &&
      coupon.applicable_users.length > 0 &&
      user_id &&
      !coupon.applicable_users.includes(parseInt(user_id))
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Coupon not applicable to this user",
      });
    }

    // Check prior usage (anti-abuse)
    const usageCheck = await client.query(
      `
      SELECT 1 FROM coupon_usages 
      WHERE coupon_id = $1 
      AND (user_id = $2 OR username = $3 OR phone = $4 OR ip_address = $5)
    `,
      [
        coupon.id,
        user_id ? parseInt(user_id) : null,
        req.body.username,
        phone,
        ip_address,
      ],
    );

    if (usageCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Coupon already used by this user/phone/IP",
      });
    }

    // Calculate discount
    const discount = calculateDiscount(
      coupon.discount_type,
      coupon.discount_amount,
      total_amount,
      coupon.max_discount_amount,
    );

    // Apply: increment used_count + record usage
    // await client.query(
    //   `
    //   UPDATE coupons SET used_count = used_count + 1 WHERE id = $1
    // `,
    //   [coupon.id],
    // );

    // await client.query(
    //   `
    //   INSERT INTO coupon_usages (coupon_id, user_id, username, phone, ip_address, user_agent)
    //   VALUES ($1, $2, $3, $4, $5, $6)
    // `,
    //   [
    //     coupon.id,
    //     user_id ? parseInt(user_id) : null,
    //     req.body.username,
    //     phone,
    //     ip_address,
    //     user_agent,
    //   ],
    // );

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Coupon validated successfully",
      data: {
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_amount: discount,
        remaining_uses: coupon.usage_limit - (coupon.used_count + 1),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error validating coupon:", error);
    res.status(500).json({ success: false, message: "Validation failed" });
  } finally {
    client.release();
  }
};
