const fs = require("fs");
const db = require("../config/db");

function sanitizeDump(sql) {
  const lines = sql.split(/\r?\n/);
  const sanitized = [];
  let skipRestrictToken = false;

  for (const line of lines) {
    if (skipRestrictToken) {
      skipRestrictToken = false;
      continue;
    }
    if (line.startsWith("\\restrict")) {
      skipRestrictToken = true;
      continue;
    }
    if (line.startsWith("\\unrestrict")) continue;
    if (/^ALTER .* OWNER TO vishant;$/.test(line)) continue;
    sanitized.push(line);
  }

  return sanitized.join("\n");
}

async function main() {
  const dumpPath = process.argv[2] || "init-new.sql";
  const sql = sanitizeDump(fs.readFileSync(dumpPath, "utf8"));
  await db.query(sql);
  console.log(`Base schema imported from ${dumpPath}`);
  await db.end();
}

main().catch(async (error) => {
  console.error(`Base schema import failed: ${error.message}`);
  await db.end();
  process.exitCode = 1;
});
