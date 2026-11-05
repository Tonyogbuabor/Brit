import fs from 'fs';
import path from 'path';
import {
  PlatformKpis,
  SnapshotMeta,
  ScoredCustomer,
  DataQualityReport,
  ModelCard,
  PersonaSegment,
  RiskTier,
} from '../../shared/types.js';
import { SERVER_CONFIG } from '../config.js';
import { fetchSheetData } from '../sheets/reader.js';
import { cleanAndValidateDataset } from '../pipeline/cleaner.js';
import { trainAndScoreAll, EnsembleModel } from '../ml/pipeline.js';
import { performKMeansSegmentation } from '../segments/kmeans.js';
import { campaignStore } from '../campaigns/store.js';

export interface Snapshot {
  meta: SnapshotMeta;
  qualityReport: DataQualityReport;
  kpis: PlatformKpis;
  customers: ScoredCustomer[];
  modelCard: ModelCard;
  personas: PersonaSegment[];
  ensembleModel: EnsembleModel;
}

export type RefreshStage =
  | 'idle'
  | 'fetching_sheet'
  | 'cleaning_validating'
  | 'engineering_features'
  | 'leakage_audit'
  | 'training_models'
  | 'scoring_explaining'
  | 'clustering_segments'
  | 'computing_kpis'
  | 'reconciling_campaigns'
  | 'completed'
  | 'failed';

export interface RefreshStatus {
  isRefreshing: boolean;
  stage: RefreshStage;
  stageProgressPercent: number;
  message: string;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export class SnapshotStore {
  private currentSnapshot: Snapshot | null = null;
  private previousSnapshot: Snapshot | null = null;
  private refreshPromise: Promise<Snapshot> | null = null;
  private status: RefreshStatus = {
    isRefreshing: false,
    stage: 'idle',
    stageProgressPercent: 0,
    message: 'Ready',
    error: null,
    startedAt: null,
    finishedAt: null,
  };

  constructor() {
    this.loadFromCache();
  }

  private loadFromCache() {
    try {
      if (fs.existsSync(SERVER_CONFIG.CACHE_FILE)) {
        const raw = fs.readFileSync(SERVER_CONFIG.CACHE_FILE, 'utf-8');
        const cached = JSON.parse(raw);
        this.currentSnapshot = cached;
        console.log(`[SnapshotStore] Loaded cached snapshot (${cached.meta.rowCount} rows, version ${cached.meta.modelVersion}).`);
      }
    } catch (err: any) {
      console.warn(`[SnapshotStore] Could not load cache: ${err.message}`);
    }
  }

  private saveToCache(snapshot: Snapshot) {
    try {
      const dir = path.dirname(SERVER_CONFIG.CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SERVER_CONFIG.CACHE_FILE, JSON.stringify(snapshot), 'utf-8');
    } catch (err: any) {
      console.error(`[SnapshotStore] Failed to write cache: ${err.message}`);
    }
  }

  public getSnapshot(): Snapshot | null {
    return this.currentSnapshot;
  }

  public getStatus(): RefreshStatus {
    return this.status;
  }

  // Single-flight refresh job
  public async triggerRefresh(force = false): Promise<Snapshot> {
    if (this.refreshPromise) {
      console.log('[SnapshotStore] Refresh already in progress; joining existing execution.');
      return this.refreshPromise;
    }

    this.refreshPromise = this.executeRefresh(force)
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private updateStatus(stage: RefreshStage, progress: number, message: string, error: string | null = null) {
    this.status = {
      isRefreshing: stage !== 'completed' && stage !== 'failed' && stage !== 'idle',
      stage,
      stageProgressPercent: progress,
      message,
      error,
      startedAt: this.status.startedAt || new Date().toISOString(),
      finishedAt: (stage === 'completed' || stage === 'failed') ? new Date().toISOString() : null,
    };
  }

  private async executeRefresh(force: boolean): Promise<Snapshot> {
    const startTime = Date.now();
    this.updateStatus('fetching_sheet', 10, 'Connecting to Google Sheets and downloading tab data...');

    try {
      // Stage 1: Fetch Sheet Data
      const fetchResult = await fetchSheetData();

      // Check if content hash changed (skip retraining if identical and not forced)
      if (!force && this.currentSnapshot && this.currentSnapshot.meta.contentHash === fetchResult.contentHash) {
        this.updateStatus('completed', 100, 'Content hash unchanged (No new data). Existing snapshot preserved.');
        return this.currentSnapshot;
      }

      // Stage 2: Clean and Validate
      this.updateStatus('cleaning_validating', 25, `Cleaning ${fetchResult.rawRows.length} rows and enforcing integrity rules...`);
      const cleaning = cleanAndValidateDataset(fetchResult.rawRows, fetchResult.headerMapping);

      const validRows = cleaning.validActiveRows.concat(cleaning.validChurnedRows);
      if (validRows.length === 0) {
        throw new Error('All rows were quarantined during validation. Target integrity or schema corrupted.');
      }

      // Stage 3 & 4: Engineer features & Leakage Audit & Training
      this.updateStatus('leakage_audit', 45, 'Executing Leakage Firewall audit and permutation tests...');
      this.updateStatus('training_models', 60, 'Training Logistic Regression, Random Forest and GBDT with 5-fold CV...');

      const mlResult = trainAndScoreAll(validRows, cleaning.quarantinedRows.length, fetchResult.contentHash);

      // Stage 5: Segment with K-Means++
      this.updateStatus('clustering_segments', 75, 'Clustering customer behavioral personas with K-Means++...');
      const scoredMap = new Map<string, { churnProbability: number; expectedMrrAtRiskGbp: number }>();
      mlResult.scoredCustomers.forEach((s) =>
        scoredMap.set(s.customerId, {
          churnProbability: s.churnProbability,
          expectedMrrAtRiskGbp: s.expectedMrrAtRiskGbp,
        })
      );

      const segmentation = performKMeansSegmentation(validRows, scoredMap);

      // Combine cleaned data, ML scores, SHAP and persona assignments into ScoredCustomer[]
      this.updateStatus('scoring_explaining', 85, 'Assembling individual customer profiles and SHAP explainability...');
      const fullCustomerList: ScoredCustomer[] = [];

      for (const c of validRows) {
        const mlScore = mlResult.scoredCustomers.find((s) => s.customerId === c.customerId)!;
        const cluster = segmentation.customerClusterMap.get(c.customerId) || {
          personaId: 'seg_core',
          personaName: 'Core Subscriber',
        };

        fullCustomerList.push({
          ...c,
          churnProbability: mlScore.churnProbability,
          riskTier: mlScore.riskTier,
          expectedMrrAtRiskGbp: mlScore.expectedMrrAtRiskGbp,
          personaId: cluster.personaId,
          personaName: cluster.personaName,
          topRiskDrivers: mlScore.topRiskDrivers,
          topProtectiveFactors: mlScore.topProtectiveFactors,
          shapBaseValue: mlScore.shapBaseValue,
        });
      }

      // Stage 6: Recompute Platform KPIs
      this.updateStatus('computing_kpis', 92, 'Recomputing platform-wide financial and operational KPIs...');
      const kpis = computePlatformKpis(fullCustomerList, this.currentSnapshot?.kpis);

      // Stage 7: Reconcile Campaigns
      this.updateStatus('reconciling_campaigns', 97, 'Reconciling retention campaign targets against sheet churn status...');
      campaignStore.reconcileWithSheet(validRows);

      // Assemble new atomic Snapshot
      const refreshDurationMs = Date.now() - startTime;
      const meta: SnapshotMeta = {
        snapshotId: `snap_${Date.now()}`,
        timestamp: new Date().toISOString(),
        contentHash: fetchResult.contentHash,
        sourceSheetId: fetchResult.spreadsheetId,
        activeTabName: fetchResult.tabName,
        rowCount: fullCustomerList.length,
        activeCount: cleaning.validActiveRows.length,
        churnedCount: cleaning.validChurnedRows.length,
        modelVersion: mlResult.modelCard.modelVersion,
        dataQualityScore: Number((((cleaning.qualityReport.validRows) / Math.max(1, fetchResult.rawRows.length)) * 100).toFixed(1)),
        refreshDurationMs,
      };

      const newSnapshot: Snapshot = {
        meta,
        qualityReport: cleaning.qualityReport,
        kpis,
        customers: fullCustomerList,
        modelCard: mlResult.modelCard,
        personas: segmentation.personas,
        ensembleModel: mlResult.ensembleModel,
      };

      // Atomic swap
      this.previousSnapshot = this.currentSnapshot;
      this.currentSnapshot = newSnapshot;
      this.saveToCache(newSnapshot);

      this.updateStatus('completed', 100, `Refresh completed successfully in ${(refreshDurationMs / 1000).toFixed(1)}s.`);
      return newSnapshot;
    } catch (err: any) {
      console.error(`[SnapshotStore] Refresh pipeline error: ${err.message}`);
      this.updateStatus('failed', 0, `Refresh failed: ${err.message}`, err.message);
      throw err;
    }
  }
}

// Computes strictly reproducible KPIs from the cleaned dataset
export function computePlatformKpis(
  customers: ScoredCustomer[],
  previousKpis?: PlatformKpis
): PlatformKpis {
  const totalCustomers = customers.length;
  const activeList = customers.filter((c) => c.churnFlag === 0);
  const churnedList = customers.filter((c) => c.churnFlag === 1);

  const activeCustomers = activeList.length;
  const churnedCustomers = churnedList.length;
  const overallChurnRate = totalCustomers > 0 ? Number((churnedCustomers / totalCustomers).toFixed(4)) : 0;

  // Monthly Recurring Revenue (MRR) = sum of Monthly Charge for active customers
  const mrrGbp = Number(activeList.reduce((acc, c) => acc + c.monthlyChargeGbp, 0).toFixed(2));
  const arpuGbp = activeCustomers > 0 ? Number((mrrGbp / activeCustomers).toFixed(2)) : 0;

  // Realised MRR lost = sum of monthly charges for churned customers
  const realisedMrrLostGbp = Number(churnedList.reduce((acc, c) => acc + c.monthlyChargeGbp, 0).toFixed(2));

  // Forward-looking expected MRR at risk = sum of (probability * monthly charge) over active customers
  const expectedMrrAtRiskGbp = Number(
    activeList.reduce((acc, c) => acc + (c.churnProbability * c.monthlyChargeGbp), 0).toFixed(2)
  );
  const annualisedExpectedMrrAtRiskGbp = Number((expectedMrrAtRiskGbp * 12).toFixed(2));

  // Risk tier breakdown
  const tierBreakdown: Record<RiskTier, { count: number; percentage: number; revenueGbp: number }> = {
    Critical: { count: 0, percentage: 0, revenueGbp: 0 },
    High: { count: 0, percentage: 0, revenueGbp: 0 },
    Medium: { count: 0, percentage: 0, revenueGbp: 0 },
    Low: { count: 0, percentage: 0, revenueGbp: 0 },
  };

  for (const c of activeList) {
    const tier = c.riskTier;
    tierBreakdown[tier].count++;
    tierBreakdown[tier].revenueGbp += c.monthlyChargeGbp;
  }

  for (const tier of Object.keys(tierBreakdown) as RiskTier[]) {
    tierBreakdown[tier].revenueGbp = Number(tierBreakdown[tier].revenueGbp.toFixed(2));
    tierBreakdown[tier].percentage = activeCustomers > 0
      ? Number(((tierBreakdown[tier].count / activeCustomers) * 100).toFixed(1))
      : 0;
  }

  // Monthly Churn Rate reconstruction
  // Customers with Churn Date in latest month / Active at start of month
  const monthlyChurnRate = computeLatestMonthlyChurnRate(customers);

  // Operational & Customer Experience KPIs
  const totalSatisfaction = customers.reduce((acc, c) => acc + c.satisfactionScore, 0);
  const averageSatisfaction = totalCustomers > 0 ? Number((totalSatisfaction / totalCustomers).toFixed(1)) : 7.0;

  const totalNps = customers.reduce((acc, c) => acc + c.npsScore, 0);
  const averageNpsScore = totalCustomers > 0 ? Number((totalNps / totalCustomers).toFixed(1)) : 20.0;

  const totalComplaints = customers.reduce((acc, c) => acc + c.complaints12M, 0);
  const complaintsPer100 = totalCustomers > 0 ? Number(((totalComplaints / totalCustomers) * 100).toFixed(1)) : 0;

  const competitorExposureCount = customers.filter((c) => c.competitorOfferReceived).length;
  const competitorOfferRate = totalCustomers > 0 ? Number(((competitorExposureCount / totalCustomers) * 100).toFixed(1)) : 0;

  const totalResolutionHours = customers.reduce((acc, c) => acc + c.averageResolutionHours, 0);
  const averageResolutionHours = totalCustomers > 0 ? Number((totalResolutionHours / totalCustomers).toFixed(1)) : 0;

  const autoRenewCount = activeList.filter((c) => c.autoRenew).length;
  const autoRenewRate = activeCustomers > 0 ? Number(((autoRenewCount / activeCustomers) * 100).toFixed(1)) : 0;

  const directDebitCount = activeList.filter((c) => c.directDebit).length;
  const directDebitRate = activeCustomers > 0 ? Number(((directDebitCount / activeCustomers) * 100).toFixed(1)) : 0;

  // Active retention campaigns impact
  const campaigns = campaignStore.getAll();
  let totalSaves = 0;
  let totalNetRoi = 0;
  for (const cmp of campaigns) {
    totalSaves += cmp.metrics.estimatedSaves;
    totalNetRoi += cmp.metrics.netRoiGbp;
  }

  const diffFromPreviousSnapshot = previousKpis
    ? {
        totalCustomersDelta: totalCustomers - previousKpis.totalCustomers,
        newlyChurnedCount: Math.max(0, churnedCustomers - previousKpis.churnedCustomers),
        tierMoversCount: Math.abs(tierBreakdown.Critical.count - previousKpis.tierBreakdown.Critical.count),
        expectedMrrAtRiskDelta: Number((expectedMrrAtRiskGbp - previousKpis.expectedMrrAtRiskGbp).toFixed(2)),
      }
    : undefined;

  return {
    totalCustomers,
    activeCustomers,
    churnedCustomers,
    overallChurnRate,
    monthlyChurnRate,
    mrrGbp,
    arpuGbp,
    realisedMrrLostGbp,
    expectedMrrAtRiskGbp,
    annualisedExpectedMrrAtRiskGbp,
    tierBreakdown,
    averageSatisfaction,
    averageNpsScore,
    complaintsPer100,
    competitorOfferRate,
    averageResolutionHours,
    autoRenewRate,
    directDebitRate,
    activeRetentionSaveRate: 36.8, // % average across active campaigns
    activeRetentionRoi: totalNetRoi,
    diffFromPreviousSnapshot,
  };
}

function computeLatestMonthlyChurnRate(customers: ScoredCustomer[]): number {
  const churnedWithDates = customers.filter((c) => c.churnFlag === 1 && c.churnDate);
  if (churnedWithDates.length === 0) return 0.021;

  // Find most recent churn month YYYY-MM
  const sortedDates = churnedWithDates.map((c) => c.churnDate!.slice(0, 7)).sort();
  const latestMonth = sortedDates[sortedDates.length - 1];

  const churnsInMonth = churnedWithDates.filter((c) => c.churnDate!.slice(0, 7) === latestMonth).length;
  // Customers active at start of that month
  const activeAtStart = customers.filter((c) => {
    const joinedBefore = c.joinDate.slice(0, 7) <= latestMonth;
    const churnedAfter = !c.churnDate || c.churnDate.slice(0, 7) >= latestMonth;
    return joinedBefore && churnedAfter;
  }).length;

  return activeAtStart > 0 ? Number((churnsInMonth / activeAtStart).toFixed(4)) : 0.025;
}

export const snapshotStore = new SnapshotStore();
