import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';
import { fetchDataHealth, fetchSnapshotMeta } from '../lib/api.js';
import { formatNumber } from '../lib/formatters.js';

export const DataHealthPage: React.FC = () => {
  const { data: health, isLoading } = useQuery({
    queryKey: ['dataHealth'],
    queryFn: fetchDataHealth,
  });

  const { data: metaData } = useQuery({
    queryKey: ['meta'],
    queryFn: fetchSnapshotMeta,
  });

  if (isLoading || !health) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-[#F1EAD3] rounded-xl w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-[#F1EAD3]" />
          ))}
        </div>
      </div>
    );
  }

  const qualityScore = Number(((health.validRows / Math.max(1, health.totalRawRows)) * 100).toFixed(1));

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#0F3D2E] tracking-tight">
            Data Quality & Health Audit
          </h2>
          <p className="text-xs text-[#1B2A22]/70 mt-0.5">
            Deterministic validation pipeline audit, deduplication logs, quarantine registry, and sentinel value handling.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-white border border-[#F1EAD3] text-xs font-mono font-bold text-[#0F3D2E] shadow-xs">
            Quality Score: {qualityScore}%
          </span>
        </div>
      </div>

      {/* 4 Health KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-semibold text-[#1B2A22]/60 uppercase">Total Raw Rows Ingested</span>
          <div className="font-serif text-2xl font-bold text-[#0F3D2E] font-tabular mt-1">
            {formatNumber(health.totalRawRows)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">From primary Google Sheet</div>
        </div>

        <div className="bg-white border border-[#1F7A4D]/30 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-semibold text-[#1F7A4D] uppercase">Valid Records Ingested</span>
          <div className="font-serif text-2xl font-bold text-[#1F7A4D] font-tabular mt-1">
            {formatNumber(health.validRows)}
          </div>
          <div className="text-[11px] text-[#1F7A4D] mt-0.5">Passed all domain & integrity rules</div>
        </div>

        <div className="bg-white border border-[#B5483A]/30 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-semibold text-[#B5483A] uppercase">Quarantined Rows</span>
          <div className="font-serif text-2xl font-bold text-[#B5483A] font-tabular mt-1">
            {formatNumber(health.quarantinedRows)}
          </div>
          <div className="text-[11px] text-[#B5483A] mt-0.5">Excluded from ML training</div>
        </div>

        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-semibold text-[#1B2A22]/60 uppercase">Deduplicated Records</span>
          <div className="font-serif text-2xl font-bold text-[#C9A227] font-tabular mt-1">
            {formatNumber(health.dedupedCount)}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Merged on Customer ID completeness</div>
        </div>
      </div>

      {/* Domain Rule Audit Execution Table */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
          Rule-by-Rule Validation Execution Report
        </h3>
        <p className="text-xs text-[#1B2A22]/70">
          Deterministic sanitisation pipeline enforces customer ID presence, target integrity, bounds checking, and sentinel decoupling.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#F1EAD3] bg-[#FAF6EA] font-semibold text-[#1B2A22]/80">
                <th className="py-2.5 px-3">Rule Identifier</th>
                <th className="py-2.5 px-3">Audit Scope & Rule Description</th>
                <th className="py-2.5 px-3">Checked</th>
                <th className="py-2.5 px-3">Passed</th>
                <th className="py-2.5 px-3">Normalized / Fixed</th>
                <th className="py-2.5 px-3">Quarantined</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EAD3] font-mono">
              {health.rules.map((r) => (
                <tr key={r.ruleId} className="hover:bg-[#FAF6EA]/40">
                  <td className="py-3 px-3 font-bold text-[#0F3D2E]">{r.ruleId}</td>
                  <td className="py-3 px-3 font-sans text-[#1B2A22]">{r.description}</td>
                  <td className="py-3 px-3">{formatNumber(r.checkedCount)}</td>
                  <td className="py-3 px-3 text-[#1F7A4D] font-bold">{formatNumber(r.passedCount)}</td>
                  <td className="py-3 px-3 text-[#C9A227]">{formatNumber(r.fixedCount)}</td>
                  <td className="py-3 px-3 text-[#B5483A]">{formatNumber(r.quarantinedCount)}</td>
                  <td className="py-3 px-3 font-sans">
                    {r.quarantinedCount === 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Compliant
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {r.quarantinedCount} Quarantined
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quarantined Records Registry */}
      {health.quarantinedSamples.length > 0 && (
        <div className="bg-white border border-[#B5483A]/30 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#B5483A]" />
            <h3 className="font-serif text-lg font-bold text-[#B5483A]">
              Quarantine Registry & Audit Samples
            </h3>
          </div>
          <p className="text-xs text-[#1B2A22]/70 leading-relaxed">
            Rows with target mismatches (e.g. Churn Status differs from Churn Flag) or missing Customer IDs are quarantined from training folds to prevent label corruption.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F1EAD3] bg-red-50 text-red-900 font-semibold">
                  <th className="p-2.5">Customer ID</th>
                  <th className="p-2.5">Quarantine Cause</th>
                  <th className="p-2.5">Raw Data Snippet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {health.quarantinedSamples.map((s, idx) => (
                  <tr key={idx} className="hover:bg-red-50/30">
                    <td className="p-2.5 font-bold text-[#B5483A]">{s.customerId}</td>
                    <td className="p-2.5 text-gray-800 font-sans">{s.reason}</td>
                    <td className="p-2.5 text-[10px] text-gray-500 max-w-xs truncate">
                      {JSON.stringify(s.rawSnippet)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sentinel Handling Specification */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs space-y-3">
        <h4 className="font-serif font-bold text-base text-[#0F3D2E]">
          Telecom Sentinel Value Protocol
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-[#FAF6EA] rounded-xl border border-[#F1EAD3]">
            <strong className="text-[#0F3D2E] block mb-1">Data Allowance 999 = Unlimited Mobile Data</strong>
            <p className="text-[#1B2A22]/70">
              Decoupled into boolean flag <code className="font-mono bg-white px-1">isUnlimitedData = true</code>. Charge per GB set to neutral benchmark to avoid division by 999 GB.
            </p>
          </div>
          <div className="p-3 bg-[#FAF6EA] rounded-xl border border-[#F1EAD3]">
            <strong className="text-[#0F3D2E] block mb-1">Data Allowance 0 = Broadband Not Applicable</strong>
            <p className="text-[#1B2A22]/70">
              Decoupled into boolean flag <code className="font-mono bg-white px-1">hasDataAllowance = false</code>. Utilization ratio defaulted to 0.50 neutral.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
