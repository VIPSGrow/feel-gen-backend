const db = require("../config/db");

exports.getKycRequests = async (req, res) => {
  try {
    // console.log("fetching start");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;
    // WHERE kr.status IN ('pending', 'under_review')
    const requests = await db.query(
      `
      SELECT 
        kr.id, kr.user_id, kr.status, kr.created_at,
        u.full_name, u.username, u.email, u.phone, u.kyc_status,
        COUNT(kd.id) FILTER (WHERE kd.status = 'under_review') as pending_docs,
        COUNT(kd.id) FILTER (WHERE kd.status = 'approved') as approved_docs
      FROM kyc_requests kr
      JOIN users u ON kr.user_id = u.id
      LEFT JOIN kyc_documents kd ON kr.user_id = kd.user_id
      WHERE (u.full_name ILIKE '%' || $3 || '%' OR u.phone ILIKE '%' || $3 || '%')
      
      GROUP BY kr.id, u.id
      ORDER BY 
      -- 1. Custom Priority (Weighting)
      CASE 
          WHEN kr.status = 'under_review' THEN 1
          WHEN kr.status = 'pending' THEN 2
          WHEN kr.status = 'approved' THEN 3
          ELSE 4 
      END ASC,
      -- 2. Newest requests first within those groups
      kr.created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset, search],
    );

    const total = await db.query(
      `
      SELECT COUNT(*) 
      FROM kyc_requests kr
      JOIN users u ON kr.user_id = u.id
      WHERE (u.full_name ILIKE '%' || $1 || '%' OR u.phone ILIKE '%' || $1 || '%')
    `,
      [search],
    );

    // Get documents for each request
    const requestIds = requests.rows.map((r) => r.id);
    const docs = await db.query(
      `
      SELECT kr.user_id, kd.document_type, kd.file_url, kd.status, kd.id as doc_id
      FROM kyc_requests kr
      JOIN kyc_documents kd ON kr.user_id = kd.user_id
      WHERE kr.id = ANY($1::int[])
    `,
      [requestIds],
    );

    const requestsWithDocs = requests.rows.map((req) => ({
      ...req,
      documents: docs.rows.filter((d) => d.user_id === req.user_id),
    }));

    res.json({
      status: true,
      data: requestsWithDocs,
      pagination: {
        page,
        limit,
        total: parseInt(total.rows[0].count),
        pages: Math.ceil(parseInt(total.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  }
};

exports.updateKycRequest = async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const { status, remark } = req.body; // status: 'approved' | 'rejected'

    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ status: false, error: "Status must be approved or rejected" });
    }

    const request = await client.query(
      "SELECT user_id FROM kyc_requests WHERE id = $1",
      [id],
    );
    if (request.rows.length === 0) {
      return res
        .status(404)
        .json({ status: false, error: "KYC request not found" });
    }
    const userId = request.rows[0].user_id;

    await client.query("BEGIN");
    try {
      await client.query(
        "UPDATE kyc_requests SET status = $1, rejection_remark = $2 WHERE id = $3",
        [status, remark || null, id],
      );

      const userStatus = status === "approved";

      await client.query("UPDATE users SET kyc_status = $1 WHERE id = $2", [
        userStatus,
        userId,
      ]);

      await client.query(
        `INSERT INTO wallets
          (user_id, total_amount, pending_amount, left_count, right_count, paid_pairs, company_fund, withdrawable_amount)
         VALUES ($1, 0, 0, 0, 0, 0, 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );

      await client.query("COMMIT");

      res.json({
        status: true,
        message: `KYC request ${status} successfully`,
        request_id: id,
        user_id: userId,
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: "Server error" });
  } finally {
    client.release();
  }
};
