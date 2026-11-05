/**
 * Shared types for BritConnect AI Customer Churn Intelligence Platform
 */

export type CustomerSegment = 'Consumer' | 'Small Business' | 'Enterprise';
export type ServiceType = 'Mobile' | 'Home Broadband' | 'Fibre Broadband' | 'Mobile + Broadband Bundle';
export type ContractType = 'Rolling Monthly' | '12 Months' | '24 Months';
export type ChurnStatus = 'Active' | 'Churned';
export type ChurnReason = 'Relocation' | 'No Longer Needed' | 'Customer Service' | 'Price Increase' | 'Competitor Offer' | 'Billing Issues' | 'Unknown';
export type RiskTier = 'Critical' | 'High' | 'Medium' | 'Low';
export type UKNation = 'England' | 'Scotland' | 'Wales' | 'Northern Ireland';

export interface RawCustomerRow {
  'Customer ID'?: any;
  'Customer Segment'?: any;
  'Age'?: any;
  'Age Band'?: any;
  'Gender'?: any;
  'UK Nation'?: any;
  'City'?: any;
  'Acquisition Channel'?: any;
  'Join Date'?: any;
  'Tenure Months'?: any;
  'Service Type'?: any;
  'Plan Name'?: any;
  'Contract Type'?: any;
  'Contract Start Date'?: any;
  'Contract End Date'?: any;
  'Auto Renew'?: any;
  'Monthly Charge GBP'?: any;
  'Average Monthly Usage GB'?: any;
  'Data Allowance GB'?: any;
  'Overage Charges GBP'?: any;
  'Discount Percent'?: any;
  'Payment Method'?: any;
  'Direct Debit'?: any;
  'Late Payments 12M'?: any;
  'Failed Payments 12M'?: any;
  'Support Tickets 12M'?: any;
  'Complaints 12M'?: any;
  'Average Resolution Hours'?: any;
  'Network Outages 12M'?: any;
  'Satisfaction Score 1 10'?: any;
  'NPS Score'?: any;
  'Competitor Offer Received'?: any;
  'Churn Status'?: any;
  'Churn Date'?: any;
  'Churn Reason'?: any;
  'Lifetime Revenue GBP'?: any;
  'Monthly Revenue At Risk GBP'?: any;
  'Churn Flag'?: any;
  [key: string]: any;
}

export interface CleanedCustomer {
  customerId: string;
  customerSegment: CustomerSegment;
  age: number;
  ageBand: string;
  gender: string;
  ukNation: UKNation;
  city: string;
  acquisitionChannel: string;
  joinDate: string; // ISO YYYY-MM-DD
  tenureMonths: number;
  serviceType: ServiceType;
  planName: string;
  contractType: ContractType;
  contractStartDate: string;
  contractEndDate: string;
  autoRenew: boolean;
  monthlyChargeGbp: number;
  averageMonthlyUsageGb: number;
  dataAllowanceGb: number; // 999 = unlimited, 0 = broadband n/a
  isUnlimitedData: boolean;
  hasDataAllowance: boolean;
  overageChargesGbp: number;
  discountPercent: number;
  paymentMethod: string;
  directDebit: boolean;
  latePayments12M: number;
  failedPayments12M: number;
  supportTickets12M: number;
  complaints12M: number;
  averageResolutionHours: number;
  networkOutages12M: number;
  satisfactionScore: number; // 1-10
  npsScore: number; // -100 to 100 continuous
  competitorOfferReceived: boolean;
  churnStatus: ChurnStatus;
  churnDate: string | null;
  churnReason: ChurnReason | null;
  lifetimeRevenueGbp: number;
  monthlyRevenueAtRiskGbp: number; // For churned rows = realised revenue lost
  churnFlag: 0 | 1; // 1 = churned, 0 = active
  isValid: boolean;
  quarantineReason?: string;
}

export interface ShapContribution {
  feature: string;
  label: string;
  value: number; // actual customer value
  baseline: number; // active base median or mean
  contribution: number; // log-odds effect
  percentagePointEffect: number; // converted pp effect
  direction: 'risk' | 'protective';
  narrative: string;
}

export interface ScoredCustomer extends CleanedCustomer {
  churnProbability: number; // Calibrated out-of-fold probability (0-1)
  riskTier: RiskTier;
  expectedMrrAtRiskGbp: number; // churnProbability * monthlyChargeGbp (for active)
  personaId: string;
  personaName: string;
  topRiskDrivers: ShapContribution[];
  topProtectiveFactors: ShapContribution[];
  shapBaseValue: number;
}

export interface DataQualityRuleResult {
  ruleId: string;
  description: string;
  checkedCount: number;
  passedCount: number;
  fixedCount: number;
  quarantinedCount: number;
  severity: 'info' | 'warning' | 'error';
}

export interface DataQualityReport {
  timestamp: string;
  totalRawRows: number;
  validRows: number;
  quarantinedRows: number;
  dedupedCount: number;
  rules: DataQualityRuleResult[];
  quarantinedSamples: Array<{
    customerId: string;
    reason: string;
    rawSnippet: Record<string, any>;
  }>;
  columnMatches: Array<{
    expected: string;
    found: string;
    status: 'matched' | 'aliased' | 'missing' | 'extra';
  }>;
}

export interface ModelMetrics {
  modelName: string;
  rocAuc: number;
  rocAucCi: [number, number];
  prAuc: number;
  prAucCi: [number, number];
  f1Score: number;
  precision: number;
  recall: number;
  top10PercentRecall: number;
  top10PercentPrecision: number;
  brierScore: number;
  ece: number; // Expected Calibration Error
  threshold: number;
  confusionMatrix: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
  };
  curves: {
    roc: Array<{ fpr: number; tpr: number; threshold: number }>;
    pr: Array<{ precision: number; recall: number; threshold: number }>;
    calibration: Array<{ binMid: number; predMean: number; trueMean: number; count: number }>;
    gain: Array<{ percentPopulation: number; percentGain: number; baseline: number }>;
  };
}

export interface CostModelConfig {
  monthsOfValueLost: number; // e.g. 12
  retentionOfferCost: number; // e.g. 30
  assumedSaveRate: number; // e.g. 0.35 (35%)
}

export interface FairnessGroupMetric {
  group: string;
  count: number;
  actualChurnRate: number;
  predictedPositiveRate: number; // Selection rate at threshold
  fpr: number;
  fnr: number;
  averageProbability: number;
}

export interface FairnessAuditResult {
  attribute: string; // 'Gender' | 'Age Band' | 'UK Nation' | 'Customer Segment'
  groups: FairnessGroupMetric[];
  disparateImpactRatio: number; // min rate / max rate
  fairnessVerdict: string;
  passed: boolean;
}

export interface LeakageAuditResult {
  passed: boolean;
  candidateFeatureAuctions: Array<{
    feature: string;
    auc: number;
    flagged: boolean;
  }>;
  shuffledLabelAuc: number;
  forbiddenFieldsChecked: string[];
  quarantinedFields: string[];
  details: string;
}

export interface ModelCard {
  modelVersion: string;
  dataHash: string;
  trainedAt: string;
  trainingRowCount: number;
  testRowCount: number;
  selectedModel: string;
  metrics: ModelMetrics;
  candidateModels: ModelMetrics[];
  outOfTimeRocAuc: number;
  globalFeatureImportance: Array<{ feature: string; label: string; importance: number }>;
  costOptimalThreshold: number;
  leakageAudit: LeakageAuditResult;
  fairnessAudits: FairnessAuditResult[];
  ablationWithQuarantined: {
    standardRocAuc: number;
    quarantinedRocAuc: number;
    featuresAdded: string[];
    riskAssessment: string;
  };
}

export interface PersonaSegment {
  id: string;
  name: string;
  description: string;
  customerCount: number;
  percentageOfActive: number;
  totalMrrGbp: number;
  historicalChurnRate: number;
  averageRiskProbability: number;
  expectedMrrAtRiskGbp: number;
  quadrant: 'Protect' | 'Fix' | 'Nurture' | 'Monitor';
  centroidCharacteristics: Record<string, { mean: number; benchmark: number }>;
}

export interface RetentionOffer {
  id: string;
  name: string;
  category: 'discount' | 'hardware' | 'speed' | 'support' | 'bundle';
  monthlyDiscountGbp?: number;
  oneOffCostGbp: number;
  contractTermMonths?: number;
  description: string;
  idealForDriver: string;
}

export interface RetentionPlan {
  customerId: string;
  generatedAt: string;
  engine: 'gemini' | 'rule_fallback';
  headlineDiagnosis: string;
  rankedRootCauses: Array<{
    rank: number;
    driver: string;
    explanation: string;
  }>;
  bestNextAction: {
    actionTitle: string;
    offer: RetentionOffer;
    channel: 'Call' | 'SMS' | 'Email' | 'App Notification' | 'Store Visit';
    bestTiming: string;
    personalizedScript: string;
    talkingPoints: string[];
    objectionHandling: Array<{ objection: string; counter: string }>;
    expectedSaveProbabilityMin: number;
    expectedSaveProbabilityMax: number;
    offerCostGbp: number;
    expectedNetValueGbp: number;
    escalationPath: string;
  };
  doNotDoGuardrails: string[];
  gdprPecrNotice: string;
}

export interface CampaignCustomerTarget {
  customerId: string;
  monthlyChargeGbp: number;
  initialRiskTier: RiskTier;
  initialProbability: number;
  isControl: boolean; // 10% holdout
  status: 'Planned' | 'Contacted' | 'Responded' | 'Accepted' | 'Declined' | 'No response';
  contactedAt?: string;
  responseAt?: string;
  notes?: string;
  churnedDuringCampaign?: boolean;
  churnDate?: string;
  churnReason?: string;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  targetCriteria: {
    tiers?: RiskTier[];
    serviceTypes?: ServiceType[];
    minMrr?: number;
  };
  offerId: string;
  offerName: string;
  channel: string;
  budgetGbp: number;
  startDate: string;
  endDate: string;
  owner: string;
  createdAt: string;
  holdoutPercentage: number;
  customers: CampaignCustomerTarget[];
  metrics: {
    totalTargeted: number;
    controlCount: number;
    treatmentCount: number;
    contactedCount: number;
    acceptedCount: number;
    treatmentChurnRate: number;
    controlChurnRate: number;
    absoluteUpliftPercentage: number;
    upliftConfidenceInterval: [number, number];
    estimatedSaves: number;
    revenueProtectedGbp: number;
    totalSpendGbp: number;
    costPerSaveGbp: number;
    netRoiGbp: number;
    roiMultiplier: number;
  };
}

export interface WhatIfLevers {
  discountPercent?: number;
  contractType?: ContractType;
  autoRenew?: boolean;
  directDebit?: boolean;
  paymentMethod?: string;
  planName?: string;
  serviceType?: ServiceType;
  resolvedComplaints?: number; // delta
  resolvedTickets?: number;
  networkOutages?: number;
  averageResolutionHours?: number;
  satisfactionScore?: number;
  competitorOfferReceived?: boolean;
}

export interface WhatIfCustomerResult {
  customerId: string;
  baseline: {
    probability: number;
    riskTier: RiskTier;
    monthlyChargeGbp: number;
    expectedMrrAtRiskGbp: number;
  };
  simulated: {
    probability: number;
    riskTier: RiskTier;
    monthlyChargeGbp: number;
    expectedMrrAtRiskGbp: number;
  };
  deltaProbability: number;
  deltaExpectedMrrAtRiskGbp: number;
  estimatedInterventionCostGbp: number;
  netValueGbp: number;
  topDriversDelta: Array<{
    feature: string;
    beforeEffect: number;
    afterEffect: number;
    deltaPp: number;
  }>;
}

export interface WhatIfCohortResult {
  filterSummary: string;
  cohortSize: number;
  baselineMrrGbp: number;
  baselineExpectedMrrAtRiskGbp: number;
  simulatedExpectedMrrAtRiskGbp: number;
  acceptanceRate: number;
  expectedChurnersAvoided: number;
  annualisedRevenueProtectedGbp: number;
  totalCampaignCostGbp: number;
  netRoiGbp: number;
  tierMigration: {
    fromCriticalToLower: number;
    fromHighToLower: number;
    fromMediumToLower: number;
  };
}

export interface PlatformKpis {
  totalCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  overallChurnRate: number; // Churned / Total
  monthlyChurnRate: number; // Latest month rate
  mrrGbp: number; // Sum of active monthly charge
  arpuGbp: number; // MRR / Active
  realisedMrrLostGbp: number; // Sum of churned monthly charge in recent period
  expectedMrrAtRiskGbp: number; // Sum of (prob * monthlyCharge) for active
  annualisedExpectedMrrAtRiskGbp: number; // Expected MRR * 12
  tierBreakdown: Record<RiskTier, { count: number; percentage: number; revenueGbp: number }>;
  averageSatisfaction: number;
  averageNpsScore: number;
  complaintsPer100: number;
  competitorOfferRate: number;
  averageResolutionHours: number;
  autoRenewRate: number;
  directDebitRate: number;
  activeRetentionSaveRate: number;
  activeRetentionRoi: number;
  diffFromPreviousSnapshot?: {
    totalCustomersDelta: number;
    newlyChurnedCount: number;
    tierMoversCount: number;
    expectedMrrAtRiskDelta: number;
  };
}

export interface SnapshotMeta {
  snapshotId: string;
  timestamp: string;
  contentHash: string;
  sourceSheetId: string;
  activeTabName: string;
  rowCount: number;
  activeCount: number;
  churnedCount: number;
  modelVersion: string;
  dataQualityScore: number; // 0-100%
  refreshDurationMs: number;
}
