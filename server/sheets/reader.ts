import crypto from 'crypto';
import { google } from 'googleapis';
import { SERVER_CONFIG } from '../config.js';
import { RawCustomerRow } from '../../shared/types.js';

export const EXPECTED_COLUMNS = [
  'Customer ID',
  'Customer Segment',
  'Age',
  'Age Band',
  'Gender',
  'UK Nation',
  'City',
  'Acquisition Channel',
  'Join Date',
  'Tenure Months',
  'Service Type',
  'Plan Name',
  'Contract Type',
  'Contract Start Date',
  'Contract End Date',
  'Auto Renew',
  'Monthly Charge GBP',
  'Average Monthly Usage GB',
  'Data Allowance GB',
  'Overage Charges GBP',
  'Discount Percent',
  'Payment Method',
  'Direct Debit',
  'Late Payments 12M',
  'Failed Payments 12M',
  'Support Tickets 12M',
  'Complaints 12M',
  'Average Resolution Hours',
  'Network Outages 12M',
  'Satisfaction Score 1 10',
  'NPS Score',
  'Competitor Offer Received',
  'Churn Status',
  'Churn Date',
  'Churn Reason',
  'Lifetime Revenue GBP',
  'Monthly Revenue At Risk GBP',
  'Churn Flag',
] as const;

export const COLUMN_ALIASES: Record<string, string> = {
  customerid: 'Customer ID',
  customer_id: 'Customer ID',
  cust_id: 'Customer ID',
  id: 'Customer ID',
  customersegment: 'Customer Segment',
  customer_segment: 'Customer Segment',
  segment: 'Customer Segment',
  age: 'Age',
  ageband: 'Age Band',
  age_band: 'Age Band',
  gender: 'Gender',
  sex: 'Gender',
  uknation: 'UK Nation',
  uk_nation: 'UK Nation',
  nation: 'UK Nation',
  country: 'UK Nation',
  city: 'City',
  acquisitionchannel: 'Acquisition Channel',
  acquisition_channel: 'Acquisition Channel',
  channel: 'Acquisition Channel',
  joindate: 'Join Date',
  join_date: 'Join Date',
  tenuremonths: 'Tenure Months',
  tenure_months: 'Tenure Months',
  tenure: 'Tenure Months',
  servicetype: 'Service Type',
  service_type: 'Service Type',
  service: 'Service Type',
  planname: 'Plan Name',
  plan_name: 'Plan Name',
  plan: 'Plan Name',
  contracttype: 'Contract Type',
  contract_type: 'Contract Type',
  contractstartdate: 'Contract Start Date',
  contract_start_date: 'Contract Start Date',
  contractenddate: 'Contract End Date',
  contract_end_date: 'Contract End Date',
  autorenew: 'Auto Renew',
  auto_renew: 'Auto Renew',
  monthlychargegbp: 'Monthly Charge GBP',
  monthly_charge_gbp: 'Monthly Charge GBP',
  monthlycharge: 'Monthly Charge GBP',
  monthly_charge: 'Monthly Charge GBP',
  averagemonthlyusagegb: 'Average Monthly Usage GB',
  average_monthly_usage_gb: 'Average Monthly Usage GB',
  monthlyusagegb: 'Average Monthly Usage GB',
  dataallowancegb: 'Data Allowance GB',
  data_allowance_gb: 'Data Allowance GB',
  dataallowance: 'Data Allowance GB',
  overagechargesgbp: 'Overage Charges GBP',
  overage_charges_gbp: 'Overage Charges GBP',
  overagecharges: 'Overage Charges GBP',
  discountpercent: 'Discount Percent',
  discount_percent: 'Discount Percent',
  discount: 'Discount Percent',
  paymentmethod: 'Payment Method',
  payment_method: 'Payment Method',
  directdebit: 'Direct Debit',
  direct_debit: 'Direct Debit',
  latepayments12m: 'Late Payments 12M',
  late_payments_12m: 'Late Payments 12M',
  failedpayments12m: 'Failed Payments 12M',
  failed_payments_12m: 'Failed Payments 12M',
  supporttickets12m: 'Support Tickets 12M',
  support_tickets_12m: 'Support Tickets 12M',
  complaints12m: 'Complaints 12M',
  complaints_12m: 'Complaints 12M',
  averageresolutionhours: 'Average Resolution Hours',
  average_resolution_hours: 'Average Resolution Hours',
  networkoutages12m: 'Network Outages 12M',
  network_outages_12m: 'Network Outages 12M',
  satisfactionscore110: 'Satisfaction Score 1 10',
  satisfaction_score_1_10: 'Satisfaction Score 1 10',
  satisfactionscore: 'Satisfaction Score 1 10',
  satisfaction: 'Satisfaction Score 1 10',
  npsscore: 'NPS Score',
  nps_score: 'NPS Score',
  nps: 'NPS Score',
  competitorofferreceived: 'Competitor Offer Received',
  competitor_offer_received: 'Competitor Offer Received',
  competitoroffer: 'Competitor Offer Received',
  churnstatus: 'Churn Status',
  churn_status: 'Churn Status',
  churndate: 'Churn Date',
  churn_date: 'Churn Date',
  churnreason: 'Churn Reason',
  churn_reason: 'Churn Reason',
  lifetimerevenuegbp: 'Lifetime Revenue GBP',
  lifetime_revenue_gbp: 'Lifetime Revenue GBP',
  monthlyrevenueatriskgbp: 'Monthly Revenue At Risk GBP',
  monthly_revenue_at_risk_gbp: 'Monthly Revenue At Risk GBP',
  churnflag: 'Churn Flag',
  churn_flag: 'Churn Flag',
};

function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_\-/\\]/g, '');
}

export function matchHeaderToStandard(rawHeader: string): string | null {
  const norm = normaliseHeader(rawHeader);
  if (COLUMN_ALIASES[norm]) {
    return COLUMN_ALIASES[norm];
  }
  for (const expected of EXPECTED_COLUMNS) {
    if (normaliseHeader(expected) === norm) {
      return expected;
    }
  }
  return null;
}

export interface SheetFetchResult {
  spreadsheetId: string;
  tabName: string;
  contentHash: string;
  rawRows: RawCustomerRow[];
  headerMapping: Array<{ expected: string; found: string; status: 'matched' | 'aliased' | 'missing' | 'extra' }>;
  missingColumns: string[];
  warnings: string[];
}

async function waitWithJitter(attempt: number): Promise<void> {
  const baseDelay = 1000 * Math.pow(2, attempt);
  const jitter = Math.random() * 500;
  await new Promise((res) => setTimeout(res, baseDelay + jitter));
}

// Parses CSV text handling quotes and newlines accurately
export function parseCsvText(csvText: string): any[][] {
  const rows: any[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF
      }
      currentRow.push(currentVal);
      currentVal = '';
      if (currentRow.some((c) => c.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }
  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal);
    if (currentRow.some((c) => c.trim().length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

export async function fetchSheetData(spreadsheetId = SERVER_CONFIG.SPREADSHEET_ID): Promise<SheetFetchResult> {
  const maxAttempts = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // 1. Try googleapis if Service Account or API Key is configured
      if (SERVER_CONFIG.GOOGLE_SERVICE_ACCOUNT_JSON || SERVER_CONFIG.GOOGLE_SHEETS_API_KEY) {
        try {
          const auth = SERVER_CONFIG.GOOGLE_SERVICE_ACCOUNT_JSON
            ? new google.auth.GoogleAuth({
                credentials: JSON.parse(SERVER_CONFIG.GOOGLE_SERVICE_ACCOUNT_JSON),
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
              })
            : SERVER_CONFIG.GOOGLE_SHEETS_API_KEY;

          const sheets = google.sheets({ version: 'v4', auth });
          const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
          const sheetsList = spreadsheetMeta.data.sheets || [];

          // Find the tab that best matches the schema
          let bestTabName = sheetsList[0]?.properties?.title || 'Sheet1';
          let maxMatchCount = -1;

          for (const s of sheetsList) {
            const title = s.properties?.title;
            if (!title) continue;
            const headerSample = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: `'${title}'!1:1`,
            });
            const firstRow = headerSample.data.values?.[0] || [];
            const matches = firstRow.filter((h: any) => matchHeaderToStandard(String(h))).length;
            if (matches > maxMatchCount) {
              maxMatchCount = matches;
              bestTabName = title;
            }
          }

          // Fetch values
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${bestTabName}'`,
            valueRenderOption: 'UNFORMATTED_VALUE',
            dateTimeRenderOption: 'SERIAL_NUMBER',
          });

          const rawValues = response.data.values || [];
          if (rawValues.length === 0) {
            throw new Error(`Google Sheet tab "${bestTabName}" is completely empty.`);
          }

          return processRawValues(spreadsheetId, bestTabName, rawValues);
        } catch (apiErr: any) {
          console.warn(`[Sheets] Google API client failed: ${apiErr.message}. Falling back to export endpoint.`);
        }
      }

      // 2. Fetch via public CSV export endpoint (handles publicly viewable sheets)
      const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(exportUrl, {
        headers: { 'User-Agent': 'BritConnect-Engine/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to download sheet from ${exportUrl}`);
      }

      const csvText = await res.text();
      const rawValues = parseCsvText(csvText);

      return processRawValues(spreadsheetId, 'Sheet1', rawValues);
    } catch (err: any) {
      lastError = err;
      console.error(`[Sheets Reader] Attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < maxAttempts - 1) {
        await waitWithJitter(attempt);
      }
    }
  }

  throw new Error(`Failed to load Google Sheet (${spreadsheetId}) after ${maxAttempts} attempts: ${lastError?.message || 'Network timeout or permission denied'}`);
}

function processRawValues(spreadsheetId: string, tabName: string, rawValues: any[][]): SheetFetchResult {
  if (rawValues.length === 0) {
    throw new Error('Spreadsheet contains zero rows.');
  }

  const headerRow = rawValues[0].map((h) => String(h ?? '').trim());
  const dataRows = rawValues.slice(1);

  // Content Hash (computed on raw serialized data for change detection)
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(rawValues));
  const contentHash = hash.digest('hex');

  // Map headers
  const headerMapping: Array<{ expected: string; found: string; status: 'matched' | 'aliased' | 'missing' | 'extra' }> = [];
  const columnIndexToStandard: Record<number, string> = {};
  const foundStandardCols = new Set<string>();
  const warnings: string[] = [];

  headerRow.forEach((foundHeader, colIdx) => {
    const matched = matchHeaderToStandard(foundHeader);
    if (matched) {
      columnIndexToStandard[colIdx] = matched;
      foundStandardCols.add(matched);
      headerMapping.push({
        expected: matched,
        found: foundHeader,
        status: matched === foundHeader ? 'matched' : 'aliased',
      });
    } else {
      warnings.push(`Extra column ignored: "${foundHeader}" at index ${colIdx}`);
      headerMapping.push({
        expected: '(None)',
        found: foundHeader,
        status: 'extra',
      });
    }
  });

  const missingColumns: string[] = [];
  for (const expected of EXPECTED_COLUMNS) {
    if (!foundStandardCols.has(expected)) {
      missingColumns.push(expected);
      headerMapping.push({
        expected,
        found: '(Missing)',
        status: 'missing',
      });
    }
  }

  if (missingColumns.length > 0) {
    throw new Error(`Schema mismatch: Required columns missing from sheet: ${missingColumns.join(', ')}`);
  }

  // Construct raw objects
  const rawObjects: RawCustomerRow[] = [];
  for (const row of dataRows) {
    // Ignore entirely blank rows
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
      continue;
    }
    const obj: RawCustomerRow = {};
    row.forEach((val, idx) => {
      const colName = columnIndexToStandard[idx];
      if (colName) {
        obj[colName] = val;
      }
    });
    rawObjects.push(obj);
  }

  return {
    spreadsheetId,
    tabName,
    contentHash,
    rawRows: rawObjects,
    headerMapping,
    missingColumns,
    warnings,
  };
}
