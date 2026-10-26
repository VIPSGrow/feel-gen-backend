const cron = require("node-cron");
const { expireStaleUnpaidOrders } = require("../services/paymentOrderService");

const EXPIRY_MINUTES = Number(process.env.PENDING_PAYMENT_EXPIRY_MIN) || 30;
let running = false;

async function expirePendingPayments() {
  if (running) return;
  running = true;
  try {
    const { checked, cancelled } = await expireStaleUnpaidOrders(EXPIRY_MINUTES);
    if (checked > 0) {
      console.log(`[Cron] Unpaid online orders: checked ${checked}, cancelled ${cancelled}`);
    }
  } catch (err) {
    console.error("[Cron] Pending payment expiry error:", err);
  } finally {
    running = false;
  }
}

cron.schedule("*/10 * * * *", expirePendingPayments);

console.log(`\n ====== Pending payment expiry cron scheduled (every 10 min, ${EXPIRY_MINUTES} min timeout) ====== `);
