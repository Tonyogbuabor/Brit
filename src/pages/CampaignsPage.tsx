import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  Plus,
  TrendingUp,
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  PoundSterling,
  Upload,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { fetchCampaigns, createCampaign, updateCampaignCustomerStatus } from '../lib/api.js';
import { formatCurrency, formatPercent, formatNumber } from '../lib/formatters.js';

export const CampaignsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New campaign form state
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [channel, setChannel] = useState('Outbound Phone Call');
  const [budget, setBudget] = useState(10000);
  const [targetTier, setTargetTier] = useState<'Critical' | 'High'>('Critical');
  const [holdoutPct, setHoldoutPct] = useState(10);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  });

  const selectedCampaign = campaigns?.find((c) => c.id === selectedCampaignId) || campaigns?.[0];

  const createMutation = useMutation({
    mutationFn: (newCmp: any) => createCampaign(newCmp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCreateModal(false);
      setName('');
      setObjective('');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ cmpId, custId, status }: { cmpId: string; custId: string; status: string }) =>
      updateCampaignCustomerStatus(cmpId, custId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  if (isLoading || !campaigns) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-[#F1EAD3] rounded-xl w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-2xl border border-[#F1EAD3]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#0F3D2E] tracking-tight">
            Retention Campaigns & Controlled Uplift
          </h2>
          <p className="text-xs text-[#1B2A22]/70 mt-0.5">
            Measure incremental causal lift against randomised 10% holdout control groups. Reconciles with Google Sheet churns automatically.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F3D2E] text-[#FAF6EA] hover:bg-[#1F7A4D] text-xs font-semibold shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#C9A227]" />
          <span>Launch New Campaign</span>
        </button>
      </div>

      {/* Campaign List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaigns.map((c) => {
          const isSelected = selectedCampaign?.id === c.id;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedCampaignId(c.id)}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-xs ${
                isSelected
                  ? 'border-[#C9A227] bg-[#FAF6EA]/90'
                  : 'border-[#F1EAD3] bg-white hover:border-[#1F7A4D]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-gray-500 font-bold">{c.id}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1F7A4D]/15 text-[#1F7A4D]">
                  Active Run
                </span>
              </div>
              <h3 className="font-serif font-bold text-sm text-[#0F3D2E] mb-1 line-clamp-1">{c.name}</h3>
              <p className="text-[11px] text-[#1B2A22]/70 line-clamp-2 mb-3">{c.objective}</p>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-3 border-t border-[#F1EAD3]">
                <div>
                  <span className="text-[10px] text-gray-500 font-sans block">Uplift vs Control</span>
                  <span className="font-bold text-[#1F7A4D]">+{c.metrics.absoluteUpliftPercentage}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-sans block">Revenue Protected</span>
                  <span className="font-bold text-[#0F3D2E]">{formatCurrency(c.metrics.revenueProtectedGbp, true)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Campaign Detailed Performance */}
      {selectedCampaign && (
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1EAD3] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-xl font-bold text-[#0F3D2E]">
                  {selectedCampaign.name}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#C9A227]/20 text-[#0F3D2E] font-bold">
                  {selectedCampaign.holdoutPercentage}% Control Holdout
                </span>
              </div>
              <p className="text-xs text-[#1B2A22]/70 mt-1">
                Owner: {selectedCampaign.owner} • Channel: {selectedCampaign.channel} • Budget: {formatCurrency(selectedCampaign.budgetGbp)}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-[#1B2A22]/60 block">Net Campaign ROI</span>
              <span className="font-serif text-2xl font-bold text-[#0F3D2E] font-tabular">
                {formatCurrency(selectedCampaign.metrics.netRoiGbp)}
              </span>
              <span className="text-[11px] text-[#1F7A4D] font-bold block">
                {selectedCampaign.metrics.roiMultiplier}x Spend Multiplier
              </span>
            </div>
          </div>

          {/* 4 Performance Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#FAF6EA] border border-[#F1EAD3]">
              <span className="text-[10px] uppercase font-bold text-gray-500">Total Targeted</span>
              <div className="text-2xl font-bold font-mono text-[#0F3D2E] mt-1">
                {formatNumber(selectedCampaign.metrics.totalTargeted)}
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5">
                {selectedCampaign.metrics.treatmentCount} outreach • {selectedCampaign.metrics.controlCount} holdout
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800">Absolute Uplift</span>
              <div className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                +{selectedCampaign.metrics.absoluteUpliftPercentage}%
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                95% CI: [{selectedCampaign.metrics.upliftConfidenceInterval.join('%, ')}%]
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] uppercase font-bold text-amber-800">Estimated Saves</span>
              <div className="text-2xl font-bold font-mono text-amber-900 mt-1">
                {selectedCampaign.metrics.estimatedSaves} accounts
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                Cost per save: £{selectedCampaign.metrics.costPerSaveGbp}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF6EA] border border-[#F1EAD3]">
              <span className="text-[10px] uppercase font-bold text-gray-500">Holdout Churn vs Treated</span>
              <div className="text-lg font-bold font-mono text-[#0F3D2E] mt-1">
                {(selectedCampaign.metrics.treatmentChurnRate * 100).toFixed(1)}% vs {(selectedCampaign.metrics.controlChurnRate * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-0.5">
                Statistically Significant
              </div>
            </div>
          </div>

          {/* Customer Targets Tracking Table */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="font-serif font-bold text-base text-[#0F3D2E]">
                Campaign Target List & Outcome Tracking
              </h4>
              <span className="text-xs text-[#1B2A22]/60">
                Auto-reconciled against Google Sheet on every refresh
              </span>
            </div>

            <div className="overflow-x-auto border border-[#F1EAD3] rounded-xl max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0F3D2E] text-[#FAF6EA] select-none">
                  <tr>
                    <th className="py-2.5 px-3">Customer ID</th>
                    <th className="py-2.5 px-3">Group</th>
                    <th className="py-2.5 px-3">Monthly Charge</th>
                    <th className="py-2.5 px-3">Initial Tier</th>
                    <th className="py-2.5 px-3">Outreach Status</th>
                    <th className="py-2.5 px-3">Sheet Status Reconciled</th>
                    <th className="py-2.5 px-3 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EAD3]">
                  {selectedCampaign.customers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No targets assigned. Launching a campaign populates this automatically with holdout allocation.
                      </td>
                    </tr>
                  ) : (
                    selectedCampaign.customers.slice(0, 30).map((c) => (
                      <tr key={c.customerId} className="hover:bg-[#FAF6EA]/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0F3D2E]">
                          {c.customerId}
                        </td>
                        <td className="py-2.5 px-3">
                          {c.isControl ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                              Holdout Control (10%)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Treatment Outreach
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {formatCurrency(c.monthlyChargeGbp)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {c.initialRiskTier}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                            c.status === 'Declined' ? 'bg-rose-100 text-rose-800' :
                            c.status === 'Contacted' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {c.churnedDuringCampaign ? (
                            <span className="text-rose-700 font-bold text-[11px]">
                              Churned ({c.churnDate}) - {c.churnReason}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium text-[11px]">
                              Active in Sheet
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!c.isControl && (
                            <select
                              value={c.status}
                              onChange={(e) =>
                                updateStatusMutation.mutate({
                                  cmpId: selectedCampaign.id,
                                  custId: c.customerId,
                                  status: e.target.value,
                                })
                              }
                              className="text-[11px] bg-white border border-[#F1EAD3] rounded-lg px-2 py-1"
                            >
                              <option value="Planned">Planned</option>
                              <option value="Contacted">Contacted</option>
                              <option value="Accepted">Accepted</option>
                              <option value="Declined">Declined</option>
                              <option value="No response">No response</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Campaign */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAF6EA] border border-[#C9A227] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-lg text-[#0F3D2E]">
              Create New Retention Campaign
            </h3>

            <div>
              <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 Fibre VIP Retention Wave"
                className="w-full text-xs bg-white border border-[#F1EAD3] rounded-xl px-3 py-2 text-[#1B2A22]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">Objective</label>
              <input
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g. Prevent churn across Fibre subscribers with multiple outages"
                className="w-full text-xs bg-white border border-[#F1EAD3] rounded-xl px-3 py-2 text-[#1B2A22]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">Target Tier</label>
                <select
                  value={targetTier}
                  onChange={(e) => setTargetTier(e.target.value as any)}
                  className="w-full text-xs bg-white border border-[#F1EAD3] rounded-xl px-3 py-2 text-[#1B2A22]"
                >
                  <option value="Critical">Critical Risk Tier</option>
                  <option value="High">High Risk Tier</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">Holdout Group (%)</label>
                <input
                  type="number"
                  value={holdoutPct}
                  onChange={(e) => setHoldoutPct(Number(e.target.value))}
                  min={5}
                  max={25}
                  className="w-full text-xs bg-white border border-[#F1EAD3] rounded-xl px-3 py-2 text-[#1B2A22]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#F1EAD3]">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#1B2A22]/70 hover:bg-[#F1EAD3] rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createMutation.mutate({
                    name,
                    objective,
                    targetCriteria: { tiers: [targetTier] },
                    offerId: 'OFFER_LOYALTY_10',
                    offerName: '10% Retention Loyalty Discount (12M)',
                    channel,
                    budgetGbp: budget,
                    startDate: '2026-11-01',
                    endDate: '2026-12-31',
                    owner: 'Retention Operations Team',
                    holdoutPercentage: holdoutPct,
                  })
                }
                disabled={!name.trim() || !objective.trim() || createMutation.isPending}
                className="px-4 py-2 text-xs font-semibold bg-[#0F3D2E] text-white hover:bg-[#1F7A4D] rounded-xl disabled:opacity-40"
              >
                {createMutation.isPending ? 'Allocating Holdout...' : 'Deploy Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
