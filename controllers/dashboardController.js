const db = require("../config/db");

// Helper to safely run a query and return default on error
const safeQuery = async (query, params = [], defaultValue = null) => {
  try {
    const result = await db.query(query, params);
    return { success: true, data: result.rows };
  } catch (error) {
    console.error("Dashboard query error:", error.message);
    return { success: false, error: error.message, data: defaultValue };
  }
};

// @desc    Get User/Distributor Dashboard Data
// @route   GET /api/dashboard/me
exports.getUserDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    // ─── 1. USER PROFILE ───
    const userProfile = await safeQuery(
      `
      SELECT 
        id, full_name, username, phone, email, 
        referral_code, binary_path, nlevel(binary_path) as level,
        is_active, kyc_status, created_at
      FROM users
      WHERE id = $1
      `,
      [userId],
      null,
    );

    // ─── 2. WALLET BALANCE ───
    const walletBalance = await safeQuery(
      `
      SELECT 
        COALESCE(total_amount, 0) as total_balance,
        COALESCE(pending_amount, 0) as pending_balance,
        (COALESCE(total_amount, 0) + COALESCE(total_amount, 0)) as available_balance
      FROM wallets
      WHERE user_id = $1
      `,
      [userId],
      {},
    );

    // ─── 3. PERSONAL ORDER STATISTICS ───
    const orderStats = await safeQuery(
      `
      SELECT
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as total_spent,
        COALESCE(AVG(total_amount), 0)::numeric(12,2) as avg_order_value,
        COUNT(*) FILTER (WHERE order_status = 'pending')::int as pending_orders,
        -- Delivered split: Distributor vs Ecom
        COUNT(*) FILTER (
          WHERE distributor_id IS NOT NULL AND order_status = 'delivered'
        )::int as distributor_delivered_orders,
        COUNT(*) FILTER (
          WHERE user_id IS NOT NULL AND order_status = 'delivered'
        )::int as ecom_delivered_orders,

        -- Global delivered count (kept for backward compatibility)
        -- Delivered split: Distributor vs Ecom
        COUNT(*) FILTER (
          WHERE distributor_id IS NOT NULL AND order_status = 'delivered'
        )::int as distributor_delivered_orders,
        COUNT(*) FILTER (
          WHERE user_id IS NOT NULL AND order_status = 'delivered'
        )::int as ecom_delivered_orders,

        -- Global delivered count (kept for backward compatibility)
        COUNT(*) FILTER (WHERE order_status = 'delivered')::int as delivered_orders,
        COUNT(*) FILTER (WHERE order_status = 'cancelled')::int as cancelled_orders,


        COUNT(*) FILTER (WHERE payment_status = 'paid')::int as paid_orders,
        COUNT(*) FILTER (WHERE payment_status = 'unpaid')::int as unpaid_orders
      FROM orders
      WHERE distributor_id = $1
      `,
      [userId],
      {},
    );

    // ─── 5. TRANSACTION STATISTICS ───
    const transactionStats = await safeQuery(
      `
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE (category = 'commission' OR category = 'commission_level') AND type = 'credit'), 0)::numeric(15,2) as total_commissions,
        COALESCE(SUM(amount) FILTER (WHERE category = 'withdraw' AND type = 'debit'), 0)::numeric(15,2) as total_withdrawals,
        COALESCE(SUM(amount) FILTER (WHERE category = 'purchase' AND type = 'debit'), 0)::numeric(15,2) as total_purchases,
        COALESCE(SUM(amount) FILTER (WHERE category = 'ref_bonus' AND type = 'credit'), 0)::numeric(15,2) as total_ref_bonuses,
        COUNT(*) FILTER (WHERE type = 'credit')::int as total_credits,
        COUNT(*) FILTER (WHERE type = 'debit')::int as total_debits
      FROM transactions
      WHERE user_id = $1
      `,
      [userId],
      {},
    );

    // ─── 6. TEAM / DOWNLINE MEMBERS ───
    // const teamStats = await safeQuery(
    //   `
    //   SELECT
    //     COUNT(*)::int as total_team_members,
    //     COUNT(*) FILTER (WHERE nlevel(binary_path) = 2)::int as direct_referrals,
    //     COUNT(*) FILTER (WHERE nlevel(binary_path) > 2)::int as downline_members
    //   FROM users
    //   WHERE binary_path @> (SELECT binary_path FROM users WHERE id = $1)
    //     AND id != $1
    //   `,
    //   [userId],
    //   {},
    // );

    const teamStats = await safeQuery(
      `
      WITH target_user AS (    
        SELECT node_path, nlevel(node_path) AS target_level 
        FROM users 
        WHERE id = 134
      )
      SELECT 
        COUNT(*)::int as total_team_members,
        COUNT(*) FILTER (WHERE nlevel(u.node_path) = t.target_level + 1)::int as direct_referrals,
        COUNT(*) FILTER (WHERE nlevel(u.node_path) > t.target_level + 1)::int as downline_members
      FROM users u
      CROSS JOIN target_user t
      WHERE u.node_path <@ t.node_path
        AND u.id != $1;
      `,
      [userId],
      {},
    );

    // ─── 7. RECENT ORDERS ───
    const recentOrders = await safeQuery(
      `
      SELECT 
        id, order_id, total_amount, order_status, payment_status, created_at
      FROM orders
      WHERE distributor_id = $1
      ORDER BY created_at DESC
      LIMIT 5
      `,
      [userId],
      [],
    );

    // ─── 8. RECENT TRANSACTIONS ───
    const recentTransactions = await safeQuery(
      `
      SELECT 
        id, amount, type, category, status, remarks, created_at
      FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
      `,
      [userId],
      [],
    );

    // ─── 9. CHART DATA - DAILY ORDERS (LAST 7 DAYS) ───
    const dailyOrders = await safeQuery(
      `
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::int as orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as spending
      FROM orders
      WHERE distributor_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      `,
      [userId],
      [],
    );

    // ─── 10. CHART DATA - DAILY TRANSACTIONS (LAST 7 DAYS) ───
    const dailyTransactions = await safeQuery(
      `
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(amount) FILTER (WHERE type = 'credit'), 0)::numeric(15,2) as credits,
        COALESCE(SUM(amount) FILTER (WHERE type = 'debit'), 0)::numeric(15,2) as debits
      FROM transactions
      WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      `,
      [userId],
      [],
    );

    // ─── COMBINE ALL DATA ───
    return res.json({
      success: true,
      data: {
        profile: userProfile.data?.[0] || {},
        wallet: walletBalance.data?.[0] || {},
        orders: orderStats.data?.[0] || {},
        transactions: transactionStats.data?.[0] || {},
        team: teamStats.data?.[0] || {},
        recent: {
          orders: recentOrders.data || [],
          transactions: recentTransactions.data || [],
        },
        charts: {
          daily_orders: dailyOrders.data || [],
          daily_transactions: dailyTransactions.data || [],
        },
      },
      message: "User dashboard data fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching user dashboard data:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get Ecom-user Dashboard Data (Total Orders, Open Tickets, Total Order Value)
// @route   GET /api/dashboard/ecom/me
exports.getEcomDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Total Orders + Total Order Value
    const orderAgg = await safeQuery(
      `
      SELECT
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as total_order_value
      FROM orders
      WHERE user_id = $1
      `,
      [userId],
      [{}],
    );

    console.log("user id - ", userId, orderAgg);
    // Open Tickets (not CLOSED/RESOLVED)
    const ticketAgg = await safeQuery(
      `
      SELECT
        COUNT(*)::int as open_tickets
      FROM tickets
      WHERE ecom_user_id = $1
        AND status NOT IN ('CLOSED', 'RESOLVED')
      `,
      [userId],
      [{}],
    );

    return res.json({
      success: true,
      data: {
        total_orders: orderAgg.data?.[0]?.total_orders ?? 0,
        open_tickets: ticketAgg.data?.[0]?.open_tickets ?? 0,
        total_order_value: Number(orderAgg.data?.[0]?.total_order_value ?? 0),
      },
      message: "Ecom dashboard data fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching ecom dashboard data:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get Admin Dashboard Data
// @route   GET /api/dashboard
exports.getDashboardData = async (req, res) => {
  try {
    // ─── 1. USER STATISTICS (Distributors vs Ecom Users) ───
    const userStats = await safeQuery(
      `
      WITH distributor_stats AS (
  SELECT
    COUNT(*)::int as total_distributors,
    COUNT(*) FILTER (WHERE is_active = true)::int as active_distributors,
    COUNT(*) FILTER (WHERE is_active = false)::int as inactive_distributors,
    COUNT(*) FILTER (WHERE kyc_status = true)::int as kyc_approved_distributors,
    COUNT(*) FILTER (WHERE kyc_status = false)::int as kyc_pending_distributors,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int as new_distributors_today,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE))::int as new_distributors_this_week,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE))::int as new_distributors_this_month
  FROM users WHERE role = 'Distributor' AND role_id IS null
),
ecom_stats AS (
  SELECT 
    COUNT(*)::int as total_ecom_users,
    COUNT(*) FILTER (WHERE status = 'true')::int as active_ecom_users,
    COUNT(*) FILTER (WHERE status = 'false')::int as inactive_ecom_users,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int as new_ecom_users_today,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE))::int as new_ecom_users_this_week,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE))::int as new_ecom_users_this_month
  FROM ecom_user
)
SELECT 
  d.*, 
  e.* FROM distributor_stats d
CROSS JOIN ecom_stats e;
      `,
      [],
      [{}],
    );

    // ─── 2. ORDER STATISTICS ───
    const orderStats = await safeQuery(
      `
      SELECT
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as total_revenue,
        COALESCE(AVG(total_amount), 0)::numeric(12,2) as avg_order_value,
        
        -- Distributor Orders Split
        COUNT(*) FILTER (WHERE distributor_id IS NOT NULL AND order_for LIKE 'admin-distributor')::int as total_distributor_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE distributor_id IS NOT NULL), 0)::numeric(12,2) as total_distributor_revenue,
        
        -- Ecom User Orders Split
        COUNT(*) FILTER (WHERE user_id IS NOT NULL)::int as total_ecom_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE user_id IS NOT NULL), 0)::numeric(12,2) as total_ecom_revenue,
        
        -- Shared Global Status Filters
        COUNT(*) FILTER (WHERE order_status = 'pending')::int as pending_orders,

        -- Pending split: Distributor vs Ecom
        COUNT(*) FILTER (
          WHERE distributor_id IS NOT NULL AND order_status = 'pending'
        )::int as pending_distributor_order,
        COUNT(*) FILTER (
          WHERE user_id IS NOT NULL AND order_status = 'pending'
        )::int as pending_ecom_order,


        -- Delivered split: Distributor vs Ecom
        COUNT(*) FILTER (
          WHERE distributor_id IS NOT NULL AND order_status = 'delivered'
        )::int as distributor_delivered_orders,
        COUNT(*) FILTER (
          WHERE user_id IS NOT NULL AND order_status = 'delivered'
        )::int as ecom_delivered_orders,

        COUNT(*) FILTER (WHERE order_status = 'delivered')::int as delivered_orders,
        COUNT(*) FILTER (WHERE order_status = 'cancelled')::int as cancelled_orders,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::int as paid_orders,
        COUNT(*) FILTER (WHERE payment_status = 'unpaid')::int as unpaid_orders
      FROM orders
      `,
      [],
      [{}],
    );

    // ─── 3. PACKAGE PURCHASE STATISTICS ───
    const packageStats = await safeQuery(
      `
      SELECT
        COUNT(*)::int as total_package_purchases,
        COALESCE(SUM(amount), 0)::numeric(12,2) as total_package_revenue
      FROM user_packages
      WHERE status = 'activated'
      `,
      [],
      [{}],
    );

    // ─── 4. KYC REQUEST STATISTICS ───
    const kycStats = await safeQuery(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending_kyc,
        COUNT(*) FILTER (WHERE status = 'under_review')::int as under_review_kyc,
        COUNT(*) FILTER (WHERE status = 'approved')::int as approved_kyc,
        COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected_kyc
      FROM kyc_requests
      `,
      [],
      [{}],
    );

    // ─── 5. WALLET & TRANSACTION STATISTICS ───
    const walletStats = await safeQuery(
      `
      SELECT
        COALESCE(SUM(total_amount), 0)::numeric(15,2) as total_wallet_balance,
        COALESCE(SUM(pending_amount), 0)::numeric(15,2) as total_pending_amount
      FROM wallets
      `,
      [],
      [{}],
    );

    const transactionStats = await safeQuery(
      `
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE category = 'commission' AND type = 'credit'), 0)::numeric(15,2) as total_commissions,
        COALESCE(SUM(amount) FILTER (WHERE category = 'withdraw' AND type = 'debit'), 0)::numeric(15,2) as total_withdrawals,
        COALESCE(SUM(amount) FILTER (WHERE category = 'purchase' AND type = 'debit'), 0)::numeric(15,2) as total_purchases,
        COALESCE(SUM(amount) FILTER (WHERE category = 'ref_bonus' AND type = 'credit'), 0)::numeric(15,2) as total_ref_bonuses
      FROM transactions
      `,
      [],
      [{}],
    );

    // ─── 6. PRODUCT STATISTICS ───
    const productStats = await safeQuery(
      `
      SELECT
        (SELECT COUNT(*)::int FROM products) as total_products,
        (SELECT COUNT(*)::int FROM pro_variants) as total_variants,
        (SELECT COUNT(*)::int FROM pro_variants WHERE stock <= 10) as low_stock_variants
      `,
      [],
      [{}],
    );

    // ─── 7. RECENT ACTIVITY ───
    const recentOrders = await safeQuery(
      `
      SELECT
        o.id,
        o.order_id,
        o.total_amount,
        o.order_status,
        o.payment_status,
        o.created_at,
        COALESCE(eu.name, d.full_name, d.username) as customer_name,
        COALESCE(eu.phone, d.phone) as customer_phone,
        CASE 
          WHEN o.user_id IS NOT NULL THEN 'ecom_user'
          ELSE 'distributor'
        END as customer_type
      FROM orders o
      LEFT JOIN ecom_user eu ON o.user_id = eu.id
      LEFT JOIN users d ON o.distributor_id = d.id
      ORDER BY o.created_at DESC
      LIMIT 5
      `,
      [],
      [],
    );

    const recentDistributors = await safeQuery(
      `
      SELECT id, full_name, username, phone, email, referral_code, is_active, kyc_status, created_at 
      FROM users ORDER BY created_at DESC LIMIT 5
      `,
      [],
      [],
    );

    const recentEcomUsers = await safeQuery(
      `
      SELECT id, name, phone, email, status, created_at 
      FROM ecom_user ORDER BY created_at DESC LIMIT 5
      `,
      [],
      [],
    );

    const recentTransactions = await safeQuery(
      `
      SELECT
        t.id, t.amount, t.type, t.category, t.status, t.created_at,
        COALESCE(u.full_name, eu.name) as user_name,
        COALESCE(u.phone, eu.phone) as user_phone
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN ecom_user eu ON t.user_id = eu.id
      ORDER BY t.created_at DESC
      LIMIT 5
      `,
      [],
      [],
    );

    // ─── 8. CHART DATA ───
    const chartSales = await safeQuery(
      `
      SELECT
        DATE(created_at) as date,
        COUNT(*)::int as total_orders,
        COUNT(*) FILTER (WHERE distributor_id IS NOT NULL)::int as distributor_orders,
        COUNT(*) FILTER (WHERE user_id IS NOT NULL)::int as ecom_orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as total_revenue,
        COALESCE(SUM(total_amount) FILTER (WHERE distributor_id IS NOT NULL), 0)::numeric(12,2) as distributor_revenue,
        COALESCE(SUM(total_amount) FILTER (WHERE user_id IS NOT NULL), 0)::numeric(12,2) as ecom_revenue
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      `,
      [],
      [],
    );

    const chartRegistrations = await safeQuery(
      `
      SELECT
        d.date,
        COALESCE(u.new_distributors, 0)::int as new_distributors,
        COALESCE(e.new_ecom_users, 0)::int as new_ecom_users
      FROM (
        SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval)::date as date
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) as date, COUNT(*)::int as new_distributors FROM users GROUP BY DATE(created_at)
      ) u ON d.date = u.date
      LEFT JOIN (
        SELECT DATE(created_at) as date, COUNT(*)::int as new_ecom_users FROM ecom_user GROUP BY DATE(created_at)
      ) e ON d.date = e.date
      ORDER BY d.date ASC
      `,
      [],
      [],
    );

    const dailyPackages = await safeQuery(
      `
      SELECT
        DATE(activated_at) as date,
        COUNT(*)::int as purchases,
        COALESCE(SUM(amount), 0)::numeric(12,2) as revenue
      FROM user_packages
      WHERE status = 'activated'
        AND activated_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY DATE(activated_at)
      ORDER BY date ASC
      `,
      [],
      [],
    );

    // ─── 9. NOTIFICATION COUNT ───
    const notificationCount = await safeQuery(
      `SELECT COUNT(*)::int as total_notifications FROM notifications`,
      [],
      [{}],
    );

    // ─── COMBINE ALL DATA INTO FLAT DICTIONARY ───
    return res.json({
      success: true,
      data: {
        // Safe structural assignments map direct to response objects
        users: userStats.data?.[0] || {
          total_distributors: 0,
          active_distributors: 0,
          inactive_distributors: 0,
          kyc_approved_distributors: 0,
          kyc_pending_distributors: 0,
          new_distributors_today: 0,
          new_distributors_this_week: 0,
          new_distributors_this_month: 0,
          total_ecom_users: 0,
          active_ecom_users: 0,
          inactive_ecom_users: 0,
          new_ecom_users_today: 0,
          new_ecom_users_this_week: 0,
          new_ecom_users_this_month: 0,
        },
        orders: orderStats.data?.[0] || {},
        packages: packageStats.data?.[0] || {},
        kyc: kycStats.data?.[0] || {},
        wallet: walletStats.data?.[0] || {},
        transactions: transactionStats.data?.[0] || {},
        products: productStats.data?.[0] || {},
        notifications: notificationCount.data?.[0] || {},
        recent: {
          orders: recentOrders.data || [],
          distributors: recentDistributors.data || [],
          ecom_users: recentEcomUsers.data || [],
          transactions: recentTransactions.data || [],
        },
        charts: {
          sales_breakdown: chartSales.data || [],
          registrations_breakdown: chartRegistrations.data || [],
          daily_packages: dailyPackages.data || [],
        },
      },
      message: "Dashboard data fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get Analytics Data (Total Referrals, Active Downline, Commissions, Conversion Rate)
// @route   GET /api/dashboard/analytics
// @desc    Get Admin Dashboard Data (Split v2)
// @route   GET /api/dashboard/v2
exports.getDashboardDataV2 = async (req, res) => {
  try {
    // ─── 1) DISTRIBUTOR (USERS TABLE) METRICS ───
    const distributorUserStats = await safeQuery(
      `
      SELECT
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE is_active = true)::int as active_users,
        COUNT(*) FILTER (WHERE is_active = false)::int as inactive_users,
        COUNT(*) FILTER (WHERE kyc_status = true)::int as kyc_approved_users,
        COUNT(*) FILTER (WHERE kyc_status = false)::int as kyc_pending_users
      FROM users
      `,
      [],
      [{}],
    );

    const distributorOrderStats = await safeQuery(
      `
      SELECT
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as total_revenue,
        COALESCE(AVG(total_amount), 0)::numeric(12,2) as avg_order_value
      FROM orders
      WHERE distributor_id IS NOT NULL
      `,
      [],
      [{}],
    );

    const distributorWalletStats = await safeQuery(
      `
      SELECT
        COALESCE(SUM(total_amount), 0)::numeric(15,2) as total_wallet_balance,
        COALESCE(SUM(pending_amount), 0)::numeric(15,2) as total_pending_amount
      FROM wallets
      `,
      [],
      [{}],
    );

    // ─── 2) ECOM USER (ECOM_USER TABLE) METRICS ───
    // Fixed key names inside SQL to match the expected standard user structure
    const ecomUserStats = await safeQuery(
      `
      SELECT
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE status = 'active')::int as active_users,
        COUNT(*) FILTER (WHERE status <> 'active' OR status IS NULL)::int as inactive_users
      FROM ecom_user
      `,
      [],
      [{}],
    );

    const ecomOrderStats = await safeQuery(
      `
      SELECT
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric(12,2) as total_revenue,
        COALESCE(AVG(total_amount), 0)::numeric(12,2) as avg_order_value
      FROM orders
      WHERE user_id IS NOT NULL
      `,
      [],
      [{}],
    );

    // Filters transactions linked to direct consumer checkout
    const ecomTransactionStats = await safeQuery(
      `
      SELECT
        COALESCE(SUM(amount), 0)::numeric(15,2) as total_transaction_amount,
        COUNT(*)::int as total_transactions
      FROM transactions
      WHERE user_id IS NOT NULL
      `,
      [],
      [{}],
    );

    // ─── 3) SHARED GLOBAL INVENTORY STATS ───
    const productStats = await safeQuery(
      `
      SELECT
        (SELECT COUNT(*)::int FROM products) as total_products,
        (SELECT COUNT(*)::int FROM pro_variants) as total_variants,
        (SELECT COUNT(*)::int FROM pro_variants WHERE stock <= 10) as low_stock_variants
      `,
      [],
      [{}],
    );

    const notificationCount = await safeQuery(
      `SELECT COUNT(*)::int as total_notifications FROM notifications`,
      [],
      [{}],
    );

    // ─── 4) RESPONSE BUILDER ───
    return res.json({
      success: true,
      data: {
        distributor: {
          users: distributorUserStats.data?.[0] || {
            total_users: 0,
            active_users: 0,
            inactive_users: 0,
            kyc_approved_users: 0,
            kyc_pending_users: 0,
          },
          orders: distributorOrderStats.data?.[0] || {
            total_orders: 0,
            total_revenue: "0.00",
            avg_order_value: "0.00",
          },
          wallet: distributorWalletStats.data?.[0] || {
            total_wallet_balance: "0.00",
            total_pending_amount: "0.00",
          },
        },
        ecom_user: {
          users: ecomUserStats.data?.[0] || {
            total_users: 0,
            active_users: 0,
            inactive_users: 0,
          },
          orders: ecomOrderStats.data?.[0] || {
            total_orders: 0,
            total_revenue: "0.00",
            avg_order_value: "0.00",
          },
          transactions: ecomTransactionStats.data?.[0] || {
            total_transaction_amount: "0.00",
            total_transactions: 0,
          },
        },
        products: productStats.data?.[0] || {
          total_products: 0,
          total_variants: 0,
          low_stock_variants: 0,
        },
        notifications: notificationCount.data?.[0] || {
          total_notifications: 0,
        },
      },
      message: "Dashboard v2 data fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching dashboard v2 data:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const id = req.user.id;

    const query = `
      SELECT
        -- 1. Referral Stats
        (SELECT COUNT(*) FROM users WHERE node_path ~ $1 AND id != $2)::int as total_referrals,
        (SELECT COUNT(*) FROM users WHERE node_path ~ $1 AND is_active = true AND id != $2)::int as active_downline,

        -- 2. Pending Commission Stats
        (
          SELECT COALESCE(SUM(amount), 0)::numeric(12,2)
          FROM transactions
          WHERE user_id = $2 
            AND category = 'commission' 
            AND type = 'credit' 
            AND status = 'pending'
        ) as pending_commissions,

        -- 3. Conversion Rate Logic
        (
          SELECT 
            CASE 
              WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE is_active = true) * 100.0 / COUNT(*)), 1)::text || '%'
              ELSE '0%' 
            END
          FROM users WHERE node_path ~ $1 AND id != $2
        ) as conversion_rate;
    `;

    // Using node_path logic from your MLM structure
    const analyticsResult = await safeQuery(query, [id.toString(), id], [{}]);
    const data = analyticsResult.data?.[0] || {
      total_referrals: 0,
      active_downline: 0,
      pending_commissions: 0,
      conversion_rate: "0%",
    };

    return res.json({
      success: true,
      data: {
        total_referrals: parseInt(data.total_referrals),
        active_downline: parseInt(data.active_downline),
        pending_commissions: parseFloat(data.pending_commissions),
        conversion_rate: data.conversion_rate,
      },
      message: "Analytics data fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      data: {
        total_referrals: 0,
        active_downline: 0,
        pending_commissions: 0,
        conversion_rate: "0%",
      },
    });
  }
};
