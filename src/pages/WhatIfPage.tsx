import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  SlidersHorizontal,
  TrendingDown,
  PoundSterling,
  ShieldCheck,
  Megaphone,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { runCohortWhatIf, GlobalFilterState } from '../lib/api.js';
import { formatCurrency, formatPercent, formatNumber } from '../lib/formatters.js';

interface WhatIfPageProps {
  globalFilters: GlobalFilterState;
}

export const WhatIfPage: React.FC<WhatIfPageProps> = ({ globalFilters }) => {
  const [targetTier, setTargetTier] = useState<string>('Critical');
  const [targetService, setTargetService] = useState<string>('All');
  const [discountLever, setDiscountLever] = useState<number>(10);
  const [contractLever, setContractLever] = useState<'Rolling Monthly' | '12 Months' | '24 Months'>('12 Months');
  const [acceptanceRate, setAcceptanceRate] = useState<number>(0.35);
  const [unitCost, setUnitCost] = useState<number>(25);

  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleRunCohortSim = async () => {
    setIsSimulating(true);
    try {
      const cohortFilters = {
        riskTier: targetTier !== 'All' ? targetTier : undefined,
        serviceType: targetService !== 'All' ? targetService : undefined,
      };
      const levers = {
        discountPercent: discountLever,
        contractType: contractLever,
        satisfactionScore: 8,
      };
      const res = await runCohortWhatIf(cohortFilters, levers, acceptanceRate);
      setSimulationResult(res);
    } catch (err: any) {
      console.error('Simulation error:', err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#0F3D2E] tracking-tight">
          What-If Strategy & Cohort Simulator
        </h2>
        <p className="text-xs text-[#1B2A22]/70 mt-0.5">
          Simulate portfolio-wide commercial and contract interventions to forecast churn reduction and campaign ROI.
        </p>
      </div>

      {/* Associational Methodology Notice */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong>Statistical Methodology Notice:</strong> These What-If projections represent associational model estimates based on historical relationships, not guaranteed causal outcomes. We recommend launching an active retention campaign with an automated 10% holdout control group to validate true incremental uplift.
        </div>
      </div>

      {/* Simulator Controls & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Target Cohort & Levers */}
        <div className="lg:col-span-2 bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs space-y-6">
          <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
            Cohort Selection & Controllable Levers
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">
                Target Risk Tier
              </label>
              <select
                value={targetTier}
                onChange={(e) => setTargetTier(e.target.value)}
                className="w-full text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-3 py-2 font-medium text-[#1B2A22]"
              >
                <option value="Critical">Critical Risk Only (Highest Priority)</option>
                <option value="High">High Risk Only</option>
                <option value="All">All Active Subscribers</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">
                Service Line
              </label>
              <select
                value={targetService}
                onChange={(e) => setTargetService(e.target.value)}
                className="w-full text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-3 py-2 font-medium text-[#1B2A22]"
              >
                <option value="All">All Services</option>
                <option value="Mobile">Mobile Only</option>
                <option value="Fibre Broadband">Fibre Broadband</option>
                <option value="Home Broadband">Home Broadband</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#F1EAD3]">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-[#1B2A22]/80">Retention Discount Offer:</span>
                <strong className="font-mono text-[#0F3D2E]">{discountLever}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="5"
                value={discountLever}
                onChange={(e) => setDiscountLever(Number(e.target.value))}
                className="w-full accent-[#C9A227]"
              />
              <div className="flex justify-between text-[10px] text-[#1B2A22]/50 font-mono">
                <span>0%</span>
                <span>10% (Optimal)</span>
                <span>25% (Cap)</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">
                Proposed Contract Commitment
              </label>
              <select
                value={contractLever}
                onChange={(e) => setContractLever(e.target.value as any)}
                className="w-full text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-3 py-2 font-medium text-[#1B2A22]"
              >
                <option value="12 Months">Upgrade to 12 Months Fixed</option>
                <option value="24 Months">Upgrade to 24 Months Fixed</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-[#1B2A22]/80">Expected Offer Acceptance Rate:</span>
                <strong className="font-mono text-[#1F7A4D]">{(acceptanceRate * 100).toFixed(0)}%</strong>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={acceptanceRate}
                onChange={(e) => setAcceptanceRate(Number(e.target.value))}
                className="w-full accent-[#1F7A4D]"
              />
              <div className="flex justify-between text-[10px] text-[#1B2A22]/50 font-mono">
                <span>10% (Conservative)</span>
                <span>35% (Historic Avg)</span>
                <span>80% (Aggressive)</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRunCohortSim}
            disabled={isSimulating}
            className="w-full py-3 rounded-xl bg-[#0F3D2E] text-[#FAF6EA] hover:bg-[#1F7A4D] text-xs font-semibold shadow-xs transition-colors"
          >
            {isSimulating ? 'Computing Cohort Re-scoring...' : 'Execute Cohort Simulation'}
          </button>
        </div>

        {/* Right Column: Simulated Financial ROI & Migration */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E] mb-2">
              Forecasted Campaign ROI
            </h3>

            {simulationResult ? (
              <div className="space-y-4 mt-4">
                <div className="p-3.5 bg-[#FAF6EA] rounded-xl border border-[#F1EAD3]">
                  <span className="text-[10px] uppercase font-bold text-[#1B2A22]/60">Targeted Population</span>
                  <div className="text-xl font-bold font-mono text-[#0F3D2E]">
                    {formatNumber(simulationResult.cohortSize)} subscribers
                  </div>
                  <div className="text-xs text-[#1B2A22]/70">
                    Baseline MRR: {formatCurrency(simulationResult.baselineMrrGbp)}
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">Annual Revenue Protected</span>
                  <div className="text-2xl font-bold font-mono text-emerald-900">
                    {formatCurrency(simulationResult.annualisedRevenueProtectedGbp)}
                  </div>
                  <div className="text-xs text-emerald-700">
                    ~{simulationResult.expectedChurnersAvoided} expected churners saved
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-800">Net Financial ROI</span>
                  <div className="text-2xl font-bold font-mono text-amber-900">
                    {formatCurrency(simulationResult.netRoiGbp)}
                  </div>
                  <div className="text-xs text-amber-700">
                    After £{formatNumber(simulationResult.totalCampaignCostGbp)} outreach & offer cost
                  </div>
                </div>

                {/* Tier Migration */}
                <div className="text-xs space-y-1 font-mono pt-2">
                  <div className="text-[#0F3D2E] font-bold">Tier Migrations:</div>
                  <div className="text-gray-700">
                    • Critical to Lower Risk: {simulationResult.tierMigration.fromCriticalToLower} accounts
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-[#1B2A22]/60">
                Configure your target cohort and levers, then click "Execute Cohort Simulation" to view projected revenue impact.
              </div>
            )}
          </div>

          {simulationResult && (
            <Link
              to="/campaigns"
              className="mt-6 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#C9A227] text-[#0F3D2E] rounded-xl text-xs font-bold hover:bg-[#E4C766] transition-colors"
            >
              <Megaphone className="w-4 h-4" />
              <span>Launch Campaign from Simulation</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
