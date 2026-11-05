import fs from 'fs';
import path from 'path';
import { Campaign, CampaignCustomerTarget, CleanedCustomer, ScoredCustomer } from '../../shared/types.js';
import { SERVER_CONFIG } from '../config.js';

export class CampaignStore {
  private filePath: string;
  private campaigns: Map<string, Campaign> = new Map();

  constructor(filePath = SERVER_CONFIG.CAMPAIGNS_FILE) {
    this.filePath = filePath;
    this.init();
  }

  private init() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: Campaign[] = JSON.parse(raw);
        for (const c of list) {
          this.campaigns.set(c.id, c);
        }
      } else {
        // Seed initial campaign demonstration
        this.seedInitialCampaign();
      }
    } catch (err: any) {
      console.warn(`[CampaignStore] Failed to load from file: ${err.message}`);
    }
  }

  private save() {
    try {
      const list = Array.from(this.campaigns.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err: any) {
      console.error(`[CampaignStore] Failed to save campaigns: ${err.message}`);
    }
  }

  private seedInitialCampaign() {
    const initialCampaign: Campaign = {
      id: 'CMP-2026-Q4-ROLLING',
      name: 'Q4 Rolling Contract Loyalty Lock-In',
      objective: 'Convert price-sensitive rolling monthly customers to 12-month fixed terms with 10% discount',
      targetCriteria: {
        tiers: ['Critical', 'High'],
        minMrr: 25,
      },
      offerId: 'OFFER_LOYALTY_10',
      offerName: '10% Retention Loyalty Discount (12M)',
      channel: 'Outbound Call & SMS',
      budgetGbp: 15000,
      startDate: '2026-10-01',
      endDate: '2026-12-15',
      owner: 'Sarah Jenkins (Head of Retention)',
      createdAt: new Date().toISOString(),
      holdoutPercentage: 10,
      customers: [],
      metrics: {
        totalTargeted: 350,
        controlCount: 35,
        treatmentCount: 315,
        contactedCount: 280,
        acceptedCount: 126,
        treatmentChurnRate: 0.142,
        controlChurnRate: 0.286,
        absoluteUpliftPercentage: 14.4,
        upliftConfidenceInterval: [7.8, 21.0],
        estimatedSaves: 45,
        revenueProtectedGbp: 18900,
        totalSpendGbp: 4200,
        costPerSaveGbp: 93.33,
        netRoiGbp: 14700,
        roiMultiplier: 4.5,
      },
    };
    this.campaigns.set(initialCampaign.id, initialCampaign);
    this.save();
  }

  public getAll(): Campaign[] {
    return Array.from(this.campaigns.values());
  }

  public getById(id: string): Campaign | undefined {
    return this.campaigns.get(id);
  }

  public createCampaign(
    campaignData: Omit<Campaign, 'id' | 'createdAt' | 'metrics' | 'customers'>,
    targetCustomers: ScoredCustomer[]
  ): Campaign {
    const id = `CMP-${Date.now().toString(36).toUpperCase()}`;
    const holdoutPct = campaignData.holdoutPercentage || 10;

    // Freeze customer list with current risk and assign random holdout control
    const campaignCustomers: CampaignCustomerTarget[] = targetCustomers.map((c) => {
      const isControl = Math.random() * 100 < holdoutPct;
      return {
        customerId: c.customerId,
        monthlyChargeGbp: c.monthlyChargeGbp,
        initialRiskTier: c.riskTier,
        initialProbability: c.churnProbability,
        isControl,
        status: isControl ? 'Planned' : 'Planned',
      };
    });

    const newCampaign: Campaign = {
      ...campaignData,
      id,
      createdAt: new Date().toISOString(),
      holdoutPercentage: holdoutPct,
      customers: campaignCustomers,
      metrics: this.computeMetrics(campaignCustomers, campaignData.budgetGbp),
    };

    this.campaigns.set(id, newCampaign);
    this.save();
    return newCampaign;
  }

  public updateCustomerStatus(
    campaignId: string,
    customerId: string,
    status: CampaignCustomerTarget['status'],
    notes?: string
  ): Campaign | undefined {
    const c = this.campaigns.get(campaignId);
    if (!c) return undefined;

    const target = c.customers.find((cust) => cust.customerId === customerId);
    if (target) {
      target.status = status;
      if (notes !== undefined) target.notes = notes;
      if (status === 'Contacted' && !target.contactedAt) {
        target.contactedAt = new Date().toISOString();
      }
      if (['Accepted', 'Declined', 'Responded'].includes(status) && !target.responseAt) {
        target.responseAt = new Date().toISOString();
      }
    }

    c.metrics = this.computeMetrics(c.customers, c.budgetGbp);
    this.save();
    return c;
  }

  // Bulk outcome CSV upload reconciliation
  public uploadOutcomesCsv(
    campaignId: string,
    outcomes: Array<{ customerId: string; status: CampaignCustomerTarget['status']; notes?: string }>
  ): Campaign | undefined {
    const c = this.campaigns.get(campaignId);
    if (!c) return undefined;

    for (const item of outcomes) {
      const target = c.customers.find((cust) => cust.customerId === item.customerId);
      if (target) {
        target.status = item.status;
        if (item.notes) target.notes = item.notes;
        target.responseAt = new Date().toISOString();
      }
    }

    c.metrics = this.computeMetrics(c.customers, c.budgetGbp);
    this.save();
    return c;
  }

  // Reconcile with Google Sheet on every refresh
  public reconcileWithSheet(cleanedCustomers: CleanedCustomer[]) {
    const statusMap = new Map<string, CleanedCustomer>();
    for (const c of cleanedCustomers) {
      statusMap.set(c.customerId, c);
    }

    let changed = false;
    for (const campaign of this.campaigns.values()) {
      for (const target of campaign.customers) {
        const sheetRecord = statusMap.get(target.customerId);
        if (sheetRecord && sheetRecord.churnFlag === 1 && !target.churnedDuringCampaign) {
          target.churnedDuringCampaign = true;
          target.churnDate = sheetRecord.churnDate || undefined;
          target.churnReason = sheetRecord.churnReason || undefined;
          changed = true;
        }
      }
      if (changed) {
        campaign.metrics = this.computeMetrics(campaign.customers, campaign.budgetGbp);
      }
    }

    if (changed) {
      this.save();
    }
  }

  private computeMetrics(customers: CampaignCustomerTarget[], budgetGbp: number) {
    const totalTargeted = customers.length;
    const control = customers.filter((c) => c.isControl);
    const treatment = customers.filter((c) => !c.isControl);

    const controlCount = control.length;
    const treatmentCount = treatment.length;

    const contactedCount = treatment.filter((c) => c.status !== 'Planned').length;
    const acceptedCount = treatment.filter((c) => c.status === 'Accepted').length;

    // Churn rates
    const controlChurned = control.filter((c) => c.churnedDuringCampaign).length;
    const treatmentChurned = treatment.filter((c) => c.churnedDuringCampaign).length;

    const controlChurnRate = controlCount > 0 ? controlChurned / controlCount : 0.25;
    const treatmentChurnRate = treatmentCount > 0 ? treatmentChurned / treatmentCount : 0.15;

    // Uplift = Control Churn Rate - Treatment Churn Rate
    const absoluteUplift = Number(((controlChurnRate - treatmentChurnRate) * 100).toFixed(1));
    const se = Math.sqrt(
      (controlChurnRate * (1 - controlChurnRate)) / Math.max(1, controlCount) +
        (treatmentChurnRate * (1 - treatmentChurnRate)) / Math.max(1, treatmentCount)
    );
    const upliftCi: [number, number] = [
      Number((absoluteUplift - 1.96 * se * 100).toFixed(1)),
      Number((absoluteUplift + 1.96 * se * 100).toFixed(1)),
    ];

    const estimatedSaves = Math.max(0, Math.round((absoluteUplift / 100) * treatmentCount));
    const avgMonthlyCharge = treatmentCount > 0 ? treatment.reduce((acc, c) => acc + c.monthlyChargeGbp, 0) / treatmentCount : 35;
    const revenueProtected = Number((estimatedSaves * avgMonthlyCharge * 12).toFixed(2));
    const totalSpend = Number(Math.min(budgetGbp, contactedCount * 15).toFixed(2));
    const costPerSave = estimatedSaves > 0 ? Number((totalSpend / estimatedSaves).toFixed(2)) : 0;
    const netRoi = Number((revenueProtected - totalSpend).toFixed(2));
    const roiMultiplier = totalSpend > 0 ? Number((revenueProtected / totalSpend).toFixed(1)) : 1;

    return {
      totalTargeted,
      controlCount,
      treatmentCount,
      contactedCount,
      acceptedCount,
      treatmentChurnRate: Number(treatmentChurnRate.toFixed(3)),
      controlChurnRate: Number(controlChurnRate.toFixed(3)),
      absoluteUpliftPercentage: absoluteUplift,
      upliftConfidenceInterval: upliftCi,
      estimatedSaves,
      revenueProtectedGbp: revenueProtected,
      totalSpendGbp: totalSpend,
      costPerSaveGbp: costPerSave,
      netRoiGbp: netRoi,
      roiMultiplier,
    };
  }
}

export const campaignStore = new CampaignStore();
