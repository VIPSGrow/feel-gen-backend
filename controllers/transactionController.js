const db = require("../config/db");
const bcrypt = require("bcrypt");
const otpService = require("../utils/otpService");
const limitsChecker = require("../utils/limitsChecker");

const HOLD_DAYS = 30;

// Verify transaction PIN
exports.verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const userId = req.user.id;

    if (!pin || pin.length < 4 || pin.length > 6) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid PIN length (4-6 digits)" });
    }

    // Check user pin
    const user = await db.query(
      "SELECT transaction_pin_hash FROM users WHERE id = $1",
      [userId],
    );
    if (!user.rows[0]?.transaction_pin_hash) {
      return res.status(400).json({
        success: false,
        error: "Transaction PIN not set. Set PIN first.",
      });
    }

    const isValid = await bcrypt.compare(
      pin,
      user.rows[0].transaction_pin_hash,
    );
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid PIN" });
    }

    res.json({ success: true, message: "PIN verified" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Send OTP for transaction
exports.sendOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { purpose = "transfer" } = req.body;

    const result = await otpService.sendOTP(userId, purpose);
    res.json({
      success: true,
      message: `OTP sent to ${result.sentTo}`,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { otp, purpose = "transfer" } = req.body;
    const userId = req.user.id;

    const isValid = await otpService.verifyOTP(userId, otp, purpose);
    if (!isValid) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or expired OTP" });
    }

    res.json({ success: true, message: "OTP verified" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Transfer to another user (MLM internal transfer)
exports.transferToUser = async (req, res) => {
  try {
    console.log("Fund Transfer initiate");

    const userId = req.user.id;
    const { toUserId, amount, remarks, pin } = req.body;

    // -------- Basic validation --------
    if (!toUserId) {
      return res
        .status(400)
        .json({ success: false, error: "toUserId is required" });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum)) {
      return res
        .status(400)
        .json({ success: false, error: "amount must be a number" });
    }
    if (amountNum <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "amount must be greater than 0" });
    }

    if (userId === Number(toUserId)) {
      return res.status(400).json({
        success: false,
        error: "toUserId must be different from sender",
      });
    }

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: "Transaction PIN is required",
      });
    }
    if (typeof pin !== "string" || !/^[0-9]{4,6}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: "PIN must be 4-6 digits",
      });
    }

    // Pre-checks (limits)
    await limitsChecker.checkTransferLimits(userId, amountNum);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const toUserRes = await client.query(
        `SELECT referral_code FROM users WHERE id = $1`,
        [toUserId],
      );

      const toUserInfo = toUserRes.rows[0];
      // -------- Verify sender PIN --------
      const senderPinRes = await client.query(
        "SELECT transaction_pin_hash, referral_code FROM users WHERE id = $1 FOR UPDATE",
        [userId],
      );
      const senderPinHash = senderPinRes.rows[0]?.transaction_pin_hash;
      const referral_code = senderPinRes.rows[0]?.referral_code;

      if (!senderPinHash) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Transaction PIN not set. Set PIN first.",
        });
      }

      const pinOk = await bcrypt.compare(pin, senderPinHash);
      if (!pinOk) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, error: "Invalid PIN" });
      }

      // -------- Validate receiver existence + KYC for BOTH --------
      const usersKyc = await client.query(
        "SELECT id, kyc_status FROM users WHERE id = $1 OR id = $2 FOR UPDATE",
        [userId, toUserId],
      );

      if (usersKyc.rows.length < 2) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ success: false, error: "Receiver user not found" });
      }

      const senderKyc = usersKyc.rows.find((r) => r.id === userId);
      const receiverKyc = usersKyc.rows.find(
        (r) => String(r.id) === String(toUserId),
      );

      if (!senderKyc?.kyc_status || !receiverKyc?.kyc_status) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "KYC required for transactions (both users)",
        });
      }

      // -------- Balance check (available = total_amount + pending_amount) --------
      const balanceRes = await client.query(
        `
          SELECT
            COALESCE(withdrawable_amount, 0)  AS available,
            COALESCE(total_amount, 0) AS total_amount
          FROM wallets
          WHERE user_id = $1
          FOR UPDATE
        `,
        [userId],
      );

      const available = parseFloat(balanceRes.rows[0]?.available || 0);
      if (available < amountNum) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "Insufficient balance",
        });
      }

      // Deduct from total_amount (existing logic). If total_amount alone is insufficient, reject.
      const totalAmountOnly = parseFloat(balanceRes.rows[0]?.available || 0);
      if (totalAmountOnly < amountNum) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error:
            "Insufficient withdrawable balance (insufficient Withdrawable Amount)",
        });
      }

      // -------- Perform wallet updates --------
      await client.query(
        "UPDATE wallets SET withdrawable_amount = withdrawable_amount - $1 WHERE user_id = $2",
        [amountNum, userId],
      );

      // Ensure receiver wallet row exists + credit
      await client.query(
        `
          INSERT INTO wallets (user_id, total_amount, pending_amount, left_count, right_count, paid_pairs, company_fund, withdrawable_amount)
          VALUES ($1, $2, 0, 0, 0, 0, 0, 0)
          ON CONFLICT (user_id) DO UPDATE SET
            total_amount = wallets.total_amount + EXCLUDED.total_amount,
            updated_at = CURRENT_TIMESTAMP
        `,
        [toUserId, amountNum],
      );

      // -------- Log transactions --------
      const txnIdSender = await client.query(
        "INSERT INTO transactions (user_id, amount, type, category, source_user_id, remarks, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        [
          userId,
          amountNum,
          "debit",
          "transfer",
          toUserId,
          remarks + " - to " + toUserInfo.referral_code || "P2P Transfer",
          "completed",
        ],
      );

      await client.query(
        "INSERT INTO transactions (user_id, amount, type, category, source_user_id, remarks, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          toUserId,
          amountNum,
          "credit",
          "transfer",
          userId,
          remarks + " - From " + referral_code + " | TID - " + txnIdSender ||
            "P2P Transfer",
          "completed",
        ],
      );

      // Update limits
      await limitsChecker.updateTransferLimits(userId, amountNum);

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Transfer successful",
        txnId: txnIdSender.rows[0].id,
        newBalance: available - amountNum,
      });
    } catch (txnErr) {
      await client.query("ROLLBACK");
      throw txnErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("\n ==== Transfer error - ", err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// Withdraw to bank (similar, but pending_amount move to total first? Add status 'pending_approval')

const getTds = async (client) => {
  const query =
    "SELECT * FROM public.app_settings WHERE setting_key = 'tax_config'";
  const res = await client.query(query);
  if (res.rows.length > 0) {
    return res.rows[0].setting_value.tds_percent;
  }

  return 0;
};
exports.withdraw = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, remarks, pin } = req.body;

    // Same checks as transfer + bank details exist?
    await limitsChecker.checkTransferLimits(userId, amount);

    const user = await db.query(
      "SELECT bank_name, account_no, ifsc_code, transaction_pin_hash FROM users WHERE id = $1",
      [userId],
    );
    if (!user.rows[0]?.account_no || !user.rows[0].transaction_pin_hash) {
      return res.status(400).json({
        success: false,
        error: "TPin and Bank details required",
        data: user.rows[0],
      });
    }

    const isMatch = await bcrypt.compare(
      pin,
      user.rows[0].transaction_pin_hash,
    );

    if (!isMatch)
      return res
        .status(400)
        .json({ success: false, error: "Invalid Transaction Pin" });

    // Balance check (only total_amount for withdraw)
    const balanceRes = await db.query(
      "SELECT COALESCE(withdrawable_amount, 0) as total FROM wallets WHERE user_id = $1",
      [userId],
    );
    const total = parseFloat(balanceRes.rows[0]?.total || 0);
    if (total < amount) {
      return res
        .status(400)
        .json({ success: false, error: "Insufficient withdrawable balance" });
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Deduct immediately; admin approval just finalizes.
      await client.query(
        "UPDATE wallets SET withdrawable_amount = withdrawable_amount - $1 WHERE user_id = $2",
        [amount, userId],
      );

      const txnId = await client.query(
        `INSERT INTO transactions (user_id, amount, type, category, remarks, status) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          userId,
          amount,
          "debit",
          "withdraw",
          remarks || "Bank Withdrawal",
          "pending_approval",
        ],
      );

      await limitsChecker.updateTransferLimits(userId, amount);

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Withdrawal requested (pending admin approval)",
        txnId: txnId.rows[0].id,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// =============================
// Super Admin: Withdraw workflow
// =============================
// Uses `transactions` table as withdraw request record.
// - submit: status = pending_approval (funds already deducted)
// - approve: status = approved (ready for payout cron later)
// - reject: status = rejected AND wallet balance is credited back

exports.listWithdrawRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const adminUserId = req.user.id;

    const allowedStatuses = [
      "pending_approval",
      "approved",
      "rejected",
      "completed",
      "paid",
    ];
    const finalStatus = status ? String(status) : null;
    if (finalStatus && !allowedStatuses.includes(finalStatus)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status filter",
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Pending list by default
    const statusesToShow = finalStatus
      ? [finalStatus]
      : ["pending_approval", "approved", "completed"];

    const query = `
      SELECT
        t.id,
        t.user_id,
        u.username,
        u.full_name,
        t.amount,
        t.remarks,
        t.status,
        t.created_at
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      WHERE t.category = 'withdraw'
        AND t.type = 'debit'
        AND t.status = ANY($1)
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM transactions t
      WHERE t.category = 'withdraw'
        AND t.type = 'debit'
        AND t.status = ANY($1)
    `;

    const [txns, countResult] = await Promise.all([
      db.query(query, [statusesToShow, parseInt(limit), offset]),
      db.query(countQuery, [statusesToShow]),
    ]);

    res.json({
      success: true,
      data: txns.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.rows[0]?.total || 0,
        pages:
          Math.ceil((countResult.rows[0]?.total || 0) / parseInt(limit)) || 1,
      },
      adminUserId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.approveWithdrawRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminRemark } = req.body;

    const txn = await db.query(
      `SELECT * FROM transactions WHERE id = $1 AND category = 'withdraw' AND type = 'debit'`,
      [id],
    );

    if (!txn.rows[0]) {
      return res
        .status(404)
        .json({ success: false, error: "Withdraw request not found" });
    }

    if (txn.rows[0].status !== "pending_approval") {
      return res.status(400).json({
        success: false,
        error: `Withdraw request not in pending_approval state (current: ${txn.rows[0].status})`,
      });
    }

    await db.query(
      `UPDATE transactions SET status = $1, remarks = $2 WHERE id = $3`,
      [
        "approved",
        adminRemark
          ? `${txn.rows[0].remarks || ""} | Admin Remark: ${adminRemark}`
          : txn.rows[0].remarks,
        id,
      ],
    );

    res.json({
      success: true,
      message: "Withdraw request approved",
      txnId: parseInt(id),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.paidWithdrawRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminRemark } = req.body;

    const txn = await db.query(
      `SELECT * FROM transactions WHERE id = $1 AND category = 'withdraw' AND type = 'debit'`,
      [id],
    );

    if (!txn.rows[0]) {
      return res
        .status(404)
        .json({ success: false, error: "Withdraw request not found" });
    }

    if (txn.rows[0].status !== "approved") {
      return res.status(400).json({
        success: false,
        error: `Withdraw request not in approved state (current: ${txn.rows[0].status})`,
      });
    }

    await db.query(
      `UPDATE transactions SET status = $1, remarks = $2 WHERE id = $3`,
      [
        "completed",
        adminRemark
          ? `${txn.rows[0].remarks || ""} | UTR: ${adminRemark}`
          : txn.rows[0].remarks,
        id,
      ],
    );

    res.json({
      success: true,
      message: "Withdraw request paid",
      txnId: parseInt(id),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.rejectWithdrawRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminRemark } = req.body;

    const txn = await db.query(
      `SELECT * FROM transactions WHERE id = $1 AND category = 'withdraw' AND type = 'debit'`,
      [id],
    );

    if (!txn.rows[0]) {
      return res
        .status(404)
        .json({ success: false, error: "Withdraw request not found" });
    }

    if (txn.rows[0].status !== "pending_approval") {
      return res.status(400).json({
        success: false,
        error: `Withdraw request not in pending_approval state (current: ${txn.rows[0].status})`,
      });
    }

    const { user_id: withdrawUserId, amount } = txn.rows[0];

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Reverse wallet deduction since withdraw() already deducted on submit.
      await client.query(
        "UPDATE wallets SET withdrawable_amount = withdrawable_amount + $1 WHERE user_id = $2",
        [amount, withdrawUserId],
      );

      await client.query(
        `UPDATE transactions SET status = $1, remarks = $2 WHERE id = $3`,
        [
          "rejected",
          adminRemark
            ? `${txn.rows[0].remarks || ""} | Admin Remark: ${adminRemark}`
            : txn.rows[0].remarks,
          id,
        ],
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: "Withdraw request rejected",
      txnId: parseInt(id),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// =============================
// Super Admin: List all transactions
// GET /api/transactions?page=1&limit=20&status=&type=&category=&userId=
// =============================
exports.listAllTransactionsForSuperAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, category, userId } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = [];
    const params = [];
    let pIndex = 1;

    if (status) {
      where.push(`t.status = $${pIndex}`);
      params.push(String(status));
      pIndex++;
    }
    if (type) {
      where.push(`t.type = $${pIndex}`);
      params.push(String(type));
      pIndex++;
    }
    if (category) {
      where.push(`t.category = $${pIndex}`);
      params.push(String(category));
      pIndex++;
    }
    if (userId) {
      where.push(`t.user_id = $${pIndex}`);
      params.push(parseInt(userId));
      pIndex++;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT
        t.id,
        t.user_id,
        u.username,
        u.full_name,
        t.amount,
        t.type,
        t.category,
        t.source_user_id,
        t.remarks,
        t.status,
        t.created_at,
         COALESCE(
            SUM(
              CASE
                WHEN (s.setting_value->>'uv_type') = 'percentage'
                  THEN (t.amount * (s.setting_value->>'uv_value')::numeric) / 100
                ELSE (t.amount / NULLIF((s.setting_value->>'uv_value')::numeric, 0))
              END
            ) ,
            0
          )::numeric(15,2) AS amount
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id::int
      CROSS JOIN app_settings s
      WHERE s.setting_key = 'point_system'
        ${whereSql ? whereSql.replace("WHERE ", "AND ") : ""}
      GROUP BY 
        t.id,
        u.username,
        u.full_name,
        s.setting_value
      ORDER BY t.created_at DESC
      LIMIT $${pIndex} OFFSET $${pIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM transactions t
      ${whereSql}
    `;

    const [txns, countResult] = await Promise.all([
      db.query(query, [...params, parseInt(limit), offset]),
      db.query(countQuery, params),
    ]);

    // NEW: When a user filter is applied, also return wallet + transaction statistics.
    if (userId) {
      const userIdInt = parseInt(userId);

      const walletQuery = `
        SELECT
          COALESCE(w.total_amount, 0)::numeric(15,2) AS total_amount,
          COALESCE(w.pending_amount, 0)::numeric(15,2) AS pending_amount,
          (COALESCE(w.total_amount, 0) + COALESCE(w.pending_amount, 0))::numeric(15,2) AS available_balance,

          -- UV conversion for wallet amounts (same logic as transactions)
          COALESCE(
            CASE
              WHEN (s.setting_value->>'uv_type') = 'percentage'
                THEN (COALESCE(w.total_amount, 0) * (s.setting_value->>'uv_value')::numeric) / 100
              ELSE (COALESCE(w.total_amount, 0) / NULLIF((s.setting_value->>'uv_value')::numeric, 0))
            END,
          0
          )::numeric(15,2) AS total_amount_uv,

          COALESCE(
            CASE
              WHEN (s.setting_value->>'uv_type') = 'percentage'
                THEN (COALESCE(w.pending_amount, 0) * (s.setting_value->>'uv_value')::numeric) / 100
              ELSE (COALESCE(w.pending_amount, 0) / NULLIF((s.setting_value->>'uv_value')::numeric, 0))
            END,
          0
          )::numeric(15,2) AS pending_amount_uv,

          COALESCE(
            CASE
              WHEN (s.setting_value->>'uv_type') = 'percentage'
                THEN ((COALESCE(w.total_amount, 0) + COALESCE(w.pending_amount, 0)) * (s.setting_value->>'uv_value')::numeric) / 100
              ELSE ((COALESCE(w.total_amount, 0) + COALESCE(w.pending_amount, 0)) / NULLIF((s.setting_value->>'uv_value')::numeric, 0))
            END,
          0
          )::numeric(15,2) AS available_balance_uv,

          COALESCE(
            CASE
              WHEN (s.setting_value->>'uv_type') = 'percentage'
                THEN ((COALESCE(w.company_fund, 0)) * (s.setting_value->>'uv_value')::numeric) / 100
              ELSE ((COALESCE(w.company_fund, 0)) / NULLIF((s.setting_value->>'uv_value')::numeric, 0))
            END,
          0
          )::numeric(15,2) AS company_fund_uv

        FROM wallets w
        CROSS JOIN app_settings s
        WHERE s.setting_key = 'point_system'
          AND w.user_id = $1
      `;

      // Transaction totals are computed only for the same filtered set.
      // If status/type/category filters are not provided, it naturally returns totals for all those transactions.
      const transactionTotalsQuery = `
        SELECT
          COUNT(*)::int AS total_transactions,

          -- Raw amount totals
          COALESCE(SUM(amount) FILTER (WHERE type = 'credit'), 0)::numeric(15,2) AS total_credits,
          COALESCE(SUM(amount) FILTER (WHERE type = 'debit'), 0)::numeric(15,2) AS total_debits,
          COALESCE(SUM(amount) FILTER (WHERE type = 'credit'), 0)
            - COALESCE(SUM(amount) FILTER (WHERE type = 'debit'), 0) AS net_amount,

          -- UV totals (depends on uv_type)
          COALESCE(
            SUM(
              CASE
                WHEN (s.setting_value->>'uv_type') = 'percentage'
                  THEN (amount * (s.setting_value->>'uv_value')::numeric) / 100
                ELSE (amount / NULLIF((s.setting_value->>'uv_value')::numeric, 0))
              END
            ) FILTER (WHERE type = 'credit'),
            0
          )::numeric(15,2) AS total_credits_uv,

          COALESCE(
            SUM(
              CASE
                WHEN (s.setting_value->>'uv_type') = 'percentage'
                  THEN (amount * (s.setting_value->>'uv_value')::numeric) / 100
                ELSE (amount / NULLIF((s.setting_value->>'uv_value')::numeric, 0))
              END
            ) FILTER (WHERE type = 'debit'),
            0
          )::numeric(15,2) AS total_debits_uv,

          COALESCE(
            SUM(
              CASE
                WHEN (s.setting_value->>'uv_type') = 'percentage'
                  THEN (amount * (s.setting_value->>'uv_value')::numeric) / 100
                ELSE (amount / NULLIF((s.setting_value->>'uv_value')::numeric, 0))
              END
            ) FILTER (WHERE type = 'credit'),
            0
          )::numeric(15,2)
          - COALESCE(
              SUM(
                CASE
                  WHEN (s.setting_value->>'uv_type') = 'percentage'
                    THEN (amount * (s.setting_value->>'uv_value')::numeric) / 100
                  ELSE (amount / NULLIF((s.setting_value->>'uv_value')::numeric, 0))
                END
              ) FILTER (WHERE type = 'debit'),
              0
            )::numeric(15,2) AS net_amount_uv
        FROM transactions t
        CROSS JOIN app_settings s
        WHERE s.setting_key = 'point_system'
        ${whereSql ? whereSql.replace("WHERE ", "AND ") : ""}
      `;

      const [walletRes, txnTotalsRes] = await Promise.all([
        db.query(walletQuery, [userIdInt]),
        db.query(transactionTotalsQuery, params),
      ]);

      const wallet = walletRes.rows[0] || {
        total_amount: 0,
        pending_amount: 0,
        available_balance: 0,
        total_amount_uv: 0,
        pending_amount_uv: 0,
        available_balance_uv: 0,
      };

      const txnTotals = txnTotalsRes.rows[0] || {
        total_transactions: 0,
        total_credits: 0,
        total_debits: 0,
        net_amount: 0,
        total_credits_uv: 0,
        total_debits_uv: 0,
        net_amount_uv: 0,
      };

      return res.json({
        success: true,
        data: txns.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.rows[0]?.total || 0,
          pages:
            Math.ceil((countResult.rows[0]?.total || 0) / parseInt(limit)) || 1,
        },
        wallet,
        transactionStats: txnTotals,
      });
    }

    res.json({
      success: true,
      data: txns.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.rows[0]?.total || 0,
        pages:
          Math.ceil((countResult.rows[0]?.total || 0) / parseInt(limit)) || 1,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.addTransaction = async (req, res) => {
  try {
    const {
      deduction_from, // wallet field to update: total_amount | pending_amount | company_fund
      amount,
      category,
      user_id,
      type = "credit", // credit | debit
      remarks,
      status,
    } = req.body;

    // -------- Validation --------
    if (user_id === undefined || user_id === null) {
      return res
        .status(400)
        .json({ success: false, error: "user_id is required" });
    }

    const userId = Number(user_id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: "user_id must be a valid positive number",
      });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        error: "amount must be a valid positive number",
      });
    }

    const allowedWalletFields = [
      "total_amount",
      "company_fund",
      "withdrawable_amount",
    ];
    if (!allowedWalletFields.includes(deduction_from)) {
      return res.status(400).json({
        success: false,
        error: `deduction_from must be one of: ${allowedWalletFields.join(
          ", ",
        )}`,
      });
    }

    const finalType = type ? String(type) : "credit";
    if (!["credit", "debit"].includes(finalType)) {
      return res.status(400).json({
        success: false,
        error: "type must be either 'credit' or 'debit'",
      });
    }

    const finalCategory = category ? String(category) : null;
    if (!finalCategory) {
      return res
        .status(400)
        .json({ success: false, error: "category is required" });
    }

    // status is optional in some flows; default to 'completed'
    const finalStatus = status ? String(status) : "completed";

    const field = String(deduction_from);
    // For this admin/manual endpoint, treat:
    // - type=credit => increase the given wallet field
    // - type=debit  => decrease the given wallet field
    const sign = finalType === "credit" ? 1 : -1;

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Lock wallet row (must include deduction_from column so currentVal is computed correctly)
      const walletRes = await client.query(
        `
          SELECT total_amount,
                 pending_amount,
                 company_fund,
                 withdrawable_amount
          FROM wallets
          WHERE user_id = $1
          FOR UPDATE
        `,
        [userId],
      );

      if (!walletRes.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Wallet not found for user",
        });
      }

      const currentVal = Number(walletRes.rows[0][field] ?? 0);
      const newVal = currentVal + sign * amountNum;

      if (finalType === "debit" && newVal < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: `Insufficient ${field} balance`,
        });
      }

      // Update the correct wallet column
      const query = `UPDATE wallets
         SET ${field} = ${field} + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`;
      console.log("query - ", query);

      const updateWallet = await client.query(query, [
        sign * amountNum,
        userId,
      ]);

      if (updateWallet.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Wallet not found for user",
        });
      }

      // Insert transaction record (using existing columns pattern from this controller)
      const txnInsert = await client.query(
        `
          INSERT INTO transactions (user_id, amount, type, category, remarks, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          userId,
          amountNum,
          finalType,
          finalCategory,
          remarks || null,
          finalStatus,
        ],
      );

      await client.query("COMMIT");

      // Return updated wallet snapshot
      const updatedWalletRes = await db.query(
        `SELECT total_amount, pending_amount, company_fund, withdrawable_amount FROM wallets WHERE user_id = $1`,
        [userId],
      );

      return res.json({
        success: true,
        message: "Transaction added and wallet updated",
        txnId: txnInsert.rows[0].id,
        wallet: updatedWalletRes.rows[0] || null,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.log("error - ", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
