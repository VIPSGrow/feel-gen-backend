const db = require('./config/db');
(async () => {
  const r = await db.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position"
  );
  console.log(JSON.stringify(r.rows, null, 2));
  await db.end();
})();