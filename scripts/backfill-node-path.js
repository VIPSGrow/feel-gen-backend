const pool = require("../config/db");

/**
 * Backfill node_path for users where it is NULL or empty.
 *
 * node_path follows an ltree-style hierarchy, e.g. "root.1.2.3"
 *   - The very first user (or a user with no referrer) gets "root"
 *   - Every other user gets "<parent_path>.<child_index>"
 *
 * Users are processed in id order so parents are always backfilled before
 * their children.  Child index is computed as the number of existing
 * siblings (users with the same referrer_id) at the moment of assignment.
 */

async function backfillNodePaths() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Count how many users need backfilling
    const countRes = await client.query(
      "SELECT COUNT(*) AS total FROM users WHERE node_path IS NULL OR node_path = ''",
    );
    const total = parseInt(countRes.rows[0].total, 10);
    console.log(`Users needing node_path backfill: ${total}`);

    if (total === 0) {
      console.log("Nothing to backfill.");
      return;
    }

    // 2. Fetch all users that need backfilling, ordered by id so parents
    //    are processed before children (referrer_id always references a
    //    smaller id in practice, but ordering guarantees correctness).
    const usersRes = await client.query(
      `SELECT id, referrer_id
       FROM users
       WHERE node_path IS NULL OR node_path = ''
       ORDER BY id ASC`,
    );

    let fixed = 0;

    for (const user of usersRes.rows) {
      let nodePath;

      if (!user.referrer_id) {
        // No referrer → this is a root node
        nodePath = "root";
      } else {
        // Look up the parent's node_path (it must already be set because
        // we process in id order and referrer_id < user.id in normal flows).
        const parentRes = await client.query(
          "SELECT node_path FROM users WHERE id = $1",
          [user.referrer_id],
        );

        if (parentRes.rows.length === 0) {
          console.warn(
            `⚠ User ${user.id} references non-existent referrer ${user.referrer_id}. Skipping.`,
          );
          continue;
        }

        const parentPath = parentRes.rows[0].node_path;
        if (!parentPath) {
          console.warn(
            `⚠ Parent ${user.referrer_id} still has no node_path. Skipping user ${user.id}.`,
          );
          continue;
        }

        // Child index = number of existing siblings + 1
        const siblingRes = await client.query(
          "SELECT COUNT(*) AS cnt FROM users WHERE referrer_id = $1",
          [user.referrer_id],
        );
        const siblingCount = parseInt(siblingRes.rows[0].cnt, 10);
        nodePath = `${parentPath}.${siblingCount + 1}`;
      }

      await client.query(
        "UPDATE users SET node_path = $1 WHERE id = $2",
        [nodePath, user.id],
      );
      fixed++;
    }

    await client.query("COMMIT");
    console.log(`✅ Backfilled node_path for ${fixed} user(s).`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Backfill failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

backfillNodePaths();