const db = require("../../../config/db");

async function getMyTickets({ authContext }) {
  if (!authContext?.id) return null;

  const userColumn =
    authContext.role === "DISTRIBUTOR" ? "distributor_id" : "ecom_user_id";

  const query = `
      SELECT case_id, subject, status, updated_at
      FROM tickets
      WHERE ${userColumn} = $1
      ORDER BY updated_at DESC
      LIMIT 5
    `;

  const result = await db.query(query, [authContext.id]);
  return result.rows;
}

const sharedTools = {
  getMyTickets,
};
module.exports = { sharedTools };
