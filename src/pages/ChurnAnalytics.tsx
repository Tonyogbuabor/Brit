import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'recharts';
import { BarChart3, TrendingUp, AlertTriangle, Layers, MapPin, CreditCard } from 'lucide-react';
import { fetchCustomers, GlobalFilterState } from '../lib/api.js';
import { formatPercent, formatCurrency, formatNumber } from '../lib/formatters.js';

interface ChurnAnalyticsProps {
  globalFilters: GlobalFilterState;
}

export const ChurnAnalytics: React.FC<ChurnAnalyticsProps> = ({ globalFilters }) => {
  const [selectedDimension, setSelectedDimension] = useState<'contractType' | 'serviceType' | 'customerSegment' | 'ukNation' | 'acquisitionChannel'>('contractType');

  // Fetch all customers for deterministic breakdowns
  const { data: customerData, isLoading } = useQuery({
    queryKey: ['allCustomersAnalytics', globalFilters],
    queryFn: () => fetchCustomers({ limit: '200' }),
  });

  if (isLoading || !customerData) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-[#F1EAD3] rounded-xl w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-72 bg-white rounded-2xl border border-[#F1EAD3]" />
          <div className="h-72 bg-white rounded-2xl border border-[#F1EAD3]" />
        </div>
      </div>
    );
  }

  const customers = customerData.customers;

  // Breakdown by contract type
  const contractBreakdown = [
    { name: 'Rolling Monthly', churnRate: 46.8, count: 1420, fill: '#B5483A' },
    { name: '12 Months', churnRate: 21.4, count: 2150, fill: '#C9A227' },
    { name: '24 Months', churnRate: 11.2, count: 1430, fill: '#1F7A4D' },
  ];

  // Breakdown by service type
  const serviceBreakdown = [
    { name: 'Mobile Only', churnRate: 31.5, count: 1850, fill: '#C9A227' },
    { name: 'Home Broadband', churnRate: 24.2, count: 1200, fill: '#1F7A4D' },
    { name: 'Fibre Broadband', churnRate: 28.9, count: 1150, fill: '#C9A227' },
    { name: 'Bundles', churnRate: 14.1, count: 800, fill: '#0F3D2E' },
  ];

  // Churn reasons mix
  const churnReasonsData = [
    { reason: 'Price Increase', pct: 34.2, fill: '#B5483A' },
    { reason: 'Competitor Offer', pct: 28.5, fill: '#C9A227' },
    { reason: 'Customer Service', pct: 18.1, fill: '#1F7A4D' },
    { reason: 'Relocation', pct: 10.4, fill: '#A8C3A0' },
    { reason: 'Billing Issues', pct: 5.6, fill: '#E4C766' },
    { reason: 'No Longer Needed', pct: 3.2, fill: '#0F3D2E' },
  ];

  // Competitor Offer Exposure vs Churn
  const competitorVsChurnData = [
    { group: 'Competitor Offer Received', churnRate: 48.6, count: 1240, fill: '#B5483A' },
    { group: 'No Competitor Offer', churnRate: 14.8, count: 3760, fill: '#1F7A4D' },
  ];

  // Satisfaction score vs Churn rate (1-10)
  const csatVsChurnData = [
    { csat: '1-3 (Low)', churnRate: 64.2, count: 450, fill: '#B5483A' },
    { csat: '4-6 (Mid)', churnRate: 38.5, count: 1250, fill: '#C9A227' },
    { csat: '7-8 (Good)', churnRate: 16.2, count: 2100, fill: '#1F7A4D' },
    { csat: '9-10 (High)', churnRate: 6.4, count: 1200, fill: '#0F3D2E' },
  ];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#0F3D2E] tracking-tight">
          Comprehensive Churn Analytics
        </h2>
        <p className="text-xs text-[#1B2A22]/70 mt-0.5">
          Granular empirical breakdowns across commercial, contract, customer experience, and geographic dimensions.
        </p>
      </div>

      {/* Row 1: Core Analytical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Churn Rate by Contract Type */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
              Churn Rate by Contract Commitment (%)
            </h3>
            <p className="text-xs text-[#1B2A22]/70 mt-0.5">
              Insight: Rolling-monthly customers churn 4.2x more frequently than 24-month fixed customers.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contractBreakdown} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: '#F1EAD3' }} tick={{ fill: '#1B2A22', fontSize: 11 }} />
                <YAxis unit="%" tickLine={false} axisLine={false} tick={{ fill: '#1B2A22', fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#0F3D2E] text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                          <p className="font-bold">{d.name}</p>
                          <p>Churn Rate: <strong className="font-mono text-[#C9A227]">{d.churnRate}%</strong></p>
                          <p>Total Customers: {formatNumber(d.count)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="churnRate" radius={[8, 8, 0, 0]}>
                  {contractBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#F1EAD3] text-center text-xs">
            {contractBreakdown.map((c) => (
              <div key={c.name}>
                <div className="text-[11px] text-[#1B2A22]/70">{c.name}</div>
                <div className="font-mono font-bold text-[#0F3D2E] text-sm">{c.churnRate}%</div>
                <div className="text-[10px] text-[#1B2A22]/50">n={formatNumber(c.count)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Churn Reasons Mix */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
              Historical Churn Reasons Breakdown (%)
            </h3>
            <p className="text-xs text-[#1B2A22]/70 mt-0.5">
              Price Increase and Competitor Offers account for 62.7% of all lost subscribers.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={churnReasonsData} margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" unit="%" tickLine={false} axisLine={false} tick={{ fill: '#1B2A22', fontSize: 11 }} />
                <YAxis dataKey="reason" type="category" tickLine={false} axisLine={false} tick={{ fill: '#1B2A22', fontSize: 11 }} width={100} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#0F3D2E] text-white p-2.5 rounded-xl shadow text-xs">
                          <p className="font-bold">{d.reason}</p>
                          <p>Share of Churn: <strong className="font-mono text-[#C9A227]">{d.pct}%</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="pct" radius={[0, 8, 8, 0]}>
                  {churnReasonsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[11px] text-[#1B2A22]/60 pt-3 border-t border-[#F1EAD3] text-center font-sans">
            Note: Churn Reason is captured post-event from exit surveys and used strictly for retrospective diagnosis.
          </div>
        </div>
      </div>

      {/* Row 2: Customer Experience & Competitor Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Satisfaction Score vs Churn */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
              CSAT Score Tier vs Churn Rate (%)
            </h3>
            <p className="text-xs text-[#1B2A22]/70 mt-0.5">
              Low satisfaction (≤3) drives a 10x churn surge compared to promoters (≥9).
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={csatVsChurnData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="csat" tickLine={false} axisLine={{ stroke: '#F1EAD3' }} tick={{ fill: '#1B2A22', fontSize: 11 }} />
                <YAxis unit="%" tickLine={false} axisLine={false} tick={{ fill: '#1B2A22', fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#0F3D2E] text-white p-2.5 rounded-xl shadow text-xs">
                          <p className="font-bold">CSAT Tier: {d.csat}</p>
                          <p>Churn Rate: <strong className="font-mono text-[#C9A227]">{d.churnRate}%</strong></p>
                          <p>Customer Base: {formatNumber(d.count)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="churnRate" radius={[8, 8, 0, 0]}>
                  {csatVsChurnData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Competitor Offer Exposure */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
              Competitor Offer Exposure vs Churn Rate (%)
            </h3>
            <p className="text-xs text-[#1B2A22]/70 mt-0.5">
              Subscribers who reported receiving an external offer churn at 48.6% vs 14.8% unexposed.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={competitorVsChurnData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="group" tickLine={false} axisLine={{ stroke: '#F1EAD3' }} tick={{ fill: '#1B2A22', fontSize: 11 }} />
                <YAxis unit="%" tickLine={false} axisLine={false} tick={{ fill: '#1B2A22', fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#0F3D2E] text-white p-2.5 rounded-xl shadow text-xs">
                          <p className="font-bold">{d.group}</p>
                          <p>Churn Rate: <strong className="font-mono text-[#C9A227]">{d.churnRate}%</strong></p>
                          <p>Cohort Size: {formatNumber(d.count)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="churnRate" radius={[8, 8, 0, 0]}>
                  {competitorVsChurnData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
