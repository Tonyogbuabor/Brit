import { ShapContribution, CleanedCustomer } from '../../shared/types.js';
import { FEATURE_LABELS } from '../pipeline/firewall.js';

export interface ShapResult {
  baseValue: number; // Log-odds intercept or baseline
  contributions: Record<string, number>; // feature -> log-odds contribution
  topRiskDrivers: ShapContribution[];
  topProtectiveFactors: ShapContribution[];
}

export function computeLinearShap(
  featureVector: Record<string, number>,
  weights: Record<string, number>,
  intercept: number,
  baselineMeans: Record<string, number>,
  customer: CleanedCustomer,
  activeMedians: Record<string, number>
): ShapResult {
  const contributions: Record<string, number> = {};
  const allDrivers: ShapContribution[] = [];

  let totalLogOdds = intercept;

  for (const [feat, weight] of Object.entries(weights)) {
    const x = featureVector[feat] ?? 0;
    const baseline = baselineMeans[feat] ?? 0;
    const phi = weight * (x - baseline);
    contributions[feat] = phi;
    totalLogOdds += phi;

    // Convert log-odds contribution to approximate percentage-point impact
    // derivative of sigmoid(z) at z=0 is 0.25 (or calculate delta sigmoid)
    const ppEffect = Number((phi * 25).toFixed(1)); // 0.1 log-odds ~ 2.5 pp
    const label = FEATURE_LABELS[feat] || feat.replace(/_/g, ' ');

    let direction: 'risk' | 'protective' = phi >= 0 ? 'risk' : 'protective';

    // Business language narrative
    const humanValue = formatFeatureHumanValue(feat, x);
    const medianVal = formatFeatureHumanValue(feat, activeMedians[feat] ?? baseline);
    const narrative = `${label}: ${humanValue} (${phi >= 0 ? '+' : ''}${ppEffect} pts vs base ${medianVal})`;

    allDrivers.push({
      feature: feat,
      label,
      value: x,
      baseline: activeMedians[feat] ?? baseline,
      contribution: Number(phi.toFixed(4)),
      percentagePointEffect: ppEffect,
      direction,
      narrative,
    });
  }

  // Sort by contribution
  const riskDrivers = allDrivers
    .filter((d) => d.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);

  const protectiveFactors = allDrivers
    .filter((d) => d.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 3);

  return {
    baseValue: intercept,
    contributions,
    topRiskDrivers: riskDrivers,
    topProtectiveFactors: protectiveFactors,
  };
}

// Unit-testable check for additivity:
// Base value + sum(contributions) === model raw output log-odds
export function verifyShapAdditivity(baseValue: number, contributions: Record<string, number>, rawOutput: number): boolean {
  const sumOfContribs = Object.values(contributions).reduce((acc, v) => acc + v, 0);
  const total = baseValue + sumOfContribs;
  const diff = Math.abs(total - rawOutput);
  return diff <= 1e-6;
}

function formatFeatureHumanValue(feat: string, val: number): string {
  if (feat.includes('flag') || feat.includes('is_') || feat.includes('direct_debit') || feat.includes('auto_renew') || feat.includes('competitor_offer')) {
    return val === 1 ? 'Yes' : 'No';
  }
  if (feat.includes('charge') || feat.includes('price') || feat.includes('amount')) {
    return `£${val.toFixed(2)}`;
  }
  if (feat.includes('discount') || feat.includes('depth')) {
    return `${val}%`;
  }
  if (feat.includes('term') || feat.includes('months')) {
    return `${val}M`;
  }
  if (feat.includes('ratio') || feat.includes('utilisation')) {
    return `${(val * 100).toFixed(0)}%`;
  }
  return String(Number(val.toFixed(1)));
}
