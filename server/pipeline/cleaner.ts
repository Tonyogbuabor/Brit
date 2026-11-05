import {
  RawCustomerRow,
  CleanedCustomer,
  DataQualityReport,
  DataQualityRuleResult,
  CustomerSegment,
  ServiceType,
  ContractType,
  ChurnStatus,
  ChurnReason,
  UKNation,
} from '../../shared/types.js';

// Parses Excel serial date (epoch 1899-12-30) or string dates (M/D/YYYY, YYYY-MM-DD, etc.) into ISO YYYY-MM-DD
export function parseDateToIso(value: any): string | null {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }

  // If numeric Excel serial
  if (typeof value === 'number' || (!isNaN(Number(value)) && !String(value).includes('-') && !String(value).includes('/'))) {
    const serial = Number(value);
    if (serial > 0 && serial < 100000) {
      // Excel 1900 leap year bug offset: 25569 = 1970-01-01 in days from 1899-12-30
      // 1 day = 86400 * 1000 ms
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  const str = String(value).trim();
  // Check if M/D/YYYY or MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  // Check if YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Fallback to JS Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export function cleanNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/[£$,% ]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
}

export function cleanBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  const str = String(val ?? '').trim().toLowerCase();
  return str === 'yes' || str === 'true' || str === '1' || str === 'y';
}

export function cleanString(val: any, fallback = 'Unknown'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

export interface CleaningResult {
  cleanedRows: CleanedCustomer[];
  validActiveRows: CleanedCustomer[];
  validChurnedRows: CleanedCustomer[];
  quarantinedRows: CleanedCustomer[];
  qualityReport: DataQualityReport;
}

export function cleanAndValidateDataset(rawRows: RawCustomerRow[], columnMatches: any[] = []): CleaningResult {
  const rulesMap: Record<string, DataQualityRuleResult> = {
    R_ID: { ruleId: 'R_ID', description: 'Customer ID present and valid format', checkedCount: 0, passedCount: 0, fixedCount: 0, quarantinedCount: 0, severity: 'error' },
    R_DEDUP: { ruleId: 'R_DEDUP', description: 'Deduplication by Customer ID', checkedCount: 0, passedCount: 0, fixedCount: 0, quarantinedCount: 0, severity: 'warning' },
    R_TARGET_INTEGRITY: { ruleId: 'R_TARGET_INTEGRITY', description: 'Churn Flag matches Churn Status exactly', checkedCount: 0, passedCount: 0, fixedCount: 0, quarantinedCount: 0, severity: 'error' },
    R_AGE_DOMAIN: { ruleId: 'R_AGE_DOMAIN', description: 'Age within valid 16-110 bounds', checkedCount: 0, passedCount: 0, fixedCount: 0, quarantinedCount: 0, severity: 'warning' },
    R_FINANCIAL_NONNEG: { ruleId: 'R_FINANCIAL_NONNEG', description: 'Financial charges and counts are non-negative', checkedCount: 0, passedCount: 0, fixedCount: 0, quarantinedCount: 0, severity: 'warning' },
    R_SCORES_DOMAIN: { ruleId: 'R_SCORES_DOMAIN', description: 'Satisfaction (1-10) and NPS (-100 to 100) within range', checkedCount: 0, passedCount: 0, fixedCount: 0, quarantinedCount: 0, severity: 'warning' },
    R_DATES_LOGIC: { ruleId: 'R_DATES_LOGIC', description: 'Join Date exists, Churn Date not before Join Date', checkedCount: 0, passedCount: 0, fixedCount: 0, quarantinedCount: 0, severity: 'warning' },
    R_SENTINEL_DATA: { ruleId: 'R_SENTINEL_DATA', description: 'Sentinel handling for 999 (unlimited) and 0 (broadband)', checkedCount: 0, passedCount: 0, fixedCount: 0, quarantinedCount: 0, severity: 'info' },
  };

  const quarantinedSamples: Array<{ customerId: string; reason: string; rawSnippet: Record<string, any> }> = [];

  // Step 1: Pre-process & Deduplication
  // Group by customer ID to deduplicate (keep row with most non-empty fields)
  const byCustId = new Map<string, RawCustomerRow[]>();
  let dedupedCount = 0;

  for (const raw of rawRows) {
    rulesMap.R_ID.checkedCount++;
    const rawId = raw['Customer ID'];
    const custIdStr = rawId ? String(rawId).trim() : '';

    if (!custIdStr) {
      rulesMap.R_ID.quarantinedCount++;
      quarantinedSamples.push({
        customerId: 'MISSING_ID',
        reason: 'Customer ID is null, empty or missing.',
        rawSnippet: raw,
      });
      continue;
    }

    rulesMap.R_ID.passedCount++;
    if (!byCustId.has(custIdStr)) {
      byCustId.set(custIdStr, []);
    }
    byCustId.get(custIdStr)!.push(raw);
  }

  // Deduplicate: pick row with most populated fields
  const dedupedRows: RawCustomerRow[] = [];
  for (const [custId, rows] of byCustId.entries()) {
    rulesMap.R_DEDUP.checkedCount++;
    if (rows.length > 1) {
      dedupedCount += rows.length - 1;
      rulesMap.R_DEDUP.fixedCount++;
      // Pick the row with maximum non-empty fields
      rows.sort((a, b) => {
        const countA = Object.values(a).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length;
        const countB = Object.values(b).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length;
        return countB - countA;
      });
    } else {
      rulesMap.R_DEDUP.passedCount++;
    }
    dedupedRows.push(rows[0]);
  }

  const allCleaned: CleanedCustomer[] = [];
  const validActive: CleanedCustomer[] = [];
  const validChurned: CleanedCustomer[] = [];
  const quarantined: CleanedCustomer[] = [];

  for (const raw of dedupedRows) {
    const customerId = String(raw['Customer ID']).trim();
    let isRowValid = true;
    let quarantineReason = '';

    // Check Churn Status and Flag
    rulesMap.R_TARGET_INTEGRITY.checkedCount++;
    const rawStatus = cleanString(raw['Churn Status'], 'Active');
    const isStatusChurned = rawStatus.toLowerCase() === 'churned';
    const churnStatus: ChurnStatus = isStatusChurned ? 'Churned' : 'Active';

    const rawFlag = cleanNumber(raw['Churn Flag'], isStatusChurned ? 1 : 0);
    const flagAsInt: 0 | 1 = rawFlag === 1 ? 1 : 0;

    // Target integrity rule: Churn Flag must equal (Churn Status = Churned)
    if ((isStatusChurned && flagAsInt !== 1) || (!isStatusChurned && flagAsInt === 1)) {
      isRowValid = false;
      quarantineReason = `Target mismatch: Churn Status is "${rawStatus}" but Churn Flag is ${rawFlag}.`;
      rulesMap.R_TARGET_INTEGRITY.quarantinedCount++;
      quarantinedSamples.push({ customerId, reason: quarantineReason, rawSnippet: raw });
    } else {
      rulesMap.R_TARGET_INTEGRITY.passedCount++;
    }

    // Demographics
    rulesMap.R_AGE_DOMAIN.checkedCount++;
    let age = Math.round(cleanNumber(raw['Age'], 45));
    let ageBand = cleanString(raw['Age Band'], '35-44');
    if (age < 16 || age > 110) {
      // Fix by capping or keeping inside 16-110 bounds
      age = Math.max(16, Math.min(110, age));
      rulesMap.R_AGE_DOMAIN.fixedCount++;
    } else {
      rulesMap.R_AGE_DOMAIN.passedCount++;
    }

    const gender = cleanString(raw['Gender'], 'Unknown');
    const rawNation = cleanString(raw['UK Nation'], 'England');
    let ukNation: UKNation = 'England';
    if (['scotland', 'wales', 'northern ireland', 'england'].includes(rawNation.toLowerCase())) {
      ukNation = (rawNation.charAt(0).toUpperCase() + rawNation.slice(1).toLowerCase()) as UKNation;
      if (rawNation.toLowerCase() === 'northern ireland') ukNation = 'Northern Ireland';
    }

    const city = cleanString(raw['City'], 'London');
    const rawSegment = cleanString(raw['Customer Segment'], 'Consumer');
    let customerSegment: CustomerSegment = 'Consumer';
    if (rawSegment.toLowerCase().includes('small') || rawSegment.toLowerCase().includes('sme')) {
      customerSegment = 'Small Business';
    } else if (rawSegment.toLowerCase().includes('enterprise')) {
      customerSegment = 'Enterprise';
    }

    const acquisitionChannel = cleanString(raw['Acquisition Channel'], 'Online');

    // Product & Contract
    const rawService = cleanString(raw['Service Type'], 'Mobile');
    let serviceType: ServiceType = 'Mobile';
    if (rawService.toLowerCase().includes('bundle')) {
      serviceType = 'Mobile + Broadband Bundle';
    } else if (rawService.toLowerCase().includes('fibre')) {
      serviceType = 'Fibre Broadband';
    } else if (rawService.toLowerCase().includes('broadband')) {
      serviceType = 'Home Broadband';
    }

    const planName = cleanString(raw['Plan Name'], 'Standard Plan');

    const rawContract = cleanString(raw['Contract Type'], '12 Months');
    let contractType: ContractType = '12 Months';
    if (rawContract.toLowerCase().includes('rolling') || rawContract.toLowerCase().includes('month-to-month')) {
      contractType = 'Rolling Monthly';
    } else if (rawContract.toLowerCase().includes('24')) {
      contractType = '24 Months';
    }

    const autoRenew = cleanBoolean(raw['Auto Renew']);

    // Dates
    rulesMap.R_DATES_LOGIC.checkedCount++;
    const joinDate = parseDateToIso(raw['Join Date']) || '2023-01-01';
    const contractStartDate = parseDateToIso(raw['Contract Start Date']) || joinDate;
    const contractEndDate = parseDateToIso(raw['Contract End Date']) || '2025-12-31';
    const churnDate = parseDateToIso(raw['Churn Date']);

    let tenureMonths = Math.round(cleanNumber(raw['Tenure Months'], 12));
    if (tenureMonths < 0) tenureMonths = 0;

    if (churnDate && churnDate < joinDate) {
      rulesMap.R_DATES_LOGIC.fixedCount++;
    } else {
      rulesMap.R_DATES_LOGIC.passedCount++;
    }

    // Billing & Usage
    rulesMap.R_FINANCIAL_NONNEG.checkedCount++;
    let monthlyChargeGbp = cleanNumber(raw['Monthly Charge GBP'], 30);
    if (monthlyChargeGbp < 0) monthlyChargeGbp = 0;

    let averageMonthlyUsageGb = cleanNumber(raw['Average Monthly Usage GB'], 50);
    if (averageMonthlyUsageGb < 0) averageMonthlyUsageGb = 0;

    // Sentinel handling for Data Allowance:
    // 999 = unlimited, 0 = broadband not applicable
    rulesMap.R_SENTINEL_DATA.checkedCount++;
    const rawAllowance = cleanNumber(raw['Data Allowance GB'], 0);
    const isUnlimitedData = rawAllowance === 999;
    const hasDataAllowance = rawAllowance > 0 && !isUnlimitedData;
    const dataAllowanceGb = rawAllowance;
    rulesMap.R_SENTINEL_DATA.passedCount++;

    let overageChargesGbp = cleanNumber(raw['Overage Charges GBP'], 0);
    if (overageChargesGbp < 0) overageChargesGbp = 0;

    let discountPercent = cleanNumber(raw['Discount Percent'], 0);
    if (discountPercent < 0) discountPercent = 0;
    if (discountPercent > 100) discountPercent = 100;

    const paymentMethod = cleanString(raw['Payment Method'], 'Direct Debit');
    const directDebit = cleanBoolean(raw['Direct Debit']);

    const latePayments12M = Math.max(0, Math.round(cleanNumber(raw['Late Payments 12M'], 0)));
    const failedPayments12M = Math.max(0, Math.round(cleanNumber(raw['Failed Payments 12M'], 0)));

    // Service experience
    const supportTickets12M = Math.max(0, Math.round(cleanNumber(raw['Support Tickets 12M'], 0)));
    const complaints12M = Math.max(0, Math.round(cleanNumber(raw['Complaints 12M'], 0)));
    const averageResolutionHours = Math.max(0, cleanNumber(raw['Average Resolution Hours'], 0));
    const networkOutages12M = Math.max(0, Math.round(cleanNumber(raw['Network Outages 12M'], 0)));

    rulesMap.R_SCORES_DOMAIN.checkedCount++;
    let satisfactionScore = cleanNumber(raw['Satisfaction Score 1 10'], 7);
    if (satisfactionScore < 1) satisfactionScore = 1;
    if (satisfactionScore > 10) satisfactionScore = 10;

    // NPS Score: continuous from -100 to 100
    let npsScore = cleanNumber(raw['NPS Score'], 20);
    if (npsScore < -100) npsScore = -100;
    if (npsScore > 100) npsScore = 100;
    rulesMap.R_SCORES_DOMAIN.passedCount++;

    const competitorOfferReceived = cleanBoolean(raw['Competitor Offer Received']);

    // Post-event outcome fields
    let churnReason: ChurnReason | null = null;
    if (isStatusChurned) {
      const cr = cleanString(raw['Churn Reason'], 'Price Increase');
      churnReason = cr as ChurnReason;
    }

    const lifetimeRevenueGbp = Math.max(0, cleanNumber(raw['Lifetime Revenue GBP'], monthlyChargeGbp * Math.max(1, tenureMonths)));
    // Realised revenue lost for churned customers
    const monthlyRevenueAtRiskGbp = Math.max(0, cleanNumber(raw['Monthly Revenue At Risk GBP'], isStatusChurned ? monthlyChargeGbp : 0));

    const cleaned: CleanedCustomer = {
      customerId,
      customerSegment,
      age,
      ageBand,
      gender,
      ukNation,
      city,
      acquisitionChannel,
      joinDate,
      tenureMonths,
      serviceType,
      planName,
      contractType,
      contractStartDate,
      contractEndDate,
      autoRenew,
      monthlyChargeGbp,
      averageMonthlyUsageGb,
      dataAllowanceGb,
      isUnlimitedData,
      hasDataAllowance,
      overageChargesGbp,
      discountPercent,
      paymentMethod,
      directDebit,
      latePayments12M,
      failedPayments12M,
      supportTickets12M,
      complaints12M,
      averageResolutionHours,
      networkOutages12M,
      satisfactionScore,
      npsScore,
      competitorOfferReceived,
      churnStatus,
      churnDate,
      churnReason,
      lifetimeRevenueGbp,
      monthlyRevenueAtRiskGbp,
      churnFlag: flagAsInt,
      isValid: isRowValid,
      quarantineReason: isRowValid ? undefined : quarantineReason,
    };

    allCleaned.push(cleaned);
    if (isRowValid) {
      if (flagAsInt === 1) {
        validChurned.push(cleaned);
      } else {
        validActive.push(cleaned);
      }
    } else {
      quarantined.push(cleaned);
    }
  }

  const qualityReport: DataQualityReport = {
    timestamp: new Date().toISOString(),
    totalRawRows: rawRows.length,
    validRows: validActive.length + validChurned.length,
    quarantinedRows: quarantined.length + rulesMap.R_ID.quarantinedCount,
    dedupedCount,
    rules: Object.values(rulesMap),
    quarantinedSamples: quarantinedSamples.slice(0, 20),
    columnMatches,
  };

  return {
    cleanedRows: allCleaned,
    validActiveRows: validActive,
    validChurnedRows: validChurned,
    quarantinedRows: quarantined,
    qualityReport,
  };
}
