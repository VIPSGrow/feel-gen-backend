const cron = require("node-cron");
const { scanRepurchaseDue } = require("../services/repurchaseService");

async function run() {
  try {
    const { created, completed } = await scanRepurchaseDue();
    if (created || completed) {
      console.log(`[repurchaseCron] created=${created} completed=${completed}`);
    }
  } catch (err) {
    console.error("[repurchaseCron] failed:", err.message);
  }
}

// Daily at 00:30 IST. Idempotent.
cron.schedule("30 0 * * *", run, { timezone: "Asia/Kolkata" });

module.exports = { run };
