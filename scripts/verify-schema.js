const db = require("../config/db");

async function main() {
  const [count, tables, plan, levels] = await Promise.all([
    db.query("SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'"),
    db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'wallets', 'transactions', 'mlm_plan_settings', 'mlm_generation_commissions', 'mlm_ranks', 'mlm_rank_rewards', 'mlm_commission_events') ORDER BY table_name"),
    db.query("SELECT mrp, direct_partner_commission_percent, distributor_price, packets_per_package, max_generation_level FROM mlm_plan_settings WHERE is_active = TRUE"),
    db.query("SELECT level_no, commission_percent FROM mlm_generation_commissions ORDER BY level_no"),
  ]);

  console.log(JSON.stringify({
    tableCount: count.rows[0].count,
    requiredTables: tables.rows.map((row) => row.table_name),
    activePlan: plan.rows[0],
    levels: levels.rows,
  }, null, 2));

  await db.end();
}

main().catch(async (error) => {
  console.error(error.message);
  await db.end();
  process.exitCode = 1;
});
