import {
  PlatformKpis,
  SnapshotMeta,
  ScoredCustomer,
  ModelCard,
  PersonaSegment,
  DataQualityReport,
  Campaign,
  WhatIfCustomerResult,
  WhatIfCohortResult,
  RetentionPlan,
} from '../../shared/types.js';

export interface GlobalFilterState {
  serviceType: string;
  contractType: string;
  customerSegment: string;
  ukNation: string;
}

export async function fetchHealth(): Promise<{ status: string; snapshotLoaded: boolean; lastRefreshed: string; rowCount: number; isRefreshing: boolean }> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Failed to fetch platform health');
  return res.json();
}

export async function fetchSnapshotMeta(): Promise<{ meta: SnapshotMeta | null; qualityScore: number; status: any; isInitializing?: boolean; error?: string | null }> {
  const res = await fetch('/api/snapshot/meta');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Server is initializing connection to primary Google Sheet...');
  }
  return res.json();
}

export async function fetchRefreshStatus(): Promise<any> {
  const res = await fetch('/api/refresh/status');
  if (!res.ok) throw new Error('Failed to fetch refresh status');
  return res.json();
}

export async function triggerRefresh(force = false): Promise<any> {
  const res = await fetch(`/api/refresh?force=${force}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to trigger refresh');
  }
  return res.json();
}

export async function fetchKpis(filters?: Partial<GlobalFilterState>): Promise<PlatformKpis> {
  const params = new URLSearchParams();
  if (filters?.serviceType && filters.serviceType !== 'All') params.set('serviceType', filters.serviceType);
  if (filters?.contractType && filters.contractType !== 'All') params.set('contractType', filters.contractType);
  if (filters?.customerSegment && filters.customerSegment !== 'All') params.set('customerSegment', filters.customerSegment);
  if (filters?.ukNation && filters.ukNation !== 'All') params.set('ukNation', filters.ukNation);

  const res = await fetch(`/api/kpis?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to fetch platform KPIs');
  }
  return res.json();
}

export async function fetchCustomers(paramsObj: Record<string, string>): Promise<{
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  customers: ScoredCustomer[];
}> {
  const params = new URLSearchParams(paramsObj);
  const res = await fetch(`/api/customers?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to fetch customers');
  }
  return res.json();
}

export async function fetchCustomerById(id: string): Promise<{
  customer: ScoredCustomer;
  activeBaseBenchmark: Record<string, number>;
  approvedOffers: any[];
}> {
  const res = await fetch(`/api/customers/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch customer ${id}`);
  }
  return res.json();
}

export async function fetchModelLab(): Promise<{ modelCard: ModelCard; selectedModel: string }> {
  const res = await fetch('/api/model');
  if (!res.ok) throw new Error('Failed to fetch model card');
  return res.json();
}

export async function fetchSegments(): Promise<{ personas: PersonaSegment[] }> {
  const res = await fetch('/api/segments');
  if (!res.ok) throw new Error('Failed to fetch customer segments');
  return res.json();
}

export async function fetchDataHealth(): Promise<DataQualityReport> {
  const res = await fetch('/api/data-health');
  if (!res.ok) throw new Error('Failed to fetch data health report');
  return res.json();
}

export async function runCustomerWhatIf(customerId: string, levers: any): Promise<WhatIfCustomerResult> {
  const res = await fetch('/api/whatif', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'customer', customerId, levers }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to run customer what-if simulation');
  }
  return res.json();
}

export async function runCohortWhatIf(cohortFilters: any, levers: any, acceptanceRate: number): Promise<WhatIfCohortResult> {
  const res = await fetch('/api/whatif', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'cohort', cohortFilters, levers, acceptanceRate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to run cohort what-if simulation');
  }
  return res.json();
}

export async function fetchRetentionPlan(customerId: string): Promise<RetentionPlan> {
  const res = await fetch('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to generate retention recommendation');
  }
  return res.json();
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await fetch('/api/campaigns');
  if (!res.ok) throw new Error('Failed to load campaigns');
  return res.json();
}

export async function fetchCampaignById(id: string): Promise<Campaign> {
  const res = await fetch(`/api/campaigns/${id}`);
  if (!res.ok) throw new Error('Failed to load campaign');
  return res.json();
}

export async function createCampaign(data: any): Promise<Campaign> {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to create campaign');
  }
  return res.json();
}

export async function updateCampaignCustomerStatus(campaignId: string, customerId: string, status: string, notes?: string): Promise<Campaign> {
  const res = await fetch(`/api/campaigns/${campaignId}/customers/${customerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  });
  if (!res.ok) throw new Error('Failed to update target status');
  return res.json();
}

export async function sendChatMessage(message: string, history: Array<{ role: 'user' | 'model'; content: string }>): Promise<any> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to send message');
  }
  return res.json();
}
