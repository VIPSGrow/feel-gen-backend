const db = require("../config/db");

// Fallback defaults (dynamic for future config)
const DEFAULTS = {
  l1_commission_pct: 20,
  l2_commission_pct: 12,
  tds_pct: 5,
};

async function getPercentFromLevelCommissions(level_no) {
  // Uses dynamic commission config from mlm_generation_commissions table
  const result = await db.query(
    `SELECT gc.commission_percent AS commission_percentage
     FROM mlm_generation_commissions gc
     WHERE gc.plan_settings_id = (
       SELECT id FROM mlm_plan_settings
       WHERE is_active = TRUE ORDER BY effective_from DESC LIMIT 1
     ) AND gc.is_active = TRUE AND gc.level_no = $1
     LIMIT 1`,
    [level_no],
  );
  const pct = Number(result.rows?.[0]?.commission_percentage);
  return Number.isFinite(pct) ? pct : undefined;
}

async function getTdsPctFromSettings() {
  // If you store TDS in app_settings, set setting_key like: tds_pct
  const result = await db.query(
    "SELECT setting_value FROM app_settings WHERE setting_key = $1 LIMIT 1",
    ["tds_pct"],
  );
  const val = Number(result.rows?.[0]?.setting_value);
  return Number.isFinite(val) ? val : undefined;
}

function toNumber(value) {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function validateNonNegativeNumber(field, value) {
  const n = toNumber(value);
  if (n === undefined) {
    return `${field} must be a number`;
  }
  if (n < 0) {
    return `${field} must be >= 0`;
  }
  return null;
}

exports.simulateIncome = async (req, res) => {
  try {
    const {
      personal_sales,
      direct_team_count,
      avg_l2_sales,
      l2_team_size_per_direct,

      // optional dynamic percentages
      l1_commission_pct = DEFAULTS.l1_commission_pct,
      l2_commission_pct = DEFAULTS.l2_commission_pct,
      tds_pct = DEFAULTS.tds_pct,
    } = req.body || {};

    const fields = [
      ["personal_sales", personal_sales],
      ["direct_team_count", direct_team_count],
      ["avg_l2_sales", avg_l2_sales],
      ["l2_team_size_per_direct", l2_team_size_per_direct],
      ["l1_commission_pct", l1_commission_pct],
      ["l2_commission_pct", l2_commission_pct],
      ["tds_pct", tds_pct],
    ];

    for (const [name, val] of fields) {
      const err = validateNonNegativeNumber(name, val);
      if (err) {
        return res.status(400).json({ success: false, message: err });
      }
    }

    const personalSales = Number(personal_sales);
    const directTeamCount = Number(direct_team_count);
    const avgL2Sales = Number(avg_l2_sales);
    const l2TeamSizePerDirect = Number(l2_team_size_per_direct);

    // Commission/TDS percentages (priority: request body -> DB -> fallback defaults)
    let l1CommissionPct = toNumber(l1_commission_pct);
    let l2CommissionPct = toNumber(l2_commission_pct);
    let tdsPct = toNumber(tds_pct);

    if (l1CommissionPct === undefined) {
      // level_no: 0 assumed for L1 in existing code
      l1CommissionPct = await getPercentFromLevelCommissions(0);
    }

    if (l2CommissionPct === undefined) {
      // level_no: 1 assumed for L2 in existing code
      l2CommissionPct = await getPercentFromLevelCommissions(1);
    }

    if (tdsPct === undefined) {
      tdsPct = await getTdsPctFromSettings();
    }

    if (l1CommissionPct === undefined)
      l1CommissionPct = DEFAULTS.l1_commission_pct;
    if (l2CommissionPct === undefined)
      l2CommissionPct = DEFAULTS.l2_commission_pct;
    if (tdsPct === undefined) tdsPct = DEFAULTS.tds_pct;

    // L1 Commission: 20% of personal_sales.
    const l1Commission = (personalSales * l1CommissionPct) / 100;

    // Direct Team (L1) sales: direct_team_count * avg_monthly_sales_per_L1 (assume avg_l2_sales)
    const directTeamSales = directTeamCount * avgL2Sales;
    const directTeamCommission = (directTeamSales * l1CommissionPct) / 100;

    // L2 Team Sales: (direct_team_count * l2_team_size_per_direct) * avg_l2_sales
    const l2TeamSales = directTeamCount * l2TeamSizePerDirect * avgL2Sales;
    const l2Commission = (l2TeamSales * l2CommissionPct) / 100;

    const monthly_gross = l1Commission + directTeamCommission + l2Commission;
    const tds_amount = (monthly_gross * tdsPct) / 100;
    const monthly_net = monthly_gross - tds_amount;
    const annual_net = monthly_net * 12;

    return res.status(200).json({
      success: true,
      data: {
        monthly_gross,
        monthly_net,
        annual_net,
        tds_amount,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
