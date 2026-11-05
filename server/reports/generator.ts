import ExcelJS from 'exceljs';
import { Snapshot } from '../snapshot/store.js';
import { campaignStore } from '../campaigns/store.js';

export async function generateExcelReport(snapshot: Snapshot, filters?: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BritConnect AI Churn Intelligence Platform';
  workbook.lastModifiedBy = 'BritConnect Engine';
  workbook.created = new Date();

  // 1. Sheet: Scored Customers
  const wsCustomers = workbook.addWorksheet('Scored Customers');
  wsCustomers.columns = [
    { header: 'Customer ID', key: 'customerId', width: 16 },
    { header: 'Segment', key: 'segment', width: 16 },
    { header: 'Service Type', key: 'serviceType', width: 22 },
    { header: 'Contract Type', key: 'contractType', width: 18 },
    { header: 'Monthly Charge (£)', key: 'monthlyCharge', width: 18 },
    { header: 'Churn Status', key: 'churnStatus', width: 14 },
    { header: 'Churn Probability', key: 'probability', width: 18 },
    { header: 'Risk Tier', key: 'riskTier', width: 14 },
    { header: 'Expected MRR At Risk (£)', key: 'expectedRiskMrr', width: 24 },
    { header: 'Persona Segment', key: 'persona', width: 24 },
    { header: 'Top Risk Driver', key: 'topDriver', width: 36 },
  ];

  // Filter if requested
  let customerList = snapshot.customers;
  if (filters?.riskTier) customerList = customerList.filter((c) => c.riskTier === filters.riskTier);
  if (filters?.serviceType) customerList = customerList.filter((c) => c.serviceType === filters.serviceType);

  customerList.forEach((c) => {
    wsCustomers.addRow({
      customerId: c.customerId,
      segment: c.customerSegment,
      serviceType: c.serviceType,
      contractType: c.contractType,
      monthlyCharge: c.monthlyChargeGbp,
      churnStatus: c.churnStatus,
      probability: Number((c.churnProbability * 100).toFixed(1)) + '%',
      riskTier: c.riskTier,
      expectedRiskMrr: c.expectedMrrAtRiskGbp,
      persona: c.personaName,
      topDriver: c.topRiskDrivers[0]?.narrative || 'None',
    });
  });

  // 2. Sheet: At-Risk Call List (Critical & High risk active accounts)
  const wsCallList = workbook.addWorksheet('At-Risk Call List');
  wsCallList.columns = [
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Customer ID', key: 'customerId', width: 16 },
    { header: 'Service Type', key: 'serviceType', width: 22 },
    { header: 'Monthly Charge (£)', key: 'monthlyCharge', width: 18 },
    { header: 'Risk Tier', key: 'riskTier', width: 14 },
    { header: 'Churn Probability', key: 'probability', width: 18 },
    { header: 'Expected MRR At Risk (£)', key: 'expectedRiskMrr', width: 24 },
    { header: 'Primary Root Cause', key: 'rootCause', width: 40 },
    { header: 'Recommended Outreach Channel', key: 'channel', width: 24 },
  ];

  const atRisk = snapshot.customers
    .filter((c) => c.churnFlag === 0 && ['Critical', 'High'].includes(c.riskTier))
    .sort((a, b) => b.expectedMrrAtRiskGbp - a.expectedMrrAtRiskGbp);

  atRisk.forEach((c, idx) => {
    wsCallList.addRow({
      priority: idx + 1,
      customerId: c.customerId,
      serviceType: c.serviceType,
      monthlyCharge: c.monthlyChargeGbp,
      riskTier: c.riskTier,
      probability: Number((c.churnProbability * 100).toFixed(1)) + '%',
      expectedRiskMrr: c.expectedMrrAtRiskGbp,
      rootCause: c.topRiskDrivers[0]?.narrative || 'General friction',
      channel: c.monthlyChargeGbp > 50 ? 'Outbound Call' : 'SMS / Email Notification',
    });
  });

  // 3. Sheet: Segment Summary
  const wsSegments = workbook.addWorksheet('Segment Summary');
  wsSegments.columns = [
    { header: 'Persona Name', key: 'name', width: 28 },
    { header: 'Value x Risk Quadrant', key: 'quadrant', width: 22 },
    { header: 'Customer Count', key: 'count', width: 16 },
    { header: '% of Active Base', key: 'pct', width: 16 },
    { header: 'Total MRR (£)', key: 'mrr', width: 18 },
    { header: 'Average Churn Risk', key: 'avgRisk', width: 18 },
    { header: 'Expected MRR At Risk (£)', key: 'riskMrr', width: 24 },
  ];

  snapshot.personas.forEach((p) => {
    wsSegments.addRow({
      name: p.name,
      quadrant: p.quadrant,
      count: p.customerCount,
      pct: `${p.percentageOfActive}%`,
      mrr: p.totalMrrGbp,
      avgRisk: `${(p.averageRiskProbability * 100).toFixed(1)}%`,
      riskMrr: p.expectedMrrAtRiskGbp,
    });
  });

  // 4. Sheet: Model Metrics
  const wsModel = workbook.addWorksheet('Model Metrics');
  wsModel.columns = [
    { header: 'Metric', key: 'metric', width: 32 },
    { header: 'Value', key: 'value', width: 24 },
    { header: 'Notes', key: 'notes', width: 44 },
  ];
  wsModel.addRow({ metric: 'Model Algorithm', value: snapshot.modelCard.selectedModel, notes: 'Class-weighted with Platt probability calibration' });
  wsModel.addRow({ metric: 'Model Version', value: snapshot.modelCard.modelVersion, notes: `Snapshot hash: ${snapshot.meta.contentHash.slice(0, 12)}` });
  wsModel.addRow({ metric: 'Test ROC-AUC', value: snapshot.modelCard.metrics.rocAuc, notes: `95% CI: [${snapshot.modelCard.metrics.rocAucCi.join(', ')}]` });
  wsModel.addRow({ metric: 'Test PR-AUC', value: snapshot.modelCard.metrics.prAuc, notes: `95% CI: [${snapshot.modelCard.metrics.prAucCi.join(', ')}]` });
  wsModel.addRow({ metric: 'F1 Score', value: snapshot.modelCard.metrics.f1Score, notes: `At optimal decision threshold ${snapshot.modelCard.costOptimalThreshold}` });
  wsModel.addRow({ metric: 'Top 10% Risk Recall', value: `${(snapshot.modelCard.metrics.top10PercentRecall * 100).toFixed(1)}%`, notes: 'Recall among highest risk decile' });
  wsModel.addRow({ metric: 'Expected Calibration Error (ECE)', value: snapshot.modelCard.metrics.ece, notes: '10-bin reliability diagram calibration error' });

  // 5. Sheet: Data Quality Report
  const wsQuality = workbook.addWorksheet('Data Quality');
  wsQuality.columns = [
    { header: 'Rule ID', key: 'ruleId', width: 20 },
    { header: 'Description', key: 'description', width: 44 },
    { header: 'Checked', key: 'checked', width: 14 },
    { header: 'Passed', key: 'passed', width: 14 },
    { header: 'Fixed / Normalized', key: 'fixed', width: 18 },
    { header: 'Quarantined', key: 'quarantined', width: 16 },
  ];

  snapshot.qualityReport.rules.forEach((r) => {
    wsQuality.addRow({
      ruleId: r.ruleId,
      description: r.description,
      checked: r.checkedCount,
      passed: r.passedCount,
      fixed: r.fixedCount,
      quarantined: r.quarantinedCount,
    });
  });

  // 6. Sheet: Campaigns
  const wsCampaigns = workbook.addWorksheet('Campaigns');
  wsCampaigns.columns = [
    { header: 'Campaign ID', key: 'id', width: 20 },
    { header: 'Name', key: 'name', width: 32 },
    { header: 'Channel', key: 'channel', width: 18 },
    { header: 'Targeted', key: 'targeted', width: 12 },
    { header: 'Treatment Churn %', key: 'treatChurn', width: 18 },
    { header: 'Control Churn %', key: 'ctrlChurn', width: 16 },
    { header: 'Uplift %', key: 'uplift', width: 14 },
    { header: 'Estimated Saves', key: 'saves', width: 16 },
    { header: 'Revenue Protected (£)', key: 'revProt', width: 22 },
    { header: 'Net ROI (£)', key: 'roi', width: 16 },
  ];

  campaignStore.getAll().forEach((c) => {
    wsCampaigns.addRow({
      id: c.id,
      name: c.name,
      channel: c.channel,
      targeted: c.metrics.totalTargeted,
      treatChurn: `${(c.metrics.treatmentChurnRate * 100).toFixed(1)}%`,
      ctrlChurn: `${(c.metrics.controlChurnRate * 100).toFixed(1)}%`,
      uplift: `+${c.metrics.absoluteUpliftPercentage}%`,
      saves: c.metrics.estimatedSaves,
      revProt: c.metrics.revenueProtectedGbp,
      roi: c.metrics.netRoiGbp,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
