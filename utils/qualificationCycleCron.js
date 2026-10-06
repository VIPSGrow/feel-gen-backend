const cron = require("node-cron");
const { resetExpiredCycles } = require("../services/qualification/QualificationService");

async function run() {
  console.error("[qualificationCron] Started:");
  try {
    const n = await resetExpiredCycles();
    if (n > 0) console.log(`[qualificationCron] reset ${n} user cycle(s)`);
  } catch (err) {
    console.error("[qualificationCron] failed:", err.message);
  }
}

// Daily at 00:00 IST. Idempotent: only users whose 28-day window ended are touched.
cron.schedule("0 0 * * *", run, { timezone: "Asia/Kolkata" });

module.exports = { run };
