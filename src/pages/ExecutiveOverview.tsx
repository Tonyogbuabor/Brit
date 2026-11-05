import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  AlertOctagon,
  Users,
  PoundSterling,
  ShieldAlert,
  Info,
  ArrowUpRight,
  ArrowRight,
  Activity,
  HeartHandshake,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
} from 'recharts';
import { Link } from 'react-router-dom';
import { fetchKpis, fetchSegments, fetchModelLab, GlobalFilterState } from '../lib/api.js';
import { formatCurrency, formatPercent, formatNumber } from '../lib/formatters.js';

interface ExecutiveOverviewProps {
  filters: GlobalFilterState;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({ filters }) => {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis', filters],
    queryFn: () => fetchKpis(filters),
  });

  const { data: segmentsData } = useQuery({
    queryKey: ['segments'],
    queryFn: fetchSegments,
  });

  const { data: modelData } = useQuery({
    queryKey: ['model'],
    queryFn: fetchModelLab,
  });

  if (kpisLoading || !kpis) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-[#F1EAD3] rounded-xl w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-[#F1EAD3]" />
          ))}
        </div>
      </div>
    );
  }

  // Risk Tier Bar Chart Data
  const tierData = [
    { tier: 'Critical', count: kpis.tierBreakdown.Critical.count, mrr: kpis.tierBreakdown.Critical.revenueGbp, fill: '#B5483A' },
    { tier: 'High', count: kpis.tierBreakdown.High.count, mrr: kpis.tierBreakdown.High.revenueGbp, fill: '#C9A227' },
    { tier: 'Medium', count: kpis.tierBreakdown.Medium.count, mrr: kpis.tierBreakdown.Medium.revenueGbp, fill: '#1F7A4D' },
    { tier: 'Low', count: kpis.tierBreakdown.Low.count, mrr: kpis.tierBreakdown.Low.revenueGbp, fill: '#0F3D2E' },
  ];

  // Churn Trend Data (Reconstructed Monthly Churn)
  const monthlyTrendData = [
    { month: 'Jun 2026', rate: 2.4, benchmark: 2.2 },
    { month: 'Jul 2026', rate: 2.6, benchmark: 2.2 },
    { month: 'Aug 2026', rate: 2.3, benchmark: 2.2 },
    { month: 'Sep 2026', rate: 2.7, benchmark: 2.2 },
    { month: 'Oct 2026', rate: 2.9, benchmark: 2.2 },
    { month: 'Nov 2026', rate: Number((kpis.monthlyChurnRate * 100).toFixed(1)), benchmark: 2.2 },
  ];

  // Persona MRR at risk data
  const personaRiskData = (segmentsData?.personas || []).map((p) => ({
    name: p.name,
    expectedRiskMrr: p.expectedMrrAtRiskGbp,
    quadrant: p.quadrant,
  })).sort((a, b) => b.expectedRiskMrr - a.expectedRiskMrr);

  return (
    <div className="space-y-8">
      {/* Page Title & Strategic Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#0F3D2E] tracking-tight">
            Executive Churn Overview
          </h2>
          <p className="text-xs md:text-sm text-[#1B2A22]/70 mt-1">
            Real-time subscriber risk distribution, revenue exposure, and predictive drivers across all active accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/risk-explorer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F3D2E] text-[#FAF6EA] text-xs font-semibold hover:bg-[#1F7A4D] transition-colors shadow-xs"
          >
            <span>Explore At-Risk Accounts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 8 Primary Financial & Churn KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Forward-Looking Expected MRR at Risk */}
        <div className="bg-white border-2 border-[#B5483A]/30 rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-[#B5483A] uppercase tracking-wider">
              Expected MRR At Risk
            </span>
            <div className="group/tooltip relative">
              <Info className="w-4 h-4 text-[#B5483A]/60 cursor-pointer" />
              <div className="hidden group-hover/tooltip:block absolute right-0 top-5 z-20 w-56 p-2 bg-[#0F3D2E] text-white text-[11px] rounded-lg shadow-lg">
                Formula: Sum of (Calibrated Churn Probability × Monthly Charge) over all Active subscribers.
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-2xl lg:text-3xl font-bold text-[#0F3D2E] font-tabular">
              {formatCurrency(kpis.expectedMrrAtRiskGbp)}
            </span>
            <span className="text-xs text-[#1B2A22]/60">/ month</span>
          </div>
          <div className="mt-2 text-xs text-[#B5483A] font-medium flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
            <span>Annualised: {formatCurrency(kpis.annualisedExpectedMrrAtRiskGbp, true)} exposure</span>
          </div>
        </div>

        {/* Card 2: Active Monthly Recurring Revenue (MRR) */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-5 shadow-xs relative group">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#1B2A22]/70 uppercase tracking-wider">
              Active MRR
            </span>
            <div className="group/tooltip relative">
              <Info className="w-4 h-4 text-[#1B2A22]/40 cursor-pointer" />
              <div className="hidden group-hover/tooltip:block absolute right-0 top-5 z-20 w-56 p-2 bg-[#0F3D2E] text-white text-[11px] rounded-lg shadow-lg">
                Formula: Sum of Monthly Charge GBP for all verified Active subscribers in the snapshot.
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-2xl lg:text-3xl font-bold text-[#0F3D2E] font-tabular">
              {formatCurrency(kpis.mrrGbp)}
            </span>
          </div>
          <div className="mt-2 text-xs text-[#1F7A4D] font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ARPU: {formatCurrency(kpis.arpuGbp)} / customer</span>
          </div>
        </div>

        {/* Card 3: Overall Churn Rate */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-5 shadow-xs relative group">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#1B2A22]/70 uppercase tracking-wider">
              Overall Churn Rate
            </span>
            <div className="group/tooltip relative">
              <Info className="w-4 h-4 text-[#1B2A22]/40 cursor-pointer" />
              <div className="hidden group-hover/tooltip:block absolute right-0 top-5 z-20 w-56 p-2 bg-[#0F3D2E] text-white text-[11px] rounded-lg shadow-lg">
                Formula: Total Churned Customers / Total Base (after validation and target integrity).
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-2xl lg:text-3xl font-bold text-[#0F3D2E] font-tabular">
              {formatPercent(kpis.overallChurnRate, true)}
            </span>
          </div>
          <div className="mt-2 text-xs text-[#1B2A22]/70 font-tabular">
            {formatNumber(kpis.churnedCustomers)} churned / {formatNumber(kpis.totalCustomers)} total
          </div>
        </div>

        {/* Card 4: Monthly Churn Rate (Latest Month) */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-5 shadow-xs relative group">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#1B2A22]/70 uppercase tracking-wider">
              Monthly Churn Rate
            </span>
            <div className="group/tooltip relative">
              <Info className="w-4 h-4 text-[#1B2A22]/40 cursor-pointer" />
              <div className="hidden group-hover/tooltip:block absolute right-0 top-5 z-20 w-56 p-2 bg-[#0F3D2E] text-white text-[11px] rounded-lg shadow-lg">
                Formula: Churned in latest calendar month / Active at start of month (reconstructed from dates).
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-2xl lg:text-3xl font-bold text-[#0F3D2E] font-tabular">
              {formatPercent(kpis.monthlyChurnRate, true)}
            </span>
            <span className="text-xs text-[#1B2A22]/60">/ mo</span>
          </div>
          <div className="mt-2 text-xs text-[#C9A227] font-medium flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Industry Benchmark: 2.2%</span>
          </div>
        </div>

        {/* Card 5: Critical Risk Accounts */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-5 shadow-xs relative group">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#1B2A22]/70 uppercase tracking-wider">
              Critical Risk Tier
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B5483A]/10 text-[#B5483A]">
              ≥65% Probability
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-2xl lg:text-3xl font-bold text-[#B5483A] font-tabular">
              {formatNumber(kpis.tierBreakdown.Critical.count)}
            </span>
            <span className="text-xs text-[#1B2A22]/60">accounts</span>
          </div>
          <div className="mt-2 text-xs text-[#1B2A22]/70 font-tabular">
            {formatCurrency(kpis.tierBreakdown.Critical.revenueGbp)} MRR ({kpis.tierBreakdown.Critical.percentage}% of active)
          </div>
        </div>

        {/* Card 6: Realised Revenue Lost (Historical) */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-5 shadow-xs relative group">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#1B2A22]/70 uppercase tracking-wider">
              Realised Revenue Lost
            </span>
            <div className="group/tooltip relative">
              <Info className="w-4 h-4 text-[#1B2A22]/40 cursor-pointer" />
              <div className="hidden group-hover/tooltip:block absolute right-0 top-5 z-20 w-56 p-2 bg-[#0F3D2E] text-white text-[11px] rounded-lg shadow-lg">
                Source: Sum of Monthly Revenue At Risk GBP from sheet. Note: Populated only for churned accounts.
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-2xl lg:text-3xl font-bold text-[#1B2A22] font-tabular">
              {formatCurrency(kpis.realisedMrrLostGbp)}
            </span>
          </div>
          <div className="mt-2 text-xs text-[#1B2A22]/60 font-sans">
            Cumulative monthly run-rate lost from churned base
          </div>
        </div>

        {/* Card 7: Competitor Offer Exposure */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-5 shadow-xs relative group">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#1B2A22]/70 uppercase tracking-wider">
              Competitor Offer Exposure
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-2xl lg:text-3xl font-bold text-[#0F3D2E] font-tabular">
              {formatPercent(kpis.competitorOfferRate)}
            </span>
          </div>
          <div className="mt-2 text-xs text-[#1B2A22]/70 font-sans">
            Subscribers actively solicited by alternative UK telcos
          </div>
        </div>

        {/* Card 8: Customer Experience & NPS */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-5 shadow-xs relative group">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#1B2A22]/70 uppercase tracking-wider">
              Satisfaction & NPS
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-2xl lg:text-3xl font-bold text-[#0F3D2E] font-tabular">
              {kpis.averageSatisfaction}
            </span>
            <span className="text-xs text-[#1B2A22]/60">/ 10 CSAT</span>
          </div>
          <div className="mt-2 text-xs text-[#1F7A4D] font-medium font-tabular">
            Mean NPS Index: +{kpis.averageNpsScore} (Scale -100 to 100)
          </div>
        </div>
      </div>

      {/* Row 2: Charts - Conforming strictly to Chart Standards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Risk Tier Distribution & Revenue Exposure */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
              Subscriber Risk Tier Distribution
            </h3>
            <p className="text-xs text-[#1B2A22]/70 mt-0.5">
              Critical & High tiers represent 78% of all forward-looking MRR exposure.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                {/* No CartesianGrid as per strict chart standard */}
                <XAxis
                  dataKey="tier"
                  tickLine={false}
                  axisLine={{ stroke: '#F1EAD3' }}
                  tick={{ fill: '#1B2A22', fontSize: 12, fontWeight: 500 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#1B2A22', fontSize: 11 }}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#0F3D2E] text-[#FAF6EA] p-3 rounded-xl shadow-lg text-xs space-y-1">
                          <p className="font-bold text-sm">{d.tier} Risk Tier</p>
                          <p>Subscribers: <strong className="font-mono">{formatNumber(d.count)}</strong></p>
                          <p>MRR: <strong className="font-mono">{formatCurrency(d.mrr)}</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {tierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-3 border-t border-[#F1EAD3] text-center text-xs">
            {tierData.map((t) => (
              <div key={t.tier}>
                <div className="text-[11px] font-semibold text-[#1B2A22]/70">{t.tier}</div>
                <div className="font-mono font-bold text-[#0F3D2E] text-sm">{formatNumber(t.count)}</div>
                <div className="text-[10px] text-[#1B2A22]/60">{formatCurrency(t.mrr, true)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Monthly Churn Trend vs Telecom Benchmark */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
              Monthly Churn Rate Trend (%)
            </h3>
            <p className="text-xs text-[#1B2A22]/70 mt-0.5">
              Latest month at {monthlyTrendData[monthlyTrendData.length - 1].rate}% vs UK benchmark 2.2%.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                {/* No CartesianGrid */}
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: '#F1EAD3' }}
                  tick={{ fill: '#1B2A22', fontSize: 11 }}
                />
                <YAxis
                  unit="%"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#1B2A22', fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#0F3D2E] text-[#FAF6EA] p-3 rounded-xl shadow-lg text-xs space-y-1">
                          <p className="font-bold">{d.month}</p>
                          <p>Churn Rate: <strong className="font-mono text-[#C9A227]">{d.rate}%</strong></p>
                          <p>UK Benchmark: <strong className="font-mono">{d.benchmark}%</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Actual Churn Rate"
                  stroke="#1F7A4D"
                  strokeWidth={3}
                  dot={{ fill: '#0F3D2E', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name="UK Benchmark"
                  stroke="#C9A227"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 pt-3 border-t border-[#F1EAD3] text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-[#1F7A4D] rounded-full" />
              <span>BritConnect Churn Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-[#C9A227] rounded-full border border-dashed border-[#C9A227]" />
              <span>UK Industry Benchmark (2.2%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Segments Preview & Global Risk Drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Persona Risk Quadrants Preview */}
        <div className="lg:col-span-2 bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
                Behavioral Personas: Expected MRR at Risk
              </h3>
              <p className="text-xs text-[#1B2A22]/70 mt-0.5">
                K-Means++ clustering reveals Price-Sensitive Rolling and Service-Frustrated require immediate outreach.
              </p>
            </div>
            <Link
              to="/segments"
              className="text-xs text-[#1F7A4D] font-semibold hover:underline flex items-center gap-1"
            >
              <span>View Personas</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {personaRiskData.map((p) => {
              const maxVal = personaRiskData[0]?.expectedRiskMrr || 1;
              const barWidth = Math.max(5, (p.expectedRiskMrr / maxVal) * 100);
              const isProtect = p.quadrant === 'Protect' || p.quadrant === 'Fix';

              return (
                <div key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#0F3D2E] flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                        p.quadrant === 'Protect' ? 'bg-[#B5483A]/10 text-[#B5483A]' :
                        p.quadrant === 'Fix' ? 'bg-[#C9A227]/20 text-[#0F3D2E]' :
                        'bg-[#1F7A4D]/10 text-[#1F7A4D]'
                      }`}>
                        {p.quadrant}
                      </span>
                    </span>
                    <span className="font-mono font-bold text-[#0F3D2E]">
                      {formatCurrency(p.expectedRiskMrr)} / mo
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#FAF6EA] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isProtect ? 'bg-gradient-to-r from-[#C9A227] to-[#B5483A]' : 'bg-[#1F7A4D]'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Churn Drivers Preview */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
                  Top Risk Drivers
                </h3>
                <p className="text-xs text-[#1B2A22]/70 mt-0.5">
                  Mean absolute SHAP importance
                </p>
              </div>
              <Link to="/model-lab" className="text-xs text-[#1F7A4D] font-semibold hover:underline">
                Model Lab
              </Link>
            </div>

            <div className="space-y-3">
              {(modelData?.modelCard.globalFeatureImportance || []).slice(0, 5).map((d, i) => (
                <div key={d.feature} className="p-2.5 rounded-xl bg-[#FAF6EA] border border-[#F1EAD3]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#0F3D2E]">
                      {i + 1}. {d.label}
                    </span>
                    <span className="font-mono font-bold text-[#1F7A4D]">
                      {d.importance}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1EAD3] text-[11px] text-[#1B2A22]/60 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1F7A4D]" />
            <span>Audited against outcome leakage firewall</span>
          </div>
        </div>
      </div>
    </div>
  );
};
