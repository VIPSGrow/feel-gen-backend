const db = require("../config/db");
const SelfCommission = require("../services/commission/SelfCommission");
const { generateAndSaveIdCard } = require("../utils/idCardService");
const { VerifyPaymentFunc } = require("./razorPayController");
const generateOrderId = () => {
  const now = new Date();

  // Extract YYMMDD:
  // toISOString() gives "2026-05-09..."
  // slice(2, 10) gives "26-05-09"
  // replace(/-/g, "") gives "260509"
  const dateStr = now.toISOString().slice(2, 8).replace(/-/g, "");

  const randomNum = Math.floor(Math.random() * 10000);

  return `ORD-${dateStr}-D${randomNum.toString().padStart(4, "0")}`;
};

const getShippingCharge = async (client) => {
  const query =
    "SELECT * FROM public.app_settings WHERE setting_key = 'shipping_charge'";
  const res = await client.query(query);
  if (res.rows.length > 0) {
    return res.rows[0].setting_value.charge;
  }

  return 0;
};

exports.d_p_o = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const userId = req.user.id;
    const {
      items, // [{product_id, variant_id, qty}],
      shipping_address,
      coupon_code,
      payment_method = "wallet",
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Items required" });
    }

    //verify payment if razorpay details are provided (optional for wallet payments)
    if (
      payment_method === "razorpay" &&
      (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    ) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment details required for razorpay method",
      });
    }

    let paymentStatus = "unpaid";

    //Verify Razorpay signature if payment method is razorpay
    if (payment_method === "razorpay") {
      const VerifyPaymentFuncResult = await VerifyPaymentFunc(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      );

      if (!VerifyPaymentFuncResult) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Razorpay signature" });
      }

      paymentStatus = "paid"; // Mark as paid if Razorpay verification is successful
    }

    // 1. Validate items, calculate totals
    let subTotal = 0;
    let totalBV = 0;
    const validatedItems = [];

    let taxAmount = 0;

    for (const item of items) {
      const {
        product_id,
        variant_id,
        qty,
        tax_data,
        hsn_code,
        dimension_unit,
        dimension_width,
        dimension_height,
        dimension_length,
      } = item;

      console.log("\n\n --- item of placing - ", item);

      let productData;
      let taxRate = 0;

      if (variant_id) {
        // --- CASE 1: Variable Product ---
        const variantRes = await client.query(
          `SELECT pv.sku, pv.price, pv.bv_point, pv.stock, p.name as product_name, 
              p.f_image as product_image,
              t.tax_percentage as tax_rate,
              COALESCE((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'attr_id', av.attr_id,
                    'attr_value_id', vam.attr_value_id, 
                    'value', av.value
                  ) ORDER BY av.attr_id
                )
                FROM variant_attr_mapping vam
                JOIN attr_values av ON vam.attr_value_id = av.id 
                WHERE vam.variant_id = pv.id
              ), '[]'::jsonb) as attributes
              FROM pro_variants pv 
              JOIN products p ON pv.product_id = p.id 
              LEFT JOIN tax_settings t ON t.id = p.tax_id 
              WHERE pv.id = $1 AND p.id = $2 AND p.status = 'active'`,
          [variant_id, product_id],
        );
        productData = variantRes.rows[0];
      } else {
        // --- CASE 2: Simple Product (No Variation) ---
        // --- CASE 2: Simple Product (No Variation) ---
        const productRes = await client.query(
          `SELECT 
            p.id::text as sku, 
            t.tax_percentage as tax_rate,
            CASE 
              WHEN p.discounted_price > 0 THEN p.discounted_price 
              ELSE p.base_price
            END as price,
            null as bv_point, -- Changed from null to p.bv_point if simple products have points
            null as stock, 
            p.name as product_name, 
            p.f_image as product_image, 
            '[]'::jsonb as attributes,
            -- Also build the tax_data object here to store in variant_details
            jsonb_build_object(
              'id', t.id,
              'name', t.tax_name,
              'percentage', t.tax_percentage
            ) as tax_info
          FROM products p
          LEFT JOIN tax_settings t ON t.id = p.tax_id 
          WHERE p.id = $1 AND p.status = 'active'`, // Fixed ambiguous reference
          [product_id],
        );
        productData = productRes.rows[0];
      }

      if (!productData) {
        throw new Error(
          `Product or Variant not found/active: ID ${product_id} ${
            variant_id ? "Var " + variant_id : ""
          }`,
        );
      }

      taxRate = parseFloat(productData.tax_rate);
      const itemTotal = parseFloat(productData.price) * qty;
      const itemBV = (productData.bv_point || 0) * qty;

      validatedItems.push({
        product_id,
        variant_id: variant_id || null, // Ensure null if simple product
        product_name: productData.product_name,
        product_image: productData.product_image,
        variant_sku: productData.sku || "N/A",
        variant_details: {
          price: productData.price,
          bv_point: productData.bv_point,
          tax_data: tax_data,
          attributes: productData.attributes || [],
          hsn_code,
          dimension_unit,
          dimension_width,
          dimension_height,
          dimension_length,
        },
        qty,
        unit_price: productData.price,
        unit_bv_points: productData.bv_point,
        total_item_price: itemTotal,
        total_item_bv: itemBV,
      });

      subTotal += itemTotal;
      totalBV += itemBV;
      taxAmount += (itemTotal * taxRate) / 100;
    }

    // 2. Tax (simple 18% GST for now, link to tax_settings later)

    // 3. Shipping (flat 50 for now)
    // const shippingCharges = await getShippingCharge(client);
    const shippingCharges = 0;

    // 4. Coupon discount (if provided)
    let discount = 0;
    if (coupon_code) {
      // Reuse coupon logic or simple check
      const coupon = await client.query(
        "SELECT * FROM coupons WHERE code = $1 AND status = 'active'",
        [coupon_code.toUpperCase()],
      );
      if (coupon.rows[0]) {
        // Simplified: fixed/percentage on subTotal
        const c = coupon.rows[0];
        if (c.discount_type === "percentage") {
          discount = (parseFloat(c.discount_amount) / 100) * subTotal;
        } else {
          discount = parseFloat(c.discount_amount);
        }
        discount = Math.min(
          discount,
          parseFloat(c.max_discount_amount || discount),
        );
      }
    }

    const totalAmount = subTotal + taxAmount + shippingCharges - discount;

    // 7. Create order
    const orderId = generateOrderId();

    // Wallet payment: deduct from wallets.total_amount and create purchase transaction
    if (payment_method === "wallet") {
      // Lock wallet row and validate balance
      const walletRes = await client.query(
        `SELECT total_amount FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );

      const currentTotal = parseFloat(walletRes.rows[0]?.total_amount || 0);
      if (currentTotal < totalAmount) {
        throw new Error("Insufficient wallet balance for this purchase");
      }

      // Deduct
      await client.query(
        `UPDATE wallets SET total_amount = total_amount - $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [totalAmount, userId],
      );

      // Ledger
      await client.query(
        `INSERT INTO transactions (user_id, amount, type, category, status, remarks)
         VALUES ($1, $2, 'debit', 'purchase', 'completed', $3)`,
        [userId, totalAmount, `Order Purchase: ${orderId}`],
      );
    }

    const newOrder = await client.query(
      `INSERT INTO orders (order_id, distributor_id, sub_total, tax_amount, shipping_charges, total_amount, total_bv_points, shipping_address, payment_method, order_for, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'admin-distributor', $10) RETURNING *`,
      [
        orderId,
        userId,
        subTotal,
        taxAmount,
        shippingCharges,
        totalAmount,
        totalBV,
        shipping_address,
        payment_method,
        paymentStatus,
      ],
    );

    // 8. Create order_items
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name, product_image, variant_sku, variant_details, qty, unit_price, unit_bv_points, total_item_price, total_item_bv)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          newOrder.rows[0].id,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.product_image,
          item.variant_sku,
          item.variant_details,
          item.qty,
          item.unit_price,
          item.unit_bv_points,
          item.total_item_price,
          item.total_item_bv,
        ],
      );
    }

    const commResult = await SelfCommission(client, userId, {
      amount: subTotal,
      paymentMethod: payment_method,
      razorpay_order_id,
      order_id: orderId,
    });
    if (!commResult.status) throw new Error(commResult.message);

    // 9. Auto-increase distributor inventory
    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO distributor_inventory (distributor_id, product_id, variant_id, quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (distributor_id, product_id, COALESCE(variant_id, 0))
         DO UPDATE SET
           quantity = distributor_inventory.quantity + EXCLUDED.quantity,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, item.product_id, item.variant_id || null, item.qty],
      );

      // update super admin inventory
      await client.query(
        `
        UPDATE distributor_inventory SET
          quantity = quantity - $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE distributor_id = 0 AND product_id = $2 AND COALESCE(variant_id, 0) = COALESCE($3, 0)
      `,
        [item.qty, item.product_id, item.variant_id || null],
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: { ...newOrder.rows[0], items: validatedItems },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Order place error:", error);
    res.status(400).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

exports.getAllD_Orders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Initial parameters
    const params = [userId];
    let whereClause = "WHERE o.user_id = $1";

    if (status) {
      params.push(status);
      whereClause += ` AND o.order_status = $${params.length}`;
    }

    // Main Query
    const ordersQuery = `
      SELECT o.*, 
             COUNT(oi.id)::int as items_count,
             COALESCE(SUM(oi.total_item_price), 0) as items_total,
             oi.product_name, oi.product_image
      FROM orders o 
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${whereClause}
      GROUP BY o.id, oi.product_name, oi.product_image
      ORDER BY o.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const orders = await db.query(ordersQuery, [
      ...params,
      parseInt(limit),
      offset,
    ]);

    // Error Fix Here: Added "o" alias to orders table
    const countWhereClause = whereClause.replace(/o\./g, ""); // "o." hata diya kyunki yahan alias ki zaroorat nahi agar single table hai
    // YA phir alias de do:
    const totalRes = await db.query(
      `SELECT COUNT(*)::int FROM orders o ${whereClause}`, // Added "o" here
      params,
    );

    res.json({
      success: true,
      data: orders.rows,
      total: totalRes.rows[0].count, // Frontend compatibility ke liye
      page: parseInt(page),
      limit: parseInt(limit),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRes.rows[0].count,
        pages: Math.ceil(totalRes.rows[0].count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// placed
exports.getPlacedOrder = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, filter = "all", search } = req.query;

    const dis_id = req.user.id;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = "WHERE 1=1";
    const params = [];

    whereClause += ` AND o.distributor_id = ${dis_id} AND (o.order_for NOT LIKE 'distributor_%' OR o.order_for IS NULL)`;

    if (status) {
      params.push(status);
      whereClause += ` AND o.order_status = $${params.length}`;
    }

    if (filter && filter !== "all") {
      if (filter === "my") {
        // Show only rows that ARE for a distributor
        whereClause += ` AND o.order_for LIKE 'distributor_%'`;
      } else if (filter === "distributor") {
        // Show rows that ARE NOT for a distributor OR are NULL
        whereClause += ` AND (o.order_for NOT LIKE 'distributor_%' OR o.order_for IS NULL)`;
      } else {
        // Specific ID match
        // params.push(filter);
        // whereClause += ` AND o.order_for = $${params.length}`;
        whereClause += `o.distributor_id = ${dis_id} AND (o.order_for NOT LIKE 'distributor_%' OR o.order_for IS NULL)`;
      }
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (
        o.order_id ILIKE $${params.length} OR
        COALESCE(u.name, d.full_name, d.username) ILIKE $${params.length}
      )`;
    }

    const ordersQuery = `
      SELECT 
        o.*, 
        CASE 
          WHEN o.user_id IS NOT NULL THEN 'User'
          WHEN o.distributor_id IS NOT NULL THEN 'Distributor'
          ELSE 'Unknown'
        END as user_type,
        -- Priority: ecom_user name > distributor full_name > distributor username
        COALESCE(u.name, d.full_name, d.username) as user_name, 
        COALESCE(u.phone, d.phone) as user_phone,
        COALESCE(
          (SELECT json_agg(items)::jsonb 
           FROM (
             SELECT 
               oi.id, oi.product_name, oi.product_image, 
               oi.variant_sku, oi.variant_details, 
               oi.qty, oi.unit_price, oi.total_item_price
             FROM order_items oi 
             WHERE oi.order_id = o.id
           ) items
          ), '[]'::jsonb
        ) as products,
        (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o 
      LEFT JOIN ecom_user u ON o.user_id = u.id
      LEFT JOIN users d ON o.distributor_id = d.id 
      ${whereClause}
      ORDER BY o.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const orders = await db.query(ordersQuery, [
      ...params,
      parseInt(limit),
      offset,
    ]);

    const totalRes = await db.query(
      `SELECT COUNT(*)::int 
       FROM orders o 
       LEFT JOIN ecom_user u ON o.user_id = u.id
       LEFT JOIN users d ON o.distributor_id = d.id 
       ${whereClause}`,
      params,
    );

    res.json({
      success: true,
      clause: ordersQuery,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRes.rows[0].count,
        pages: Math.ceil(totalRes.rows[0].count / parseInt(limit)),
      },
      data: orders.rows,
    });
  } catch (error) {
    console.error("Error in getAllOrders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getRecievedOrder = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = "WHERE 1=1";
    const params = [];

    if (status) {
      params.push(status);
      whereClause += `  AND o.order_status = $${params.length}`;
    }

    whereClause += ` AND (o.order_for = 'distributor_${req.user.id}' AND o.order_for IS NOT NULL)`;

    const ordersQuery = `
      SELECT 
        o.*, 
        CASE 
          WHEN o.user_id IS NOT NULL THEN 'User'
          WHEN o.distributor_id IS NOT NULL THEN 'Distributor'
          ELSE 'Unknown'
        END as user_type,
        -- Priority: ecom_user name > distributor full_name > distributor username
        COALESCE(u.name, d.full_name, d.username) as user_name, 
        COALESCE(u.phone, d.phone) as user_phone,
        COALESCE(
          (SELECT json_agg(items)::jsonb 
           FROM (
             SELECT 
               oi.id, oi.product_name, oi.product_image, 
               oi.variant_sku, oi.variant_details, 
               oi.qty, oi.unit_price, oi.total_item_price
             FROM order_items oi 
             WHERE oi.order_id = o.id
           ) items
          ), '[]'::jsonb
        ) as products,
        (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o 
      LEFT JOIN ecom_user u ON o.user_id = u.id
      LEFT JOIN users d ON o.distributor_id = d.id 
      ${whereClause}
      ORDER BY o.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const orders = await db.query(ordersQuery, [
      ...params,
      parseInt(limit),
      offset,
    ]);

    const totalRes = await db.query(
      `SELECT COUNT(*)::int FROM orders o ${whereClause}`,
      params,
    );

    res.json({
      success: true,
      clause: ordersQuery.replace("\n", " "),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRes.rows[0].count,
        pages: Math.ceil(totalRes.rows[0].count / parseInt(limit)),
      },
      data: orders.rows,
    });
  } catch (error) {
    console.error("Error in getAllOrders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
