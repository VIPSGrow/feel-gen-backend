const db = require("../config/db");
const {
  sendPlacedOrderEmail,
  sendOrderStatusUpdateEmail,
} = require("./email/placeOrderEmail");
const SelfCommission = require("../services/commission/SelfCommission");
const distributeParentChainCommission = require("../services/commission/ParentChainCommission");

// const generateOrderId = () => {
//   const now = new Date();
//   const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
//   const randomNum = Math.floor(Math.random() * 10000);
//   return `ORD-${dateStr}-C-${randomNum.toString().padStart(4, "0")}`;
// };

const generateOrderId = () => {
  const now = new Date();

  // Extract YYMMDD:
  // toISOString() gives "2026-05-09..."
  // slice(2, 10) gives "26-05-09"
  // replace(/-/g, "") gives "260509"
  const dateStr = now.toISOString().slice(2, 8).replace(/-/g, "");

  const randomNum = Math.floor(Math.random() * 10000);

  return `ORD-${dateStr}-C${randomNum.toString().padStart(4, "0")}`;
};

// console.log(generateOrderId()); // Outputs: ORD-260509-C-XXXX

// User: Place new order (wallet payment)
// exports.placeOrder = async (req, res) => {
//   const client = await db.connect();
//   try {
//     await client.query("BEGIN");

//     const userId = req.user.id;
//     const {
//       items, // [{product_id, variant_id, qty}],
//       shipping_address,
//       coupon_code,
//       payment_method = "wallet",
//       order_for = "admin",
//     } = req.body;

//     if (!items || !Array.isArray(items) || items.length === 0) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Items required" });
//     }

//     // Determine target distributor for inventory management
//     let targetDistributorId = null;

//     // 1. Check explicit distributor_id in request
//     if (req.body.distributor_id) {
//       targetDistributorId = parseInt(req.body.distributor_id);
//     }
//     // 2. Check order_for field
//     else if (order_for && order_for !== "admin") {
//       if (order_for.startsWith("distributor_")) {
//         targetDistributorId = parseInt(order_for.replace("distributor_", ""));
//       } else if (!isNaN(parseInt(order_for))) {
//         targetDistributorId = parseInt(order_for);
//       }
//     }

//     // 3. Fallback to user's linked distributor_code
//     if (!targetDistributorId) {
//       const userRes = await client.query(
//         "SELECT distributor_code FROM ecom_user WHERE id = $1",
//         [userId],
//       );
//       const dCode = userRes.rows[0]?.distributor_code;
//       if (dCode) {
//         const dRes = await client.query(
//           "SELECT id FROM users WHERE referral_code = $1 LIMIT 1",
//           [dCode],
//         );
//         if (dRes.rows.length > 0) {
//           targetDistributorId = dRes.rows[0].id;
//         } else if (!isNaN(parseInt(dCode))) {
//           const dRes2 = await client.query(
//             "SELECT id FROM users WHERE id = $1 LIMIT 1",
//             [parseInt(dCode)],
//           );
//           if (dRes2.rows.length > 0) {
//             targetDistributorId = dRes2.rows[0].id;
//           }
//         }
//       }
//     }

//     // 1. Validate items, calculate totals
//     let subTotal = 0;
//     let totalBV = 0;
//     const validatedItems = [];

//     for (const item of items) {
//       const { product_id, variation_id: variant_id, quantity: qty } = item;

//       let productData;

//       if (variant_id) {
//         const variant = await client.query(
//           `SELECT pv.sku, pv.price, pv.bv_point, pv.stock, p.name as product_name,
//               p.f_image as product_image,
//             COALESCE((
//               SELECT jsonb_agg(
//                 jsonb_build_object(
//                   'attr_id', av.attr_id,
//                   'attr_value_id', vam.attr_value_id,
//                   'value', av.value
//                 ) ORDER BY av.attr_id
//               )
//               FROM variant_attr_mapping vam
//               JOIN attr_values av ON vam.attr_value_id = av.id
//               WHERE vam.variant_id = pv.id
//             ), '[]'::jsonb) as attributes
//             FROM pro_variants pv
//             JOIN products p ON pv.product_id = p.id
//             WHERE pv.id = $1 AND p.status = 'active'`,
//           [variant_id],
//         );

//         productData = variant.rows[0];
//       } else {
//         // --- CASE 2: Simple Product (No Variation) ---
//         const productRes = await client.query(
//           `SELECT
//           id::text as sku, -- Fallback to ID if SKU doesn't exist in products table
//           base_price as price,
//           null as bv_point,
//           null as stock,
//           name as product_name,
//           f_image as product_image,
//           '[]'::jsonb as attributes
//        FROM products
//        WHERE id = $1 AND status = 'active'`,
//           [product_id],
//         );
//         productData = productRes.rows[0];
//       }

//       if (!productData) {
//         throw new Error(
//           `Product or Variant not found/active: ID ${product_id} ${
//             variant_id ? "Var " + variant_id : ""
//           }`,
//         );
//       }

//       const itemTotal = parseFloat(productData.price) * qty;
//       const itemBV = (productData.bv_point || 0) * qty;

//       validatedItems.push({
//         product_id,
//         variant_id: variant_id || null,
//         product_name: productData.product_name,
//         product_image: productData.product_image,
//         variant_sku: productData.sku,
//         variant_details: {
//           price: productData.price,
//           bv_point: productData.bv_point,
//           attributes: productData.attributes || [],
//         },
//         qty,
//         unit_price: productData.price,
//         unit_bv_points: productData.bv_point,
//         total_item_price: itemTotal,
//         total_item_bv: itemBV,
//       });

//       subTotal += itemTotal;
//       totalBV += itemBV;
//     }

//     // Inventory check for distributor orders
//     if (targetDistributorId) {
//       for (const item of validatedItems) {
//         const invRes = await client.query(
//           `SELECT quantity FROM distributor_inventory
//            WHERE distributor_id = $1 AND product_id = $2 AND COALESCE(variant_id, 0) = COALESCE($3, 0)`,
//           [targetDistributorId, item.product_id, item.variant_id],
//         );
//         const availableQty = invRes.rows[0]?.quantity || 0;
//         if (availableQty < item.qty) {
//           throw new Error(
//             `Insufficient inventory for ${item.product_name}. Available: ${availableQty}, Required: ${item.qty}`,
//           );
//         }
//       }
//     }

//     // 2. Tax (simple 18% GST for now, link to tax_settings later)
//     const taxRate = 0.18;
//     const taxAmount = subTotal * taxRate;

//     // 3. Shipping (flat 50 for now)
//     const shippingCharges = 50;

//     // 4. Coupon discount (if provided)
//     let discount = 0;
//     if (coupon_code) {
//       // Reuse coupon logic or simple check
//       const coupon = await client.query(
//         "SELECT * FROM coupons WHERE code = $1 AND status = 'active'",
//         [coupon_code.toUpperCase()],
//       );
//       if (coupon.rows[0]) {
//         // Simplified: fixed/percentage on subTotal
//         const c = coupon.rows[0];
//         if (c.discount_type === "percentage") {
//           discount = (parseFloat(c.discount_amount) / 100) * subTotal;
//         } else {
//           discount = parseFloat(c.discount_amount);
//         }
//         discount = Math.min(
//           discount,
//           parseFloat(c.max_discount_amount || discount),
//         );
//       }
//     }

//     const totalAmount = subTotal + taxAmount + shippingCharges - discount;

//     // 5. Check wallet balance
//     // const wallet = await client.query(
//     //   "SELECT COALESCE(total_amount, 0) + COALESCE(pending_amount, 0) as available FROM wallets WHERE user_id = $1",
//     //   [userId],
//     // );
//     // const available = parseFloat(wallet.rows[0]?.available || 0);
//     // if (available < totalAmount) {
//     //   throw new Error("Insufficient wallet balance");
//     // }

//     // 6. Deduct from wallet (total_amount for simplicity)
//     // await client.query(
//     //   "UPDATE wallets SET total_amount = total_amount - $1 WHERE user_id = $2",
//     //   [totalAmount, userId],
//     // );

//     // 7. Create order
//     const orderId = generateOrderId();
//     const newOrder = await client.query(
//       `INSERT INTO orders (order_id, user_id, distributor_id, sub_total, tax_amount, shipping_charges, total_amount, total_bv_points, shipping_address, payment_method, order_for)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
//       [
//         orderId,
//         userId,
//         targetDistributorId || null,
//         subTotal,
//         taxAmount,
//         shippingCharges,
//         totalAmount,
//         totalBV,
//         shipping_address,
//         payment_method,
//         order_for,
//       ],
//     );

//     // 8. Create order_items
//     for (const item of validatedItems) {
//       await client.query(
//         `INSERT INTO order_items (order_id, product_id, variant_id, product_name, product_image, variant_sku, variant_details, qty, unit_price, unit_bv_points, total_item_price, total_item_bv)
//          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
//         [
//           newOrder.rows[0].id,
//           item.product_id,
//           item.variant_id,
//           item.product_name,
//           item.product_image,
//           item.variant_sku,
//           item.variant_details,
//           item.qty,
//           item.unit_price,
//           item.unit_bv_points,
//           item.total_item_price,
//           item.total_item_bv,
//         ],
//       );
//     }

//     // 9. Auto-decrease distributor inventory for distributor orders
//     if (targetDistributorId) {
//       for (const item of validatedItems) {
//         const updateRes = await client.query(
//           `UPDATE distributor_inventory
//            SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
//            WHERE distributor_id = $2 AND product_id = $3 AND COALESCE(variant_id, 0) = COALESCE($4, 0)
//            RETURNING *`,
//           [item.qty, targetDistributorId, item.product_id, item.variant_id],
//         );
//         if (updateRes.rowCount === 0) {
//           throw new Error(
//             `Inventory record not found for ${item.product_name}. Cannot fulfill order.`,
//           );
//         }
//       }
//     }

//     await client.query("COMMIT");

//     res.status(200).json({
//       success: true,
//       message: "Order placed successfully",
//       data: { ...newOrder.rows[0], items: validatedItems },
//     });
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Order place error:", error);
//     res.status(400).json({ success: false, message: error.message });
//   } finally {
//     client.release();
//   }
// };

const getShippingCharge = async (client) => {
  const query =
    "SELECT * FROM public.app_settings WHERE setting_key = 'shipping_charge'";
  const res = await client.query(query);
  if (res.rows.length > 0) {
    return res.rows[0].setting_value.charge;
  }

  return 0;
};
// exports.placeOrder = async (req, res) => {
//   const client = await db.connect();
//   try {
//     await client.query("BEGIN");

//     const userId = req.user.id;
//     const {
//       items, // [{product_id, variation_id, quantity}]
//       shipping_address,
//       coupon_code,
//       payment_method = "wallet",
//       order_for = "admin",
//       distributor_id, // Explicitly passed from frontend
//     } = req.body;

//     if (!items || !Array.isArray(items) || items.length === 0) {
//       throw new Error("Items required");
//     }

//     // 1. Target Distributor Identify karein (Fallback Logic)
//     let targetDistributorId = distributor_id ? parseInt(distributor_id) : 0;
//     // Default to 0 (Main Warehouse) if nothing is provided

//     let subTotal = 0;
//     let totalTax = 0; // Dynamic Tax Accumulator
//     let totalBV = 0;
//     const validatedItems = [];

//     // 2. Validate Items & Fetch Prices
//     for (const item of items) {
//       const { product_id, variation_id, quantity: qty, tax_data } = item;

//       // const productQuery = variation_id
//       //   ? `SELECT pv.sku, pv.price, pv.bv_point, p.name as product_name,
//       //   p.f_image, t.tax_percentage
//       //      FROM pro_variants pv
//       //      JOIN products p ON pv.product_id = p.id
//       //      LEFT JOIN tax_settings t ON p.tax_id = t.id
//       //      WHERE pv.id = $1 AND p.status = 'active'`
//       //   : `SELECT
//       //         p.id::text as sku,
//       //         CASE
//       //           WHEN p.discounted_price > 0 THEN p.discounted_price
//       //           ELSE p.base_price
//       //         END as price,
//       //         0 as bv_point,
//       //         p.name as product_name,
//       //         p.f_image,
//       //         t.tax_percentage
//       //      FROM products p
//       //      LEFT JOIN tax_settings t ON p.tax_id = t.id
//       //      WHERE p.id = $1 AND p.status = 'active'`;

//       // const pRes = await client.query(productQuery, [
//       //   variation_id || product_id,
//       // ]);
//       // const productData = pRes.rows[0];

//       let productData;
//       let taxRate = 0;

//       if (variation_id) {
//         // --- CASE 1: Variable Product ---
//         const variantRes = await client.query(
//           `SELECT pv.sku, pv.price, pv.bv_point, pv.stock, p.name as product_name,
//               p.f_image as product_image,
//               t.tax_percentage as tax_rate,
//               COALESCE((
//                 SELECT jsonb_agg(
//                   jsonb_build_object(
//                     'attr_id', av.attr_id,
//                     'attr_value_id', vam.attr_value_id,
//                     'value', av.value
//                   ) ORDER BY av.attr_id
//                 )
//                 FROM variant_attr_mapping vam
//                 JOIN attr_values av ON vam.attr_value_id = av.id
//                 WHERE vam.variant_id = pv.id
//               ), '[]'::jsonb) as attributes
//               FROM pro_variants pv
//               JOIN products p ON pv.product_id = p.id
//               LEFT JOIN tax_settings t ON t.id = p.tax_id
//               WHERE pv.id = $1 AND p.id = $2 AND p.status = 'active'`,
//           [variation_id, product_id],
//         );
//         productData = variantRes.rows[0];
//       } else {
//         // --- CASE 2: Simple Product (No Variation) ---
//         // --- CASE 2: Simple Product (No Variation) ---
//         const productRes = await client.query(
//           `SELECT
//             p.id::text as sku,
//             t.tax_percentage as tax_rate,
//             CASE
//               WHEN p.discounted_price > 0 THEN p.discounted_price
//               ELSE p.base_price
//             END as price,
//             null as bv_point, -- Changed from null to p.bv_point if simple products have points
//             null as stock,
//             p.name as product_name,
//             p.f_image as product_image,
//             '[]'::jsonb as attributes,
//             -- Also build the tax_data object here to store in variant_details
//             jsonb_build_object(
//               'id', t.id,
//               'name', t.tax_name,
//               'percentage', t.tax_percentage
//             ) as tax_info
//           FROM products p
//           LEFT JOIN tax_settings t ON t.id = p.tax_id
//           WHERE p.id = $1 AND p.status = 'active'`, // Fixed ambiguous reference
//           [product_id],
//         );
//         productData = productRes.rows[0];
//       }

//       if (!productData)
//         throw new Error(`Product/Variant ${product_id} not active.`);

//       taxRate = parseFloat(productData.tax_rate);
//       // --- INVENTORY CHECK WITH FALLBACK (ID: distributor_id OR 0) ---
//       const invRes = await client.query(
//         `SELECT distributor_id, quantity FROM distributor_inventory
//          WHERE product_id = $1 AND (variant_id = $2 OR (variant_id IS NULL AND $2 IS NULL))
//          AND (distributor_id = $3 OR distributor_id = 0)
//          ORDER BY (distributor_id = $3) DESC`, // Taaki specific distributor pehle aaye
//         [product_id, variation_id || null, targetDistributorId],
//       );

//       // Check Specific Distributor first, then Main Warehouse
//       let specificDistStock = invRes.rows.find(
//         (r) => r.distributor_id == targetDistributorId,
//       );
//       let mainWarehouseStock = invRes.rows.find((r) => r.distributor_id == 0);

//       let finalStockSource = null;

//       if (specificDistStock && specificDistStock.quantity >= qty) {
//         finalStockSource = targetDistributorId;
//       } else if (mainWarehouseStock && mainWarehouseStock.quantity >= qty) {
//         finalStockSource = 0;
//       } else {
//         throw new Error(`Insufficient stock for ${productData.product_name}.`);
//       }

//       const price = parseFloat(productData.price);
//       const taxPercent = parseFloat(taxRate || 0);
//       const itemTax = ((price * taxPercent) / 100) * qty;
//       const itemTotal = price * qty;
//       const itemBV = (productData.bv_point || 0) * qty;

//       validatedItems.push({
//         product_id,
//         variant_id: variation_id || null,
//         variant_details: {
//           price: productData.price,
//           bv_point: productData.bv_point,
//           tax_data: tax_data,
//           attributes: productData.attributes || [],
//         },
//         qty,
//         unit_price: productData.price,
//         total_item_price: itemTotal,
//         total_item_bv: itemBV,
//         stock_source: finalStockSource, // Track kahan se stock katna hai
//         product_name: productData.product_name,
//         product_image: productData.f_image,
//       });

//       subTotal += itemTotal;
//       totalTax += itemTax; // Add to global order tax
//       totalBV += itemBV;
//     }

//     // 3. Tax & Shipping (Simple Logic)
//     const shippingCharges = await getShippingCharge(client);
//     const taxAmount = Math.round(totalTax * 100) / 100;
//     const totalAmount = subTotal + taxAmount + shippingCharges;

//     // 4. Create Order
//     const orderRef = generateOrderId();
//     const orderInsert = await client.query(
//       `INSERT INTO orders (order_id, user_id, distributor_id, sub_total,
//       tax_amount, shipping_charges, total_amount, total_bv_points, shipping_address, payment_method, order_status, order_for)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11) RETURNING id`,
//       [
//         orderRef,
//         userId,
//         targetDistributorId,
//         subTotal,
//         taxAmount,
//         shippingCharges,
//         totalAmount,
//         totalBV,
//         shipping_address,
//         payment_method,
//         order_for,
//       ],
//     );
//     const dbOrderId = orderInsert.rows[0].id;

//     // 5. Insert Items & UPDATE INVENTORY (Deduction)
//     for (const item of validatedItems) {
//       // Order Item Insert
//       // await client.query(
//       //   `INSERT INTO order_items (order_id, product_id, variant_id, product_name, qty, unit_price, total_item_price, stock_source)
//       //    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
//       //   [
//       //     dbOrderId,
//       //     item.product_id,
//       //     item.variant_id,
//       //     item.product_name,
//       //     item.qty,
//       //     item.unit_price,
//       //     item.total_item_price,
//       //     item.stock_source,
//       //   ],
//       // );
//       await client.query(
//         `INSERT INTO order_items (
//         order_id, product_id, variant_id, product_name,
//         variant_details
//         qty, unit_price, unit_bv_points, total_item_price,
//         total_item_bv, stock_source, product_image
//      )
//      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
//         [
//           dbOrderId,
//           item.product_id,
//           item.variant_id,
//           item.product_name,
//           item.variant_details,
//           item.qty,
//           item.unit_price,
//           item.unit_bv_points || 0, // unit_bv_points handle kiya
//           item.total_item_price,
//           item.total_item_bv || 0, // total_item_bv handle kiya (Error Fix)
//           item.stock_source,
//           item.product_image,
//         ],
//       );

//       // Inventory Deduct (Use finalStockSource identified earlier)
//       const deductRes = await client.query(
//         `UPDATE distributor_inventory
//          SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
//          WHERE product_id = $2 AND (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))
//          AND distributor_id = $4 RETURNING quantity`,
//         [item.qty, item.product_id, item.variant_id, item.stock_source],
//       );

//       if (deductRes.rowCount === 0)
//         throw new Error(`Inventory update failed for ${item.product_name}`);
//     }

//     // 6. Optional: Clear Cart after success
//     await client.query(
//       `DELETE FROM e_cart_items WHERE cart_id = (SELECT id FROM e_carts WHERE user_id = $1)`,
//       [userId],
//     );

//     await client.query("COMMIT");
//     res.status(200).json({
//       success: true,
//       message: "Order placed successfully",
//       order_id: orderRef,
//     });
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Order Place Error:", error.message);
//     res.status(400).json({ success: false, message: error.message });
//   } finally {
//     client.release();
//   }
// };

exports.placeDistributorOrder = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const distributorUserId = req.user.id;
    const {
      items,
      shipping_address,
      coupon_code,
      payment_method = "wallet",
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Items required");
    }

    const distUser = await client.query(
      `SELECT id, username, full_name, email, phone, kyc_status, is_active
       FROM users WHERE id = $1 FOR UPDATE`,
      [distributorUserId],
    );
    if (distUser.rows.length === 0) {
      throw new Error("Distributor account not found");
    }
    const distributor = distUser.rows[0];
    if (!distributor.kyc_status) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "KYC not approved. Please complete KYC verification before ordering.",
      });
    }

    const customerName = distributor.full_name || `Distributor ${distributor.username}`;
    const customerEmail = distributor.email;

    const targetDistributorId = 0;
    let subTotal = 0;
    let totalTax = 0;
    let totalBV = 0;
    const validatedItems = [];

    for (const item of items) {
      const { product_id, variation_id, quantity: qty } = item;

      let productData;

      if (variation_id) {
        const variantRes = await client.query(
          `SELECT pv.sku, pv.price, pv.bv_point, pv.stock, p.name as product_name,
              p.f_image as product_image,
              t.tax_percentage as tax_rate,
              jsonb_build_object(
                'id', t.id, 'name', t.tax_name, 'percentage', t.tax_percentage
              ) as tax_info,
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
          [variation_id, product_id],
        );
        productData = variantRes.rows[0];
      } else {
        const productRes = await client.query(
          `SELECT
            p.id::text as sku,
            t.tax_percentage as tax_rate,
            CASE
              WHEN p.discounted_price > 0 THEN p.discounted_price
              ELSE p.base_price
            END as price,
            null as stock,
            p.name as product_name,
            p.f_image as product_image,
            '[]'::jsonb as attributes,
            jsonb_build_object(
              'id', t.id, 'name', t.tax_name, 'percentage', t.tax_percentage
            ) as tax_info
          FROM products p
          LEFT JOIN tax_settings t ON t.id = p.tax_id
          WHERE p.id = $1 AND p.status = 'active'`,
          [product_id],
        );
        productData = productRes.rows[0];
      }

      if (!productData) {
        throw new Error(
          `Product/Variant reference matching ID ${product_id} is not active.`,
        );
      }

      const taxRate = parseFloat(productData.tax_rate || 0);
      const taxInfoObj = productData.tax_info;

      const invRes = await client.query(
        `SELECT distributor_id, quantity FROM distributor_inventory
         WHERE product_id = $1 AND (variant_id = $2 OR (variant_id IS NULL AND $2 IS NULL))
         AND (distributor_id = $3 OR distributor_id = 0)
         ORDER BY (distributor_id = $3) DESC`,
        [product_id, variation_id || null, targetDistributorId],
      );

      let specificDistStock = invRes.rows.find(
        (r) => r.distributor_id == targetDistributorId,
      );
      let mainWarehouseStock = invRes.rows.find((r) => r.distributor_id == 0);

      let finalStockSource = null;

      if (specificDistStock && specificDistStock.quantity >= qty) {
        finalStockSource = targetDistributorId;
      } else if (mainWarehouseStock && mainWarehouseStock.quantity >= qty) {
        finalStockSource = 0;
      } else {
        throw new Error(`Insufficient stock for ${productData.product_name}.`);
      }

      const price = parseFloat(productData.price);
      const itemTax = ((price * taxRate) / 100) * qty;
      const itemTotal = price * qty;
      const unitBV = parseFloat(productData.bv_point) || 0;
      const itemBV = unitBV * qty;

      validatedItems.push({
        product_id,
        variant_id: variation_id || null,
        variant_details: {
          price: productData.price,
          bv_point: productData.bv_point,
          tax_data: taxInfoObj,
          attributes: productData.attributes || [],
        },
        qty,
        unit_price: price,
        unit_bv_points: unitBV,
        total_item_price: itemTotal,
        total_item_bv: itemBV,
        stock_source: finalStockSource,
        product_name: productData.product_name,
        product_image: productData.product_image,
        item_tax: itemTax,
      });

      subTotal += itemTotal;
      totalTax += itemTax;
      totalBV += itemBV;
    }

    let shippingCharges = 0;
    if (subTotal <= 260) {
      const sc = await getShippingCharge(client);
      shippingCharges = Number(sc) || 0;
    }

    const taxAmount = Math.round(totalTax * 100) / 100;
    const couponBaseTotalAmount = subTotal + taxAmount + shippingCharges;

    let discountAmount = 0;
    let finalTotalAmount = couponBaseTotalAmount;

    if (coupon_code) {
      const couponCodeNormalized = String(coupon_code).trim().toUpperCase();

      const couponProducts = items.map((it) => it.product_id).filter(Boolean);

      const couponResult = await client.query(
        `SELECT * FROM coupons
         WHERE code = $1 AND status = 'active' AND used_count < usage_limit`,
        [couponCodeNormalized],
      );

      if (couponResult.rows.length === 0) {
        throw new Error("Invalid or inactive coupon");
      }

      const coupon = couponResult.rows[0];
      const now = new Date();
      if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        throw new Error("Coupon not yet valid");
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        throw new Error("Coupon expired");
      }
      if (
        parseFloat(couponBaseTotalAmount) < parseFloat(coupon.min_order_amount)
      ) {
        throw new Error(`Minimum order ${coupon.min_order_amount} required`);
      }
      if (coupon.applicable_products && coupon.applicable_products.length > 0) {
        const productIds = couponProducts.map((p) => parseInt(p));
        const invalid = coupon.applicable_products.some(
          (id) => !productIds.includes(id),
        );
        if (invalid) {
          throw new Error("Coupon not applicable to these products");
        }
      }
      if (coupon.applicable_users && coupon.applicable_users.length > 0) {
        if (!coupon.applicable_users.includes(parseInt(distributorUserId))) {
          throw new Error("Coupon not applicable to this user");
        }
      }
      const usageCheck = await client.query(
        `SELECT 1 FROM coupon_usages
         WHERE coupon_id = $1
         AND (user_id = $2 OR username = $3 OR phone = $4 OR ip_address = $5)`,
        [coupon.id, parseInt(distributorUserId), null, null, null],
      );
      if (usageCheck.rows.length > 0) {
        throw new Error("Coupon already used by this user");
      }

      if (coupon.discount_type === "percentage") {
        discountAmount =
          (parseFloat(coupon.discount_amount) / 100) *
          parseFloat(couponBaseTotalAmount);
      } else {
        discountAmount = parseFloat(coupon.discount_amount);
      }
      if (coupon.max_discount_amount) {
        discountAmount = Math.min(
          discountAmount,
          parseFloat(coupon.max_discount_amount),
        );
      }
      discountAmount = parseFloat(discountAmount.toFixed(2));
      finalTotalAmount = couponBaseTotalAmount - discountAmount;
      if (finalTotalAmount < 0) finalTotalAmount = 0;

      await client.query(
        `UPDATE coupons SET used_count = used_count + 1 WHERE id = $1`,
        [coupon.id],
      );
      await client.query(
        `INSERT INTO coupon_usages
          (coupon_id, user_id, username, phone, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [coupon.id, parseInt(distributorUserId), null, null, null, null],
      );
    }

    const totalAmount = finalTotalAmount;

    if (parseFloat(totalAmount) < 700) {
      throw new Error(
        "Minimum order value is ₹700 to qualify for commission activation.",
      );
    }

    await client.query(
      `INSERT INTO wallets
        (user_id, total_amount, pending_amount, left_count, right_count, paid_pairs, company_fund, withdrawable_amount)
       VALUES ($1, 0, 0, 0, 0, 0, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [distributorUserId],
    );

    const orderRef = generateOrderId();
    const orderInsert = await client.query(
      `INSERT INTO orders (order_id, user_id, distributor_id, sub_total,
        tax_amount, shipping_charges, total_amount, total_bv_points, shipping_address,
        payment_method, order_status, order_for,
        mlm_source_user_id, mlm_eligible, mlm_order_type)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'admin', $11, TRUE, 'distributor_self_purchase')
       RETURNING *`,
      [
        orderRef,
        targetDistributorId,
        subTotal,
        taxAmount,
        shippingCharges,
        totalAmount,
        totalBV,
        shipping_address,
        payment_method,
        payment_method === "wallet" ? "confirmed" : "pending",
        distributorUserId,
      ],
    );
    const newOrderResult = orderInsert.rows[0];
    const dbOrderId = newOrderResult.id;

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, variant_id, product_name,
          variant_details, qty, unit_price, unit_bv_points,
          total_item_price, total_item_bv, stock_source, product_image
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          dbOrderId,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.variant_details,
          item.qty,
          item.unit_price,
          item.unit_bv_points,
          item.total_item_price,
          item.total_item_bv,
          item.stock_source,
          item.product_image,
        ],
      );

      const deductRes = await client.query(
        `UPDATE distributor_inventory
         SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $2 AND (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))
         AND distributor_id = $4 RETURNING quantity`,
        [item.qty, item.product_id, item.variant_id, item.stock_source],
      );

      if (deductRes.rowCount === 0) {
        throw new Error(`Inventory update failed for ${item.product_name}`);
      }
    }

    const levelCommRes = await client.query(
      `SELECT commission_percentage FROM level_commissions WHERE level_no = 0`,
    );
    const selfRate = Number(levelCommRes.rows[0]?.commission_percentage || 0);
    const selfCommission = Number((totalAmount * selfRate / 100).toFixed(2));
    let selfTxnId = null;

    if (selfCommission > 0) {
      const selfTxn = await client.query(
        `INSERT INTO transactions
          (user_id, amount, type, category, source_user_id, order_id, status, remarks, user_package_id)
         VALUES ($1, $2, 'credit', 'commission_self', $1, $3, 'pending', $4, NULL)
         RETURNING id`,
        [
          distributorUserId,
          selfCommission,
          dbOrderId,
          `Self purchase cashback (${selfRate}%) on order ${orderRef}`,
        ],
      );
      selfTxnId = selfTxn.rows[0].id;

      await client.query(
        `INSERT INTO mlm_commission_events
          (order_id, user_package_id, source_user_id, beneficiary_user_id,
           commission_type, generation_level, base_amount, commission_percent,
           commission_amount, plan_settings_id, status, transaction_id,
           mlm_order_type, is_self_commission)
         VALUES ($1, NULL, $2, $3, 'self_cashback', 0, $4, $5, $6,
           (SELECT id FROM mlm_plan_settings WHERE is_active = TRUE ORDER BY effective_from DESC LIMIT 1),
           'pending', $7, 'distributor_self_purchase', TRUE)`,
        [
          dbOrderId,
          distributorUserId,
          distributorUserId,
          totalAmount,
          selfRate,
          selfCommission,
          selfTxnId,
        ],
      );

      await client.query(
        `UPDATE wallets
         SET pending_amount = COALESCE(pending_amount, 0) + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [selfCommission, distributorUserId],
      );
    }

    const existingQualifying = await client.query(
      `SELECT COUNT(*) as cnt FROM orders
       WHERE mlm_source_user_id = $1 AND mlm_eligible = TRUE
         AND order_status IN ('confirmed', 'completed', 'delivered')
         AND id <> COALESCE($2, 0)`,
      [distributorUserId, dbOrderId],
    );
    if (Number(existingQualifying.rows[0].cnt) === 0) {
      await client.query(
        `UPDATE users SET is_active = TRUE WHERE id = $1`,
        [distributorUserId],
      );
    }

    await distributeParentChainCommission(client, {
      sourceUserId: distributorUserId,
      orderId: dbOrderId,
      baseAmount: totalAmount,
    });

    await client.query("COMMIT");

    const orderPayload = {
      order_id: orderRef,
      sakhi_distributor_id: "N/A",
      transaction_date: "",
      transaction_description: "Distributor Self Purchase (MLM Eligible)",
      receipt_no: "",
      invoice_url: "null",
      customer_name: customerName,
      residential_address:
        (shipping_address?.landmark
          ? shipping_address.landmark + ", "
          : "") +
        [
          shipping_address?.address_line1,
          shipping_address?.address_line2,
          shipping_address?.city,
          shipping_address?.state,
          shipping_address?.country,
          shipping_address?.pincode,
        ]
          .filter(Boolean)
          .join(", "),
      shipping_address:
        (shipping_address?.landmark
          ? shipping_address.landmark + ", "
          : "") +
        [
          shipping_address?.address_line1,
          shipping_address?.address_line2,
          shipping_address?.city,
          shipping_address?.state,
          shipping_address?.country,
          shipping_address?.pincode,
        ]
          .filter(Boolean)
          .join(", "),
      shipping_contact_no: shipping_address?.phone,
      email_address: customerEmail,
      shippingCharges: shippingCharges,
      items: validatedItems.map((item, index) => ({
        s_no: index + 1,
        hsn_code: "",
        name: item.product_name,
        quantity: item.qty,
        price: item.unit_price,
        taxRate: item.variant_details?.tax_data?.percentage || 0,
        taxAmt: item.item_tax,
      })),
    };

    if (customerEmail) {
      try {
        await sendPlacedOrderEmail(customerEmail, orderPayload);
      } catch (mailErr) {
        console.error("Mail Dispatch Error:", mailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message:
        "Order placed successfully. Self commission created in PENDING status. It will be released after 5 minutes, then upline generation commissions will be distributed.",
      order_id: orderRef,
      total_amount: totalAmount,
      self_commission: selfCommission,
      self_commission_status: selfCommission > 0 ? "pending" : "not_eligible",
      activated:
        Number(existingQualifying.rows[0].cnt) === 0 ? true : null,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Distributor Order Place Error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

exports.placeOrder = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const userId = req.user.id;
    const {
      items, // [{product_id, variation_id, quantity}]
      shipping_address,
      coupon_code,
      payment_method = "wallet",
      order_for = "admin",
      distributor_id, // Explicitly passed from frontend
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Items required");
    }

    // verify customer name
    const userRes = await client.query(
      "SELECT name, email FROM ecom_user WHERE id = $1",
      [userId],
    );
    const customerName = userRes.rows[0]?.name || "Customer";
    const customerEmail = userRes.rows[0]?.email;

    // 1. Target Distributor Identify karein (Fallback Logic)
    let targetDistributorId = distributor_id ? parseInt(distributor_id) : 0;

    let subTotal = 0;
    let totalTax = 0; // Dynamic Tax Accumulator
    let totalBV = 0;
    const validatedItems = [];

    // 2. Validate Items & Fetch Prices
    for (const item of items) {
      const { product_id, variation_id, quantity: qty } = item;

      let productData;
      let taxRate = 0;
      let taxInfoObj = null;

      if (variation_id) {
        // --- CASE 1: Variable Product ---
        const variantRes = await client.query(
          `SELECT pv.sku, pv.price, pv.bv_point, pv.stock, p.name as product_name, 
              p.f_image as product_image,
              t.tax_percentage as tax_rate,
              jsonb_build_object(
                'id', t.id,
                'name', t.tax_name,
                'percentage', t.tax_percentage
              ) as tax_info,
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
          [variation_id, product_id],
        );
        productData = variantRes.rows[0];
      } else {
        // --- CASE 2: Simple Product (No Variation) ---
        const productRes = await client.query(
          `SELECT 
            p.id::text as sku, 
            t.tax_percentage as tax_rate,
            CASE 
              WHEN p.discounted_price > 0 THEN p.discounted_price 
              ELSE p.base_price
            END as price,            
            null as stock, 
            p.name as product_name, 
            p.f_image as product_image, 
            '[]'::jsonb as attributes,
            jsonb_build_object(
              'id', t.id,
              'name', t.tax_name,
              'percentage', t.tax_percentage
            ) as tax_info
          FROM products p
          LEFT JOIN tax_settings t ON t.id = p.tax_id 
          WHERE p.id = $1 AND p.status = 'active'`,
          [product_id],
        );
        productData = productRes.rows[0];
      }

      if (!productData) {
        throw new Error(
          `Product/Variant reference matching ID ${product_id} is not active.`,
        );
      }

      taxRate = parseFloat(productData.tax_rate || 0);
      taxInfoObj = productData.tax_info;

      // --- INVENTORY CHECK WITH FALLBACK ---
      const invRes = await client.query(
        `SELECT distributor_id, quantity FROM distributor_inventory 
         WHERE product_id = $1 AND (variant_id = $2 OR (variant_id IS NULL AND $2 IS NULL))
         AND (distributor_id = $3 OR distributor_id = 0)
         ORDER BY (distributor_id = $3) DESC`,
        [product_id, variation_id || null, targetDistributorId],
      );

      let specificDistStock = invRes.rows.find(
        (r) => r.distributor_id == targetDistributorId,
      );
      let mainWarehouseStock = invRes.rows.find((r) => r.distributor_id == 0);

      let finalStockSource = null;

      if (specificDistStock && specificDistStock.quantity >= qty) {
        finalStockSource = targetDistributorId;
      } else if (mainWarehouseStock && mainWarehouseStock.quantity >= qty) {
        finalStockSource = 0;
      } else {
        throw new Error(`Insufficient stock for ${productData.product_name}.`);
      }

      const price = parseFloat(productData.price);
      const itemTax = ((price * taxRate) / 100) * qty;
      const itemTotal = price * qty;

      const unitBV = 1;
      const itemBV = unitBV * qty;

      validatedItems.push({
        product_id,
        variant_id: variation_id || null,
        variant_details: {
          price: productData.price,
          bv_point: productData.bv_point,
          tax_data: taxInfoObj, // Frontend validation matching query output sync
          attributes: productData.attributes || [],
        },
        qty,
        unit_price: price,
        unit_bv_points: unitBV,
        total_item_price: itemTotal,
        total_item_bv: itemBV,
        stock_source: finalStockSource,
        product_name: productData.product_name,
        product_image: productData.product_image,
        item_tax: itemTax, // Store item-wise tax for later use in order_items table
      });

      subTotal += itemTotal;
      totalTax += itemTax;
      totalBV += itemBV;
    }

    // 3. Tax & Shipping (Simple Logic)
    let shippingCharges = 0;
    if (subTotal <= 260) {
      shippingCharges = await getShippingCharge(client);
    }

    const taxAmount = Math.round(totalTax * 100) / 100;

    // Coupon base total uses the same `total_amount` concept as couponController.validateCoupon
    const couponBaseTotalAmount = subTotal + taxAmount + shippingCharges;

    // Apply coupon discount (if provided) - atomic inside the same transaction
    let discountAmount = 0;
    let finalTotalAmount = couponBaseTotalAmount;

    if (coupon_code) {
      const couponCodeNormalized = String(coupon_code).trim().toUpperCase();
      const couponValidationPayloadTotal = couponBaseTotalAmount;

      // Build product list for coupon validation (coupon rules are based on products array)
      const couponProducts = items.map((it) => it.product_id).filter(Boolean);

      // Inline the core of couponController.validateCoupon but adapt to server checkout context.
      const couponResult = await client.query(
        `
          SELECT * FROM coupons
          WHERE code = $1 AND status = 'active' AND used_count < usage_limit
        `,
        [couponCodeNormalized],
      );

      if (couponResult.rows.length === 0) {
        throw new Error("Invalid or inactive coupon");
      }

      const coupon = couponResult.rows[0];

      const now = new Date();
      if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        throw new Error("Coupon not yet valid");
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        throw new Error("Coupon expired");
      }

      if (
        parseFloat(couponValidationPayloadTotal) <
        parseFloat(coupon.min_order_amount)
      ) {
        throw new Error(`Minimum order ${coupon.min_order_amount} required`);
      }

      if (coupon.applicable_products && coupon.applicable_products.length > 0) {
        const productIds = couponProducts.map((p) => parseInt(p));
        const invalid = coupon.applicable_products.some(
          (id) => !productIds.includes(id),
        );
        if (invalid) {
          throw new Error("Coupon not applicable to these products");
        }
      }

      // User restriction / anti-abuse:
      // couponController uses (user_id=... OR username OR phone OR ip_address).
      // Here we only have userId from auth; username/phone/ip are not available in this flow.
      // We still enforce applicable_users if present.
      if (coupon.applicable_users && coupon.applicable_users.length > 0) {
        if (!coupon.applicable_users.includes(parseInt(userId))) {
          throw new Error("Coupon not applicable to this user");
        }
      }

      const usageCheck = await client.query(
        `
          SELECT 1 FROM coupon_usages
          WHERE coupon_id = $1
          AND (user_id = $2 OR username = $3 OR phone = $4 OR ip_address = $5)
        `,
        [coupon.id, parseInt(userId), null, null, null],
      );

      if (usageCheck.rows.length > 0) {
        throw new Error("Coupon already used by this user/phone/IP");
      }

      // Calculate discount
      if (coupon.discount_type === "percentage") {
        discountAmount =
          (parseFloat(coupon.discount_amount) / 100) *
          parseFloat(couponValidationPayloadTotal);
      } else {
        discountAmount = parseFloat(coupon.discount_amount);
      }

      if (coupon.max_discount_amount) {
        discountAmount = Math.min(
          discountAmount,
          parseFloat(coupon.max_discount_amount),
        );
      }

      discountAmount = parseFloat(discountAmount.toFixed(2));
      finalTotalAmount = couponBaseTotalAmount - discountAmount;
      if (finalTotalAmount < 0) finalTotalAmount = 0;

      // Apply coupon usage: increment used_count + record usage
      await client.query(
        `UPDATE coupons SET used_count = used_count + 1 WHERE id = $1`,
        [coupon.id],
      );

      await client.query(
        `
          INSERT INTO coupon_usages
            (coupon_id, user_id, username, phone, ip_address, user_agent)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [coupon.id, parseInt(userId), null, null, null, null],
      );
    }

    const totalAmount = finalTotalAmount;

    // 4. Create Order

    const orderRef = generateOrderId();
    const orderInsert = await client.query(
      `INSERT INTO orders (order_id, user_id, distributor_id, sub_total, 
      tax_amount, shipping_charges, total_amount, total_bv_points, shipping_address, payment_method, order_status, order_for)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11) RETURNING *`,
      [
        orderRef,
        userId,
        targetDistributorId,
        subTotal,
        taxAmount,
        shippingCharges,
        totalAmount,
        totalBV,
        shipping_address,
        payment_method,
        order_for,
      ],
    );
    const newOrderResult = orderInsert.rows[0];
    const dbOrderId = newOrderResult.id;

    // 5. Insert Items & UPDATE INVENTORY (Deduction)
    for (const item of validatedItems) {
      // Fixed structural alignment syntax error & index array parameters matching columns count exactly (12 parameters)
      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, variant_id, product_name, 
          variant_details, qty, unit_price, unit_bv_points, 
          total_item_price, total_item_bv, stock_source, product_image
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          dbOrderId,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.variant_details,
          item.qty,
          item.unit_price,
          item.unit_bv_points,
          item.total_item_price,
          item.total_item_bv,
          item.stock_source,
          item.product_image,
        ],
      );

      // Inventory Deduct
      const deductRes = await client.query(
        `UPDATE distributor_inventory 
         SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $2 AND (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))
         AND distributor_id = $4 RETURNING quantity`,
        [item.qty, item.product_id, item.variant_id, item.stock_source],
      );

      if (deductRes.rowCount === 0) {
        throw new Error(`Inventory update failed for ${item.product_name}`);
      }
    }

    // 6. Clear Cart after success
    await client.query(
      `DELETE FROM e_cart_items WHERE cart_id = (SELECT id FROM e_carts WHERE user_id = $1)`,
      [userId],
    );

    await client.query("COMMIT");

    const orderPayload = {
      order_id: orderRef,
      sakhi_distributor_id: "N/A",
      transaction_date: "",
      transaction_description: "Purchase",
      receipt_no: "",
      invoice_url: "null",
      customer_name: customerName,
      residential_address:
        shipping_address?.landmark +
        ", " +
        shipping_address.address_line1 +
        ", " +
        shipping_address.address_line2 +
        ", " +
        shipping_address.city +
        ", " +
        shipping_address.state +
        ", " +
        shipping_address.country +
        ", " +
        shipping_address.pincode,
      shipping_address:
        shipping_address?.landmark +
        ", " +
        shipping_address.address_line1 +
        ", " +
        shipping_address.address_line2 +
        ", " +
        shipping_address.city +
        ", " +
        shipping_address.state +
        ", " +
        shipping_address.country +
        ", " +
        shipping_address.pincode,
      shipping_contact_no: shipping_address.phone,
      email_address: customerEmail,
      shippingCharges: shippingCharges,
      items: validatedItems.map((item, index) => ({
        s_no: index + 1,
        hsn_code: "",
        name: item.product_name,
        quantity: item.qty,
        price: item.unit_price,
        taxRate: item.variant_details.tax_data.percentage,
        taxAmt: item.item_tax,
      })),
    };

    // Dispatch email if a valid inbox exists
    if (customerEmail) {
      // Wrapped inside a try/catch so that an unhandled SMTP transport failure won't crash your server thread
      try {
        await sendPlacedOrderEmail(customerEmail, orderPayload);
      } catch (mailErr) {
        console.error(
          "Mail Dispatch Error (Transaction preserved):",
          mailErr.message,
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Order placed successfully",
      order_id: orderRef,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Order Place Error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [userId];
    let whereClause = "WHERE o.user_id = $1";

    if (status) {
      params.push(status);
      // Ensure column name matches your DB (usually 'status' or 'order_status')
      whereClause += ` AND o.status = $${params.length}`;
    }

    const ordersQuery = `
      SELECT 
        o.*, 
        COALESCE(
          (SELECT jsonb_agg(items_json)
           FROM (
             SELECT 
               oi.id, 
               oi.product_id, 
               oi.variant_id, 
               oi.product_name, 
               oi.product_image, 
               oi.qty, 
               oi.unit_price, 
               oi.total_item_price
             FROM order_items oi
             WHERE oi.order_id = o.id
           ) items_json
          ), '[]'::jsonb
        ) AS items,
        (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as total_items_count
      FROM orders o 
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

    const totalCount = totalRes.rows[0].count;

    res.json({
      success: true,
      data: orders.rows,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get My Orders Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin: Get all orders

exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, filter = "all", search } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = "WHERE 1=1";
    const params = [];

    if (status) {
      params.push(status);
      whereClause += ` AND o.order_status = $${params.length}`;
    }

    if (filter && filter !== "all") {
      if (filter === "my") {
        // Show only rows that ARE for a distributor
        whereClause += ` AND o.order_for IS NULL OR o.order_for = 'admin'`;
      } else if (filter === "distributor") {
        // Show rows that ARE NOT for a distributor OR are NULL admin-distributor
        whereClause += ` AND o.order_for = 'admin-distributor'`;
        // whereClause += ` AND (o.order_for NOT LIKE 'distributor_%' OR o.order_for IS NULL)`;
      } else {
        // Specific ID match
        params.push(filter);
        whereClause += ` AND o.order_for = $${params.length}`;
      }
    }

    // Search across order_id, user_name, and user_phone
    if (search) {
      const searchTerm = `%${search}%`;
      params.push(searchTerm);
      const searchIdx = params.length;
      params.push(searchTerm);
      const searchIdx2 = params.length;
      params.push(searchTerm);
      const searchIdx3 = params.length;
      whereClause += ` AND (
        o.order_id ILIKE $${searchIdx}
        OR u.name ILIKE $${searchIdx2}
        OR u.phone ILIKE $${searchIdx3}
        OR d.full_name ILIKE $${searchIdx2}
        OR d.username ILIKE $${searchIdx2}
        OR d.phone ILIKE $${searchIdx3}
      )`;
    }

    // console.log("filter - ", filter, whereClause);

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
        CASE 
          WHEN o.distributor_id IS NOT NULL AND o.order_for LIKE 'distributor_%' THEN 
            JSON_BUILD_OBJECT(
              'id', d.id,
              'name', COALESCE(d.full_name, d.username),
              'phone', d.phone,
              'username', d.username
            )
          ELSE NULL 
        END as distributor,
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

    // console.log("query - ", ordersQuery);

    const orders = await db.query(ordersQuery, [
      ...params,
      parseInt(limit),
      offset,
    ]);

    const totalRes = await db.query(
      `SELECT COUNT(*)::int FROM orders o 
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

// exports.getAllOrders = async (req, res) => {
//   try {
//     const { page = 1, limit = 20, status } = req.query;

//     const offset = (parseInt(page) - 1) * parseInt(limit);
//     let whereClause = "WHERE 1=1";
//     const params = [];

//     if (status) {
//       params.push(status);
//       whereClause += ` AND o.order_status = $${params.length}`;
//     }

//     // if (user_id) {
//     //   params.push(user_id);
//     //   whereClause += ` AND o.user_id = $${params.length}`;
//     // }

//     const ordersQuery = `
//       SELECT o.*,
//              u.name, u.phone,
//              COUNT(oi.id)::int as item_count,
//              oi.product_name, oi.product_image, oi.variant_details
//       FROM orders o
//       JOIN ecom_user u ON o.user_id = u.id
//       LEFT JOIN order_items oi ON o.id = oi.order_id
//       ${whereClause}
//       GROUP BY o.id, u.name, u.phone , oi.product_name, oi.product_image, oi.variant_details
//       ORDER BY o.created_at DESC
//       LIMIT $${params.length + 1} OFFSET $${params.length + 2}
//     `;

//     const orders = await db.query(ordersQuery, [
//       ...params,
//       parseInt(limit),
//       offset,
//     ]);

//     const totalRes = await db.query(
//       `SELECT COUNT(DISTINCT o.id)::int FROM orders o ${whereClause}`,
//       params,
//     );

//     res.json({
//       success: true,
//       data: orders.rows,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total: parseInt(totalRes.rows[0].count),
//         pages: Math.ceil(parseInt(totalRes.rows[0].count) / parseInt(limit)),
//       },
//     });
//   } catch (error) {
//     console.error("Error in getAllOrders:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// Admin/User: Get order detail
exports.getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
       SELECT 
          o.id, 
          o.*, 
          CASE 
              WHEN o.user_id IS NOT NULL THEN 'User'
              WHEN o.distributor_id IS NOT NULL THEN 'Distributor'
              ELSE 'Unknown'
          END as user_type,
          COALESCE(u.name, d.full_name, d.username) as user_name, 
          COALESCE(u.phone, d.phone) as user_phone,
          json_agg(
              json_build_object(
                  'id', oi.id,
                  'product_name', oi.product_name, 
                  'product_image', oi.product_image, 
                  'variant_sku', oi.variant_sku, 
                  'variant_details', oi.variant_details, 
                  'qty', oi.qty, 
                  'price', oi.unit_price, 


                  -- If oi.unit_price is EXCLUSIVE of tax (Base Price):
                  'base_unit_price', ROUND(oi.unit_price::numeric, 2),
                  'tax_amount_per_unit', ROUND((oi.unit_price * COALESCE((oi.variant_details->'tax_data'->>'percentage')::numeric, 0) / 100)::numeric, 2),
                  'total_tax_amount', ROUND((oi.unit_price * oi.qty * COALESCE((oi.variant_details->'tax_data'->>'percentage')::numeric, 0) / 100)::numeric, 2),
                  'unit_price_inclusive', ROUND((oi.unit_price * (1 + COALESCE((oi.variant_details->'tax_data'->>'percentage')::numeric, 0) / 100))::numeric, 2),

                  -- Extracting tax percentage from JSON and calculating
                  'tax_amount', ROUND(
                      (oi.unit_price * COALESCE((oi.variant_details->'tax_data'->>'percentage')::numeric, 0) / 100)::numeric, 
                      2
                  ),
                  'unit_price', ROUND(
                      (oi.unit_price * (1 + COALESCE((oi.variant_details->'tax_data'->>'percentage')::numeric, 0) / 100))::numeric, 
                      2
                  ),
                  'total_item_price', oi.total_item_price
              )
          ) FILTER (WHERE oi.id IS NOT NULL) as items ,
           json_agg(to_jsonb(ret.*)) as return_data
      FROM orders o 
      LEFT JOIN ecom_user u ON o.user_id = u.id 
      LEFT JOIN users d ON o.distributor_id = d.id 
      LEFT JOIN order_items oi ON o.id = oi.order_id 
      LEFT JOIN order_returns ret ON ret.order_id = o.id
      WHERE o.order_id = $1
      GROUP BY o.id, u.id, d.id, ret.id;
    `;

    const order = await db.query(query, [id]);

    if (order.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, query, message: "Order not found" });
    }

    res.json({ success: true, data: order.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin: Update order status (e.g., shipped -> triggers commissions?)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { order_status, remarks } = req.body;

    // Validate status transitions (simple)
    const validStatuses = [
      "pending",
      "packed",
      "processing",
      "dispatched",
      "delivered",
      "cancelled",
      "accepted",
    ];
    if (!validStatuses.includes(order_status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const role = req.user.role;

    if (role !== "Super Admin") {
      // checking this order is his
      const checkRes = await db.query(
        `SELECT * FROM orders 
          WHERE order_for LIKE 'distributor_%' 
          AND distributor_id = $1 AND order_id = $2`,
        [req.user.id, id],
      );

      if (checkRes.rows.length === 0) {
        return res.json({ success: false, message: "Access Denied" });
      }
    }

    let query = `UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 RETURNING *`;
    // let query = `UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *`;

    const result = await db.query(query, [order_status, id]);
    // const result = await db.query(query, [id]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const orderData = result.rows[0];
    let userId = orderData.user_id;
    let customerEmail = null;
    let customerName = null;
    let user_query = `SELECT name, email FROM ecom_user WHERE id = $1`;
    if (orderData.order_for === "admin-distributor") {
      userId = orderData.distributor_id;
      user_query = `
        SELECT full_name AS name, email
        FROM users
        WHERE id = $1
    `;
    }

    const userRes = await db.query(user_query, [userId]);
    if (userRes.rows.length > 0) {
      customerEmail = userRes.rows[0].email;
      customerName = userRes.rows[0].name || "Customer";
    }

    // Dispatch email if a valid inbox exists

    // Get user data
    if (customerEmail) {
      // Wrapped inside a try/catch so that an unhandled SMTP transport failure won't crash your server thread
      try {
        const orderPayload = {
          order_id: orderData.order_id,
          customer_name: customerName,
          status: order_status,
        };

        await sendOrderStatusUpdateEmail(customerEmail, orderPayload);
      } catch (mailErr) {
        console.error(
          "Mail Dispatch Error (Transaction preserved):",
          mailErr.message,
        );
      }
    }

    // TODO: If 'delivered', trigger commissions to uplines based on total_bv_points

    res.json({
      success: true,
      message: "Order status updated",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin: Cancel order (refund if paid)
exports.cancelOrder = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const order = await client.query("SELECT * FROM orders WHERE id = $1", [
      parseInt(id),
    ]);

    if (order.rows.length === 0 || order.rows[0].order_status === "cancelled") {
      throw new Error("Order not found or already cancelled");
    }

    const o = order.rows[0];
    if (o.payment_status === "paid") {
      // Refund to wallet
      await client.query(
        "UPDATE wallets SET total_amount = total_amount + $1 WHERE user_id = $2",
        [o.total_amount, o.user_id],
      );
      // Log refund txn
      await client.query(
        `INSERT INTO transactions (user_id, amount, type, category, order_id, remarks)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          o.user_id,
          o.total_amount,
          "credit",
          "refund",
          o.id,
          "Order cancelled refund",
        ],
      );
    }

    await client.query(
      "UPDATE orders SET order_status = 'cancelled', payment_status = 'cancelled' WHERE id = $1",
      [parseInt(id)],
    );

    await client.query("COMMIT");
    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(400).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};
