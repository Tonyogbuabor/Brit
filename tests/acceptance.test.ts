import { describe, it, expect } from 'vitest';
import { CleanedCustomer, ScoredCustomer } from '../shared/types.js';
import {
  validateFeatureMatrix,
  calculateFastRocAuc,
  fitFoldStats,
  engineerCustomerFeatures,
} from '../server/pipeline/firewall.js';
import { computePlatformKpis } from '../server/snapshot/store.js';
import { verifyShapAdditivity, computeLinearShap } from '../server/explain/shap.js';
import { parseDateToIso, cleanAndValidateDataset } from '../server/pipeline/cleaner.js';

describe('BritConnect Platform Core Acceptance Criteria', () => {
  // Acceptance Criterion 1: KPI calculation match to the penny
  it('Criterion 1: Platform KPIs match independently computed sums to the penny and 0.1%', () => {
    const mockCustomers: ScoredCustomer[] = [
      {
        customerId: 'BCT-001',
        customerSegment: 'Consumer',
        age: 30,
        ageBand: '25-34',
        gender: 'Female',
        ukNation: 'England',
        city: 'London',
        acquisitionChannel: 'Online',
        joinDate: '2024-01-01',
        tenureMonths: 12,
        serviceType: 'Mobile',
        planName: 'Mobile Plus',
        contractType: '12 Months',
        contractStartDate: '2024-01-01',
        contractEndDate: '2025-01-01',
        autoRenew: true,
        monthlyChargeGbp: 30.50,
        averageMonthlyUsageGb: 50,
        dataAllowanceGb: 100,
        isUnlimitedData: false,
        hasDataAllowance: true,
        overageChargesGbp: 0,
        discountPercent: 10,
        paymentMethod: 'Direct Debit',
        directDebit: true,
        latePayments12M: 0,
        failedPayments12M: 0,
        supportTickets12M: 1,
        complaints12M: 0,
        averageResolutionHours: 4,
        networkOutages12M: 0,
        satisfactionScore: 8,
        npsScore: 40,
        competitorOfferReceived: false,
        churnStatus: 'Active',
        churnDate: null,
        churnReason: null,
        lifetimeRevenueGbp: 366.0,
        monthlyRevenueAtRiskGbp: 0,
        churnFlag: 0,
        isValid: true,
        churnProbability: 0.12,
        riskTier: 'Low',
        expectedMrrAtRiskGbp: 3.66,
        personaId: 'seg_1',
        personaName: 'Loyal High-Value',
        topRiskDrivers: [],
        topProtectiveFactors: [],
        shapBaseValue: -1.2,
      },
      {
        customerId: 'BCT-002',
        customerSegment: 'Consumer',
        age: 45,
        ageBand: '45-54',
        gender: 'Male',
        ukNation: 'Scotland',
        city: 'Glasgow',
        acquisitionChannel: 'Retail Store',
        joinDate: '2023-06-01',
        tenureMonths: 18,
        serviceType: 'Fibre Broadband',
        planName: 'Fibre 150',
        contractType: 'Rolling Monthly',
        contractStartDate: '2023-06-01',
        contractEndDate: '2024-06-01',
        autoRenew: false,
        monthlyChargeGbp: 45.25,
        averageMonthlyUsageGb: 220,
        dataAllowanceGb: 0,
        isUnlimitedData: true,
        hasDataAllowance: false,
        overageChargesGbp: 0,
        discountPercent: 0,
        paymentMethod: 'Credit Card',
        directDebit: false,
        latePayments12M: 2,
        failedPayments12M: 1,
        supportTickets12M: 4,
        complaints12M: 2,
        averageResolutionHours: 28,
        networkOutages12M: 3,
        satisfactionScore: 3,
        npsScore: -60,
        competitorOfferReceived: true,
        churnStatus: 'Active',
        churnDate: null,
        churnReason: null,
        lifetimeRevenueGbp: 814.5,
        monthlyRevenueAtRiskGbp: 0,
        churnFlag: 0,
        isValid: true,
        churnProbability: 0.78,
        riskTier: 'Critical',
        expectedMrrAtRiskGbp: 35.30,
        personaId: 'seg_2',
        personaName: 'Service-Frustrated',
        topRiskDrivers: [],
        topProtectiveFactors: [],
        shapBaseValue: 0.8,
      },
      {
        customerId: 'BCT-003',
        customerSegment: 'Small Business',
        age: 50,
        ageBand: '45-54',
        gender: 'Male',
        ukNation: 'Wales',
        city: 'Cardiff',
        acquisitionChannel: 'Telesales',
        joinDate: '2022-01-01',
        tenureMonths: 24,
        serviceType: 'Mobile + Broadband Bundle',
        planName: 'Business Pro',
        contractType: '24 Months',
        contractStartDate: '2022-01-01',
        contractEndDate: '2024-01-01',
        autoRenew: false,
        monthlyChargeGbp: 65.00,
        averageMonthlyUsageGb: 500,
        dataAllowanceGb: 999,
        isUnlimitedData: true,
        hasDataAllowance: false,
        overageChargesGbp: 0,
        discountPercent: 15,
        paymentMethod: 'Direct Debit',
        directDebit: true,
        latePayments12M: 0,
        failedPayments12M: 0,
        supportTickets12M: 1,
        complaints12M: 0,
        averageResolutionHours: 2,
        networkOutages12M: 0,
        satisfactionScore: 9,
        npsScore: 75,
        competitorOfferReceived: false,
        churnStatus: 'Churned',
        churnDate: '2024-01-15',
        churnReason: 'Price Increase',
        lifetimeRevenueGbp: 1560.0,
        monthlyRevenueAtRiskGbp: 65.0,
        churnFlag: 1,
        isValid: true,
        churnProbability: 0.85,
        riskTier: 'Critical',
        expectedMrrAtRiskGbp: 0, // 0 for churned
        personaId: 'seg_3',
        personaName: 'Bundled Stalwarts',
        topRiskDrivers: [],
        topProtectiveFactors: [],
        shapBaseValue: 0.5,
      },
    ];

    const kpis = computePlatformKpis(mockCustomers);

    // Active MRR = 30.50 + 45.25 = 75.75
    expect(kpis.mrrGbp).toBe(75.75);
    // Realised MRR lost = 65.00
    expect(kpis.realisedMrrLostGbp).toBe(65.00);
    // Active customers count = 2
    expect(kpis.activeCustomers).toBe(2);
    // Churned count = 1
    expect(kpis.churnedCustomers).toBe(1);
    // ARPU = 75.75 / 2 = 37.88
    expect(kpis.arpuGbp).toBe(37.88);
    // Expected MRR at risk = (0.12 * 30.50) + (0.78 * 45.25) = 38.955 -> 38.95
    expect(kpis.expectedMrrAtRiskGbp).toBe(38.95);
  });

  // Acceptance Criterion 2: Leakage firewall rejection & permutation test
  it('Criterion 2: Firewall rejects model matrix with forbidden field and permutation test lands near 0.5', () => {
    const featureNames = ['is_rolling', 'discount_depth', 'churn_flag']; // churn_flag is forbidden!
    const rows = [{ is_rolling: 1, discount_depth: 10, churn_flag: 1 }];
    const labels = [1];

    expect(() => validateFeatureMatrix(featureNames, rows, labels)).toThrowError(/LEAKAGE FIREWALL REJECTION/);

    // Policy protected demographic exclusion
    const demographicFeatureNames = ['is_rolling', 'gender'];
    expect(() => validateFeatureMatrix(demographicFeatureNames, [{ is_rolling: 1, gender: 1 }], [1])).toThrowError(/Policy Excluded/);

    // Permutation test verification: random labels against feature yield AUC in [0.43, 0.57]
    const n = 1000;
    const testFeatureVals = Array.from({ length: n }, () => Math.random());
    const randomLabels = Array.from({ length: n }, () => (Math.random() > 0.5 ? 1 : 0));
    const randomAuc = calculateFastRocAuc(testFeatureVals, randomLabels);

    expect(Math.abs(randomAuc - 0.5)).toBeLessThanOrEqual(0.07);
  });

  // Acceptance Criterion 3: No statistics computed outside training folds
  it('Criterion 3: No preprocessing statistic is computed outside training folds (canary isolation test)', () => {
    const trainingFoldCustomers: CleanedCustomer[] = [
      {
        customerId: 'CANARY_TRAIN_1',
        customerSegment: 'Consumer',
        age: 35,
        ageBand: '35-44',
        gender: 'Male',
        ukNation: 'England',
        city: 'Manchester',
        acquisitionChannel: 'Online',
        joinDate: '2024-01-01',
        tenureMonths: 6,
        serviceType: 'Mobile',
        planName: 'Canary Plan',
        contractType: '12 Months',
        contractStartDate: '2024-01-01',
        contractEndDate: '2025-01-01',
        autoRenew: true,
        monthlyChargeGbp: 40,
        averageMonthlyUsageGb: 20,
        dataAllowanceGb: 50,
        isUnlimitedData: false,
        hasDataAllowance: true,
        overageChargesGbp: 0,
        discountPercent: 0,
        paymentMethod: 'Direct Debit',
        directDebit: true,
        latePayments12M: 0,
        failedPayments12M: 0,
        supportTickets12M: 0,
        complaints12M: 0,
        averageResolutionHours: 0,
        networkOutages12M: 0,
        satisfactionScore: 8,
        npsScore: 30,
        competitorOfferReceived: false,
        churnStatus: 'Active',
        churnDate: null,
        churnReason: null,
        lifetimeRevenueGbp: 240,
        monthlyRevenueAtRiskGbp: 0,
        churnFlag: 0,
        isValid: true,
      },
    ];

    // Out-of-sample canary row with an extreme outlier price £999
    const testCanaryRow: CleanedCustomer = {
      ...trainingFoldCustomers[0],
      customerId: 'CANARY_TEST_OUTLIER',
      monthlyChargeGbp: 999,
      planName: 'Canary Plan',
    };

    // Fit statistics on training partition only
    const foldStats = fitFoldStats(trainingFoldCustomers);

    // High value threshold must be 40 (derived strictly from training row, not affected by test canary 999)
    expect(foldStats.planMedianCharges['Canary Plan']).toBe(40);
    expect(foldStats.highValueThreshold).toBe(40);

    // Transforming test canary row uses fold median 40
    const engineered = engineerCustomerFeatures(testCanaryRow, foldStats);
    // price_vs_plan_median = 999 - 40 = 959
    expect(engineered.price_vs_plan_median).toBe(959);
  });

  // Acceptance Criterion 4: SHAP additivity holds to 1e-6
  it('Criterion 4: SHAP additivity holds to tolerance 1e-6', () => {
    const baseValue = -0.45;
    const contributions = {
      is_rolling: 0.35,
      complaint_rate: 0.82,
      discount_flag: -0.15,
      auto_renew: -0.22,
    };
    const expectedOutput = baseValue + 0.35 + 0.82 - 0.15 - 0.22; // 0.35

    const isAdditive = verifyShapAdditivity(baseValue, contributions, expectedOutput);
    expect(isAdditive).toBe(true);

    // Test with actual computeLinearShap
    const featureVec = { is_rolling: 1, complaints: 2 };
    const weights = { is_rolling: 0.5, complaints: 0.3 };
    const intercept = -0.1;
    const baselineMeans = { is_rolling: 0.2, complaints: 0.5 };

    const shapResult = computeLinearShap(
      featureVec,
      weights,
      intercept,
      baselineMeans,
      {} as any,
      baselineMeans
    );

    const rawOutput = intercept + weights.is_rolling * (1 - 0.2) + weights.complaints * (2 - 0.5);
    const valid = verifyShapAdditivity(shapResult.baseValue, shapResult.contributions, rawOutput);
    expect(valid).toBe(true);
  });

  // Acceptance Criterion 5: Cleaning and Date Parsing integrity
  it('Criterion 5: Date serials and target integrity correctly validated and quarantined', () => {
    // Excel serial 45620 = 2024-11-24
    const isoDate = parseDateToIso(45620);
    expect(isoDate).toBe('2024-11-24');

    // Date string M/D/YYYY
    expect(parseDateToIso('12/20/2023')).toBe('2023-12-20');

    // Mismatched target row (Active status with Churn Flag = 1) must be quarantined
    const dirtyRows = [
      {
        'Customer ID': 'DIRTY-001',
        'Churn Status': 'Active',
        'Churn Flag': 1, // Target mismatch!
        'Monthly Charge GBP': 30,
      },
    ];

    const cleaned = cleanAndValidateDataset(dirtyRows);
    expect(cleaned.quarantinedRows.length).toBe(1);
    expect(cleaned.quarantinedRows[0].quarantineReason).toContain('Target mismatch');
  });
});
