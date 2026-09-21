const db = require("../config/db");

// Get wallet balance (total + pending)
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
    SELECT 
    COALESCE(w.total_amount, 0) as total_balance,
    COALESCE(w.pending_amount, 0) as pending_balance,
    COALESCE(w.company_fund, 0) as company_balance,
    (COALESCE(w.total_amount, 0) + COALESCE(w.pending_amount, 0)) as available_balance,
    COALESCE(w.withdrawable_amount, 0) as withdrawable_amount,
    (SELECT COUNT(*) FROM transactions WHERE user_id = $1) as total_transactions
FROM wallets w
WHERE w.user_id = $1;`;

    const wallet = await db.query(query, [userId]);

    res.json({
      success: true,
      data: wallet.rows[0] || {
        total_balance: 0,
        pending_balance: 0,
        available_balance: 0,
        total_transactions: 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Get transaction history
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type, category } = req.query;
    const offset = (page - 1) * limit;

    // let query = `
    //   SELECT
    //     t.id, t.amount, t.type, t.category, t.status, t.remarks, t.created_at,
    //     u.username as other_user,
    //     o.order_id
    //   FROM transactions t
    //   LEFT JOIN users u ON t.source_user_id = u.id OR (t.user_id != $1 AND t.source_user_id = $1)
    //   LEFT JOIN orders o ON t.order_id = o.id
    //   WHERE t.user_id = $1
    // `;

    let query = `
      SELECT 
        t.id, t.amount,
        t.user_id,
        t.type, t.category, t.status, t.remarks, t.created_at,
        u.username as other_user,
        o.order_id
      FROM transactions t
      LEFT JOIN users u ON t.source_user_id = u.id OR (t.user_id != $1 AND t.source_user_id = u.id)
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE t.user_id = $1`;
    const params = [userId];

    if (type) {
      query += " AND t.type = $" + params.push(type);
    }
    if (category) {
      query += " AND t.category = $" + params.push(category);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(parseInt(limit), offset);

    const transactions = await db.query(query, params);

    const countResult = await db.query(
      "SELECT COUNT(*)::int FROM transactions WHERE user_id = $1",
      [userId],
    );
    const total = countResult.rows[0].count;

    res.json({
      success: true,
      data: transactions.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
