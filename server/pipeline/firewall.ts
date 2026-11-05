import { CleanedCustomer, LeakageAuditResult } from '../../shared/types.js';

// Explicitly forbidden columns and outcome concepts
export const FORBIDDEN_FIELDS = [
  'churn_status',
  'churnstatus',
  'churn_date',
  'churndate',
  'churn_reason',
  'churnreason',
  'churn_flag',
  'churnflag',
  'monthly_revenue_at_risk_gbp',
  'monthlyrevenueatrisk',
  'customer_id',
  'customerid',
] as const;

// Quarantined fields (off by default, used only in ablation audit)
export const QUARANTINED_FIELDS = [
  'lifetime_revenue_gbp',
  'tenure_months',
  'days_to_contract_end',
  'days_since_join',
] as const;

// Excluded by policy (UK Equality Act and UK GDPR fairness)
export const POLICY_EXCLUDED_FIELDS = [
  'gender',
  'age',
  'age_band',
] as const;

export interface TrainingFoldStats {
  planMedianCharges: Record<string, number>;
  highValueThreshold: number; // 75th percentile of monthlyCharge
  numericMedians: Record<string, number>;
  categoricalModes: Record<string, string>;
  p1Scales: Record<string, number>; // 1st percentile
  p99Scales: Record<string, number>; // 99th percentile
  means: Record<string, number>;
  stds: Record<string, number>;
}

export const ALLOWLISTED_FEATURE_NAMES = [
  'contract_term_months',
  'is_rolling',
  'auto_renew',
  'is_bundle',
  'service_is_mobile',
  'service_is_fibre',
  'service_is_home_broadband',
  'charge_per_gb',
  'data_utilisation',
  'overage_flag',
  'overage_amount',
  'discount_flag',
  'discount_depth',
  'price_vs_plan_median',
  'payment_risk',
  'direct_debit',
  'tickets_per_window',
  'complaint_rate',
  'complaint_to_ticket_ratio',
  'resolution_time_band',
  'outage_x_ticket',
  'low_satisfaction_flag',
  'nps_index',
  'competitor_offer_flag',
  'segment_consumer',
  'segment_sme',
  'segment_enterprise',
  'channel_retail',
  'channel_referral',
  'channel_telesales',
  'channel_online',
  'nation_england',
  'nation_scotland',
  'nation_wales',
  'nation_ni',
  'high_value_flag',
  'premium_bundle_flag',
] as const;

export type AllowlistedFeature = typeof ALLOWLISTED_FEATURE_NAMES[number];

export const FEATURE_LABELS: Record<string, string> = {
  contract_term_months: 'Contract Commitment (Months)',
  is_rolling: 'Rolling Monthly Contract',
  auto_renew: 'Auto-Renew Active',
  is_bundle: 'Bundle Product Holder',
  service_is_mobile: 'Mobile Service Only',
  service_is_fibre: 'Fibre Broadband Service',
  service_is_home_broadband: 'Standard Broadband Service',
  charge_per_gb: 'Charge per Gigabyte (£/GB)',
  data_utilisation: 'Data Utilisation Ratio',
  overage_flag: 'Data Overage Incurred',
  overage_amount: 'Overage Charges (£)',
  discount_flag: 'Active Discount Applied',
  discount_depth: 'Discount Level (%)',
  price_vs_plan_median: 'Price Premium vs Plan Median (£)',
  payment_risk: 'Payment Issues (Late + Failed)',
  direct_debit: 'Direct Debit Active',
  tickets_per_window: 'Support Tickets (12M)',
  complaint_rate: 'Official Complaints (12M)',
  complaint_to_ticket_ratio: 'Complaints to Tickets Ratio',
  resolution_time_band: 'Resolution Time Band (Hours)',
  outage_x_ticket: 'Outage & Support Interaction',
  low_satisfaction_flag: 'Low CSAT Flag (≤5)',
  nps_index: 'Net Promoter Index (-100 to 100)',
  competitor_offer_flag: 'Competitor Offer Received',
  segment_consumer: 'Segment: Consumer',
  segment_sme: 'Segment: Small Business',
  segment_enterprise: 'Segment: Enterprise',
  channel_retail: 'Acquisition: Retail Store',
  channel_referral: 'Acquisition: Referral',
  channel_telesales: 'Acquisition: Telesales',
  channel_online: 'Acquisition: Online',
  nation_england: 'UK Nation: England',
  nation_scotland: 'UK Nation: Scotland',
  nation_wales: 'UK Nation: Wales',
  nation_ni: 'UK Nation: Northern Ireland',
  high_value_flag: 'High-Value Customer Tier',
  premium_bundle_flag: 'Premium Bundle Flag',
  // Quarantined (for ablation display)
  lifetime_revenue_gbp: 'Lifetime Revenue (£) [QUARANTINED]',
  tenure_months: 'Tenure Length (Months) [QUARANTINED]',
};

// Calculates percentiles from an array of numbers
function getPercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// Fit fold statistics strictly on the training partition
export function fitFoldStats(trainRows: CleanedCustomer[]): TrainingFoldStats {
  const planCharges: Record<string, number[]> = {};
  const monthlyCharges: number[] = [];

  for (const row of trainRows) {
    if (!planCharges[row.planName]) {
      planCharges[row.planName] = [];
    }
    planCharges[row.planName].push(row.monthlyChargeGbp);
    monthlyCharges.push(row.monthlyChargeGbp);
  }

  const planMedianCharges: Record<string, number> = {};
  for (const [plan, charges] of Object.entries(planCharges)) {
    planMedianCharges[plan] = getPercentile(charges, 50);
  }

  const highValueThreshold = getPercentile(monthlyCharges, 75);

  return {
    planMedianCharges,
    highValueThreshold,
    numericMedians: {},
    categoricalModes: {},
    p1Scales: {},
    p99Scales: {},
    means: {},
    stds: {},
  };
}

// Transform a customer into allowlisted engineered feature vector
export function engineerCustomerFeatures(
  customer: CleanedCustomer,
  foldStats: TrainingFoldStats,
  includeQuarantined = false
): Record<string, number> {
  const f: Record<string, number> = {};

  // Contract term
  f.contract_term_months = customer.contractType === 'Rolling Monthly' ? 0 : customer.contractType === '24 Months' ? 24 : 12;
  f.is_rolling = customer.contractType === 'Rolling Monthly' ? 1 : 0;
  f.auto_renew = customer.autoRenew ? 1 : 0;

  // Products
  f.is_bundle = customer.serviceType === 'Mobile + Broadband Bundle' ? 1 : 0;
  f.service_is_mobile = customer.serviceType === 'Mobile' ? 1 : 0;
  f.service_is_fibre = customer.serviceType === 'Fibre Broadband' ? 1 : 0;
  f.service_is_home_broadband = customer.serviceType === 'Home Broadband' ? 1 : 0;

  // Usage & Allowance (sentinel safe)
  if (customer.isUnlimitedData || !customer.hasDataAllowance) {
    f.charge_per_gb = 0; // Guarded for unlimited or broadband
    f.data_utilisation = 0.5; // Benchmark neutral
  } else {
    const allowance = Math.max(1, customer.dataAllowanceGb);
    f.charge_per_gb = Number((customer.monthlyChargeGbp / allowance).toFixed(3));
    f.data_utilisation = Number(Math.min(2.5, customer.averageMonthlyUsageGb / allowance).toFixed(3));
  }

  f.overage_flag = customer.overageChargesGbp > 0 ? 1 : 0;
  f.overage_amount = customer.overageChargesGbp;
  f.discount_flag = customer.discountPercent > 0 ? 1 : 0;
  f.discount_depth = customer.discountPercent;

  // Price vs plan median (in-fold statistic)
  const medianPlanPrice = foldStats.planMedianCharges[customer.planName] ?? 35;
  f.price_vs_plan_median = Number((customer.monthlyChargeGbp - medianPlanPrice).toFixed(2));

  // Payment risk
  f.payment_risk = customer.latePayments12M + customer.failedPayments12M;
  f.direct_debit = customer.directDebit ? 1 : 0;

  // Service experience
  f.tickets_per_window = customer.supportTickets12M;
  f.complaint_rate = customer.complaints12M;
  f.complaint_to_ticket_ratio = Number((customer.complaints12M / (customer.supportTickets12M + 1)).toFixed(3));
  f.resolution_time_band = customer.averageResolutionHours > 24 ? 2 : customer.averageResolutionHours > 10 ? 1 : 0;
  f.outage_x_ticket = customer.networkOutages12M * customer.supportTickets12M;
  f.low_satisfaction_flag = customer.satisfactionScore <= 5 ? 1 : 0;
  f.nps_index = customer.npsScore; // Continuous -100 to 100
  f.competitor_offer_flag = customer.competitorOfferReceived ? 1 : 0;

  // Segment
  f.segment_consumer = customer.customerSegment === 'Consumer' ? 1 : 0;
  f.segment_sme = customer.customerSegment === 'Small Business' ? 1 : 0;
  f.segment_enterprise = customer.customerSegment === 'Enterprise' ? 1 : 0;

  // Channel
  const ch = customer.acquisitionChannel.toLowerCase();
  f.channel_retail = ch.includes('retail') || ch.includes('store') ? 1 : 0;
  f.channel_referral = ch.includes('referral') ? 1 : 0;
  f.channel_telesales = ch.includes('telesales') ? 1 : 0;
  f.channel_online = ch.includes('online') || ch.includes('web') ? 1 : 0;

  // UK Nation
  f.nation_england = customer.ukNation === 'England' ? 1 : 0;
  f.nation_scotland = customer.ukNation === 'Scotland' ? 1 : 0;
  f.nation_wales = customer.ukNation === 'Wales' ? 1 : 0;
  f.nation_ni = customer.ukNation === 'Northern Ireland' ? 1 : 0;

  // Commercial tier
  f.high_value_flag = customer.monthlyChargeGbp >= foldStats.highValueThreshold ? 1 : 0;
  f.premium_bundle_flag = (f.is_bundle === 1 && customer.monthlyChargeGbp > 50) ? 1 : 0;

  if (includeQuarantined) {
    f.lifetime_revenue_gbp = customer.lifetimeRevenueGbp;
    f.tenure_months = customer.tenureMonths;
  }

  return f;
}

// Leakage Firewall Validator & Automated Audit
export function validateFeatureMatrix(
  featureNames: string[],
  rows: Array<Record<string, number>>,
  labels: number[]
): LeakageAuditResult {
  const forbiddenFound: string[] = [];
  const quarantinedFound: string[] = [];

  for (const name of featureNames) {
    const norm = name.toLowerCase().replace(/[\s_\-]/g, '');
    for (const forbidden of FORBIDDEN_FIELDS) {
      if (norm === forbidden.replace(/[\s_\-]/g, '')) {
        forbiddenFound.push(name);
      }
    }
    for (const q of QUARANTINED_FIELDS) {
      if (norm === q.replace(/[\s_\-]/g, '')) {
        quarantinedFound.push(name);
      }
    }
    for (const p of POLICY_EXCLUDED_FIELDS) {
      if (norm === p.replace(/[\s_\-]/g, '')) {
        forbiddenFound.push(`${name} (Policy Excluded: protected demographic)`);
      }
    }
  }

  if (forbiddenFound.length > 0) {
    throw new Error(
      `LEAKAGE FIREWALL REJECTION: Model matrix contains forbidden outcome or policy fields: ${forbiddenFound.join(', ')}`
    );
  }

  // Single-feature ROC-AUC check to catch accidental leaks (flag > 0.80)
  const candidateAuctions: Array<{ feature: string; auc: number; flagged: boolean }> = [];
  for (const name of featureNames) {
    const vals = rows.map((r) => r[name]);
    const auc = calculateFastRocAuc(vals, labels);
    const flagged = auc > 0.80 || auc < 0.20;
    candidateAuctions.push({ feature: name, auc, flagged });
  }

  // Label permutation test (shuffle labels: AUC must be near 0.50 ± 0.07)
  const shuffledLabels = [...labels].sort(() => Math.random() - 0.5);
  // Pick an informative feature and compute AUC on shuffled labels
  const testFeature = featureNames[0] || 'is_rolling';
  const testVals = rows.map((r) => r[testFeature]);
  const shuffledAuc = calculateFastRocAuc(testVals, shuffledLabels);

  const passed =
    forbiddenFound.length === 0 &&
    Math.abs(shuffledAuc - 0.5) <= 0.07 &&
    !candidateAuctions.some((c) => c.flagged && (c.feature.includes('churn') || c.feature.includes('revenue_at_risk')));

  return {
    passed,
    candidateFeatureAuctions: candidateAuctions,
    shuffledLabelAuc: Number(shuffledAuc.toFixed(3)),
    forbiddenFieldsChecked: [...FORBIDDEN_FIELDS, ...POLICY_EXCLUDED_FIELDS],
    quarantinedFields: [...QUARANTINED_FIELDS],
    details: passed
      ? `Leakage firewall passed: 0 forbidden fields, shuffled label AUC is ${shuffledAuc.toFixed(3)}.`
      : `Leakage firewall flagged anomalies: verify candidate feature correlations.`,
  };
}

// Fast Wilcoxon-Mann-Whitney ROC-AUC calculation
export function calculateFastRocAuc(scores: number[], labels: number[]): number {
  let posCount = 0;
  let negCount = 0;
  const paired: Array<{ score: number; label: number }> = [];

  for (let i = 0; i < scores.length; i++) {
    const label = labels[i];
    if (label === 1) posCount++;
    else negCount++;
    paired.push({ score: scores[i], label });
  }

  if (posCount === 0 || negCount === 0) return 0.5;

  paired.sort((a, b) => a.score - b.score);

  // Rank with tie handling
  let rankSumPos = 0;
  let i = 0;
  while (i < paired.length) {
    let j = i;
    while (j < paired.length && paired[j].score === paired[i].score) {
      j++;
    }
    const tieCount = j - i;
    const avgRank = i + 1 + (tieCount - 1) / 2;
    for (let k = i; k < j; k++) {
      if (paired[k].label === 1) {
        rankSumPos += avgRank;
      }
    }
    i = j;
  }

  const u = rankSumPos - (posCount * (posCount + 1)) / 2;
  return Number((u / (posCount * negCount)).toFixed(4));
}
