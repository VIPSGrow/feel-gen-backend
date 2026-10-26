const Razorpay = require("razorpay");
const db = require("../config/db");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const hasCapturedPayment = async (razorpayOrderId) => {
  if (!razorpayOrderId) return null;
  const payments = await razorpay.orders.fetchPayments(razorpayOrderId);
  return (
    (payments?.items || []).find(
      (p) => p.status === "captured" || p.status === "authorized",
    ) || null
  );
};

/**
 * Idempotently marks an online-payment order as paid.
 * Looks the order up by our order_id (ref) or by Razorpay order id.
 */
async function markOrderPaid({ orderRef, razorpayOrderId, paymentId }) {
  const client = await db.connect();
  let paidOrderRef = null;
  try {
    await client.query("BEGIN");

    const found = await client.query(
      `SELECT id, order_id, user_id, payment_status, order_status, clear_cart_on_paid
       FROM orders
       WHERE ($1::text IS NOT NULL AND order_id = $1)
          OR ($2::text IS NOT NULL AND razorpay_order_id = $2)
       LIMIT 1
       FOR UPDATE`,
      [orderRef || null, razorpayOrderId || null],
    );

    if (found.rows.length === 0) {
      await client.query("ROLLBACK");
      return { updated: false, reason: "order_not_found" };
    }

    const order = found.rows[0];

    if (order.payment_status === "paid") {
      await client.query("ROLLBACK");
      return { updated: false, reason: "already_paid", orderRef: order.order_id };
    }

    if (order.order_status === "cancelled") {
      // Money was captured after we released the order; needs a manual refund.
      await client.query(
        `UPDATE orders
         SET payment_status = 'paid_after_cancel',
             razorpay_payment_id = COALESCE($2, razorpay_payment_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [order.id, paymentId || null],
      );
      await client.query("COMMIT");
      console.error(
        `[payment] Payment ${paymentId} captured for CANCELLED order ${order.order_id}. Manual refund required.`,
      );
      return { updated: false, reason: "paid_after_cancel", orderRef: order.order_id };
    }

    await client.query(
      `UPDATE orders
       SET payment_status = 'paid',
           razorpay_payment_id = COALESCE($2, razorpay_payment_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id, paymentId || null],
    );

    if (order.clear_cart_on_paid) {
      await client.query(
        `DELETE FROM e_cart_items
         WHERE cart_id IN (SELECT id FROM e_carts WHERE user_id = $1)`,
        [order.user_id],
      );
    }

    await client.query("COMMIT");
    paidOrderRef = order.order_id;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Idempotent; never throws.
  await require("./qualification/QualificationService").recordPurchaseForOrderRef(
    paidOrderRef,
  );
  return { updated: true, orderRef: paidOrderRef };
}

/**
 * Cancels an unpaid online-payment order and releases what it reserved
 * (inventory, coupon usage). Never cancels an order that has a payment.
 * Pass userId to enforce ownership (user-initiated cancel).
 */
async function cancelUnpaidOnlineOrder({ orderRef, userId = null, reason = "payment_cancelled" }) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const found = await client.query(
      `SELECT id, order_id, user_id, payment_method, payment_status, order_status, razorpay_order_id
       FROM orders
       WHERE order_id = $1
       FOR UPDATE`,
      [orderRef],
    );

    if (found.rows.length === 0) {
      await client.query("ROLLBACK");
      return { cancelled: false, reason: "order_not_found" };
    }

    const order = found.rows[0];

    if (userId !== null && String(order.user_id) !== String(userId)) {
      await client.query("ROLLBACK");
      return { cancelled: false, reason: "forbidden" };
    }

    if (
      order.payment_method !== "razorpay" ||
      order.payment_status !== "unpaid" ||
      order.order_status !== "pending"
    ) {
      await client.query("ROLLBACK");
      return { cancelled: false, reason: "not_cancellable", payment_status: order.payment_status };
    }

    // The user may have paid just before closing the popup.
    const captured = await hasCapturedPayment(order.razorpay_order_id);
    if (captured) {
      await client.query("ROLLBACK");
      await markOrderPaid({ orderRef: order.order_id, paymentId: captured.id });
      return { cancelled: false, reason: "already_paid" };
    }

    const items = await client.query(
      `SELECT product_id, variant_id, qty, stock_source FROM order_items WHERE order_id = $1`,
      [order.id],
    );

    for (const item of items.rows) {
      await client.query(
        `UPDATE distributor_inventory
         SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $2
           AND (variant_id = $3 OR (variant_id IS NULL AND $3 IS NULL))
           AND distributor_id = $4`,
        [item.qty, item.product_id, item.variant_id, item.stock_source],
      );
    }

    const usage = await client.query(
      `DELETE FROM coupon_usages WHERE order_id = $1 RETURNING coupon_id`,
      [order.id],
    );
    for (const row of usage.rows) {
      await client.query(
        `UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = $1`,
        [row.coupon_id],
      );
    }

    await client.query(
      `UPDATE orders
       SET order_status = 'cancelled',
           payment_status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id],
    );

    await client.query("COMMIT");
    console.log(`[payment] Order ${order.order_id} cancelled (${reason}).`);
    return { cancelled: true, orderRef: order.order_id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Cancels online orders left unpaid for longer than `olderThanMinutes`. */
async function expireStaleUnpaidOrders(olderThanMinutes = 30) {
  const stale = await db.query(
    `SELECT order_id FROM orders
     WHERE payment_method = 'razorpay'
       AND payment_status = 'unpaid'
       AND order_status = 'pending'
       AND total_amount > 0
       AND created_at < CURRENT_TIMESTAMP - (INTERVAL '1 minute' * $1)
     ORDER BY created_at
     LIMIT 100`,
    [olderThanMinutes],
  );

  let cancelled = 0;
  for (const row of stale.rows) {
    try {
      const result = await cancelUnpaidOnlineOrder({
        orderRef: row.order_id,
        reason: "payment_timeout",
      });
      if (result.cancelled) cancelled += 1;
    } catch (err) {
      console.error(`[payment] Failed to expire order ${row.order_id}:`, err.message);
    }
  }
  return { checked: stale.rows.length, cancelled };
}

module.exports = { markOrderPaid, cancelUnpaidOnlineOrder, expireStaleUnpaidOrders };
