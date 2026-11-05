import {
  CleanedCustomer,
  ScoredCustomer,
  WhatIfLevers,
  WhatIfCustomerResult,
  WhatIfCohortResult,
  RiskTier,
} from '../../shared/types.js';
import { EnsembleModel, applyPlattScaling } from '../ml/pipeline.js';
import { engineerCustomerFeatures } from '../pipeline/firewall.js';
import { computeLinearShap } from '../explain/shap.js';

export function simulateCustomerWhatIf(
  customer: ScoredCustomer,
  levers: WhatIfLevers,
  ensemble: EnsembleModel
): WhatIfCustomerResult {
  // Create simulated copy of customer with controllable modifications
  const modified: CleanedCustomer = {
    ...customer,
    discountPercent: levers.discountPercent !== undefined ? levers.discountPercent : customer.discountPercent,
    contractType: levers.contractType !== undefined ? levers.contractType : customer.contractType,
    autoRenew: levers.autoRenew !== undefined ? levers.autoRenew : customer.autoRenew,
    directDebit: levers.directDebit !== undefined ? levers.directDebit : customer.directDebit,
    paymentMethod: levers.paymentMethod !== undefined ? levers.paymentMethod : customer.paymentMethod,
    serviceType: levers.serviceType !== undefined ? levers.serviceType : customer.serviceType,
    planName: levers.planName !== undefined ? levers.planName : customer.planName,
    complaints12M: Math.max(0, levers.resolvedComplaints !== undefined ? levers.resolvedComplaints : customer.complaints12M),
    supportTickets12M: Math.max(0, levers.resolvedTickets !== undefined ? levers.resolvedTickets : customer.supportTickets12M),
    networkOutages12M: Math.max(0, levers.networkOutages !== undefined ? levers.networkOutages : customer.networkOutages12M),
    averageResolutionHours: Math.max(0, levers.averageResolutionHours !== undefined ? levers.averageResolutionHours : customer.averageResolutionHours),
    satisfactionScore: levers.satisfactionScore !== undefined ? levers.satisfactionScore : customer.satisfactionScore,
    competitorOfferReceived: levers.competitorOfferReceived !== undefined ? levers.competitorOfferReceived : customer.competitorOfferReceived,
  };

  // Adjust monthly charge if discount changed
  let simulatedMonthlyCharge = customer.monthlyChargeGbp;
  if (levers.discountPercent !== undefined && levers.discountPercent !== customer.discountPercent) {
    const undiscountedCharge = customer.discountPercent > 0
      ? customer.monthlyChargeGbp / (1 - customer.discountPercent / 100)
      : customer.monthlyChargeGbp;
    simulatedMonthlyCharge = Number((undiscountedCharge * (1 - levers.discountPercent / 100)).toFixed(2));
    modified.monthlyChargeGbp = simulatedMonthlyCharge;
  }

  // Score with all folds in the ensemble
  let sumP = 0;
  for (const fold of ensemble.folds) {
    const feat = engineerCustomerFeatures(modified, fold.foldStats, false);
    let z = fold.intercept;
    for (const [k, w] of Object.entries(fold.weights)) {
      z += w * (feat[k] || 0);
    }
    sumP += applyPlattScaling(z, fold.plattA, fold.plattB);
  }
  const newProb = Math.max(0.01, Math.min(0.99, Number((sumP / ensemble.folds.length).toFixed(3))));

  // New tier
  let newTier: RiskTier = 'Low';
  if (newProb >= 0.65) newTier = 'Critical';
  else if (newProb >= 0.40) newTier = 'High';
  else if (newProb >= 0.20) newTier = 'Medium';

  const newExpectedRiskMrr = Number((newProb * simulatedMonthlyCharge).toFixed(2));
  const deltaProb = Number((newProb - customer.churnProbability).toFixed(3));
  const deltaRiskMrr = Number((newExpectedRiskMrr - customer.expectedMrrAtRiskGbp).toFixed(2));

  // Compute intervention cost
  let interventionCost = 0;
  if (levers.discountPercent && levers.discountPercent > customer.discountPercent) {
    // 12 months of additional discount
    interventionCost += (customer.monthlyChargeGbp - simulatedMonthlyCharge) * 12;
  }
  if (levers.networkOutages !== undefined && levers.networkOutages < customer.networkOutages12M) {
    interventionCost += 25; // Speed boost / line re-provisioning
  }
  if (levers.resolvedComplaints !== undefined && levers.resolvedComplaints < customer.complaints12M) {
    interventionCost += 20; // Goodwill gesture / voucher
  }

  // Net annual value protected = (Prob_reduction * Annual MRR) - intervention cost
  const annualRevenueProtected = Math.max(0, -deltaProb * customer.monthlyChargeGbp * 12);
  const netValue = Number((annualRevenueProtected - interventionCost).toFixed(2));

  // Top drivers delta
  const primaryFold = ensemble.folds[0];
  const simulatedFeatVec = engineerCustomerFeatures(modified, primaryFold.foldStats, false);
  const simShap = computeLinearShap(
    simulatedFeatVec,
    primaryFold.weights,
    primaryFold.intercept,
    primaryFold.baselineMeans,
    modified,
    ensemble.activeMedians
  );

  const topDriversDelta = customer.topRiskDrivers.slice(0, 4).map((d) => {
    const simContrib = simShap.contributions[d.feature] ?? d.contribution;
    const simPp = Number((simContrib * 25).toFixed(1));
    return {
      feature: d.label,
      beforeEffect: d.percentagePointEffect,
      afterEffect: simPp,
      deltaPp: Number((simPp - d.percentagePointEffect).toFixed(1)),
    };
  });

  return {
    customerId: customer.customerId,
    baseline: {
      probability: customer.churnProbability,
      riskTier: customer.riskTier,
      monthlyChargeGbp: customer.monthlyChargeGbp,
      expectedMrrAtRiskGbp: customer.expectedMrrAtRiskGbp,
    },
    simulated: {
      probability: newProb,
      riskTier: newTier,
      monthlyChargeGbp: simulatedMonthlyCharge,
      expectedMrrAtRiskGbp: newExpectedRiskMrr,
    },
    deltaProbability: deltaProb,
    deltaExpectedMrrAtRiskGbp: deltaRiskMrr,
    estimatedInterventionCostGbp: Number(interventionCost.toFixed(2)),
    netValueGbp: netValue,
    topDriversDelta,
  };
}

export function simulateCohortWhatIf(
  cohort: ScoredCustomer[],
  levers: WhatIfLevers,
  ensemble: EnsembleModel,
  acceptanceRate = 0.40, // 40% take-up rate
  unitOfferCost = 25
): WhatIfCohortResult {
  const cohortSize = cohort.length;
  if (cohortSize === 0) {
    return {
      filterSummary: 'Selected Cohort',
      cohortSize: 0,
      baselineMrrGbp: 0,
      baselineExpectedMrrAtRiskGbp: 0,
      simulatedExpectedMrrAtRiskGbp: 0,
      acceptanceRate,
      expectedChurnersAvoided: 0,
      annualisedRevenueProtectedGbp: 0,
      totalCampaignCostGbp: 0,
      netRoiGbp: 0,
      tierMigration: { fromCriticalToLower: 0, fromHighToLower: 0, fromMediumToLower: 0 },
    };
  }

  let baselineMrr = 0;
  let baselineRiskMrr = 0;
  let simulatedRiskMrr = 0;
  let totalChurnersAvoided = 0;

  let fromCriticalToLower = 0;
  let fromHighToLower = 0;
  let fromMediumToLower = 0;

  for (const c of cohort) {
    baselineMrr += c.monthlyChargeGbp;
    baselineRiskMrr += c.expectedMrrAtRiskGbp;

    const sim = simulateCustomerWhatIf(c, levers, ensemble);
    const probReduction = Math.max(0, -sim.deltaProbability);
    const effectiveReduction = probReduction * acceptanceRate;

    const postProb = Math.max(0.01, c.churnProbability - effectiveReduction);
    const postRiskMrr = postProb * c.monthlyChargeGbp;
    simulatedRiskMrr += postRiskMrr;

    totalChurnersAvoided += effectiveReduction;

    if (c.riskTier === 'Critical' && sim.simulated.riskTier !== 'Critical') fromCriticalToLower++;
    if (c.riskTier === 'High' && ['Medium', 'Low'].includes(sim.simulated.riskTier)) fromHighToLower++;
    if (c.riskTier === 'Medium' && sim.simulated.riskTier === 'Low') fromMediumToLower++;
  }

  const expectedChurnersAvoided = Math.round(totalChurnersAvoided);
  const avgMonthlyCharge = baselineMrr / cohortSize;
  const annualisedRevenueProtected = Number((totalChurnersAvoided * avgMonthlyCharge * 12).toFixed(2));
  const totalCampaignCost = Number((cohortSize * acceptanceRate * unitOfferCost).toFixed(2));
  const netRoi = Number((annualisedRevenueProtected - totalCampaignCost).toFixed(2));

  return {
    filterSummary: `${cohortSize} Active Customers`,
    cohortSize,
    baselineMrrGbp: Number(baselineMrr.toFixed(2)),
    baselineExpectedMrrAtRiskGbp: Number(baselineRiskMrr.toFixed(2)),
    simulatedExpectedMrrAtRiskGbp: Number(simulatedRiskMrr.toFixed(2)),
    acceptanceRate,
    expectedChurnersAvoided,
    annualisedRevenueProtectedGbp: annualisedRevenueProtected,
    totalCampaignCostGbp: totalCampaignCost,
    netRoiGbp: netRoi,
    tierMigration: {
      fromCriticalToLower,
      fromHighToLower,
      fromMediumToLower,
    },
  };
}
