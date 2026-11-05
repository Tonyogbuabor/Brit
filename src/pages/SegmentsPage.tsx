import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PieChart as PieIcon,
  Shield,
  Wrench,
  HeartHandshake,
  Eye,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { fetchSegments } from '../lib/api.js';
import { formatCurrency, formatPercent, formatNumber } from '../lib/formatters.js';

export const SegmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['segments'],
    queryFn: fetchSegments,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-[#F1EAD3] rounded-xl w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-white rounded-2xl border border-[#F1EAD3]" />
          ))}
        </div>
      </div>
    );
  }

  const personas = data.personas;

  // Group personas into Value x Risk 2x2 Matrix Quadrants
  const quadrants = {
    Protect: {
      title: 'Protect (High Value • High Risk)',
      desc: 'Top revenue contributors with elevated churn risk. Prioritise for immediate VIP white-glove retention.',
      color: 'border-[#B5483A] bg-[#B5483A]/5 text-[#B5483A]',
      badge: 'bg-[#B5483A] text-white',
      icon: Shield,
      personas: personas.filter((p) => p.quadrant === 'Protect'),
    },
    Fix: {
      title: 'Fix (Low Value • High Risk)',
      desc: 'High friction or rolling subscribers experiencing technical issues. Offer digital self-serve fixes or basic discounts.',
      color: 'border-[#C9A227] bg-[#C9A227]/5 text-[#0F3D2E]',
      badge: 'bg-[#C9A227] text-[#0F3D2E]',
      icon: Wrench,
      personas: personas.filter((p) => p.quadrant === 'Fix'),
    },
    Nurture: {
      title: 'Nurture (High Value • Low Risk)',
      desc: 'Sticky, loyal high-tier accounts. Cross-sell bundles and deliver proactive loyalty perks to maintain advocacy.',
      color: 'border-[#1F7A4D] bg-[#1F7A4D]/5 text-[#1F7A4D]',
      badge: 'bg-[#1F7A4D] text-white',
      icon: HeartHandshake,
      personas: personas.filter((p) => p.quadrant === 'Nurture'),
    },
    Monitor: {
      title: 'Monitor (Low Value • Low Risk)',
      desc: 'Stable low-maintenance baseline subscribers. Maintain automated digital billing with minimal intervention.',
      color: 'border-[#0F3D2E] bg-[#0F3D2E]/5 text-[#0F3D2E]',
      badge: 'bg-[#0F3D2E] text-white',
      icon: Eye,
      personas: personas.filter((p) => p.quadrant === 'Monitor'),
    },
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#0F3D2E] tracking-tight">
          Customer Personas & Value × Risk Matrix
        </h2>
        <p className="text-xs text-[#1B2A22]/70 mt-0.5">
          Unsupervised K-means++ clustering on standardized behavioral and commercial attributes (excluding outcome labels).
        </p>
      </div>

      {/* Strategic 2x2 Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(Object.keys(quadrants) as Array<keyof typeof quadrants>).map((qKey) => {
          const q = quadrants[qKey];
          const Icon = q.icon;
          const totalCusts = q.personas.reduce((acc, p) => acc + p.customerCount, 0);
          const totalMrr = q.personas.reduce((acc, p) => acc + p.totalMrrGbp, 0);
          const totalRiskMrr = q.personas.reduce((acc, p) => acc + p.expectedMrrAtRiskGbp, 0);

          return (
            <div
              key={qKey}
              className={`rounded-2xl p-6 border-2 shadow-xs flex flex-col justify-between ${q.color}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 shrink-0" />
                    <h3 className="font-serif text-base font-bold text-[#0F3D2E]">
                      {q.title}
                    </h3>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${q.badge}`}>
                    {formatNumber(totalCusts)} subs
                  </span>
                </div>

                <p className="text-xs text-[#1B2A22]/80 leading-relaxed mb-4">
                  {q.desc}
                </p>

                {/* Personas inside this quadrant */}
                <div className="space-y-3">
                  {q.personas.length === 0 ? (
                    <div className="text-xs text-[#1B2A22]/50 italic">
                      No active personas currently fall in this quadrant.
                    </div>
                  ) : (
                    q.personas.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => navigate(`/risk-explorer?personaId=${p.id}`)}
                        className="bg-white p-3.5 rounded-xl border border-[#F1EAD3] hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-bold text-xs text-[#0F3D2E] group-hover:text-[#1F7A4D]">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-[#1B2A22]/60 mt-0.5">
                            {formatNumber(p.customerCount)} customers ({p.percentageOfActive}%) • MRR: {formatCurrency(p.totalMrrGbp)}
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-2">
                          <div>
                            <div className="text-xs font-mono font-bold text-[#B5483A]">
                              {formatCurrency(p.expectedMrrAtRiskGbp)} / mo
                            </div>
                            <div className="text-[10px] text-[#1B2A22]/50">
                              Risk: {(p.averageRiskProbability * 100).toFixed(0)}%
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[#1B2A22]/40 group-hover:text-[#0F3D2E] group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Financial summary footer */}
              <div className="mt-5 pt-3 border-t border-black/10 flex items-center justify-between text-xs font-tabular">
                <span>Total Quadrant MRR: <strong>{formatCurrency(totalMrr)}</strong></span>
                <span>Expected Risk: <strong className="text-[#B5483A]">{formatCurrency(totalRiskMrr)}/mo</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Persona Characteristics Detailed Table */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
        <h3 className="font-serif text-lg font-bold text-[#0F3D2E] mb-4">
          Persona Centroid Feature Benchmarks
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#F1EAD3] text-[#1B2A22]/70 font-semibold bg-[#FAF6EA]">
                <th className="py-2.5 px-3">Persona Name</th>
                <th className="py-2.5 px-3">Quadrant</th>
                <th className="py-2.5 px-3">Avg Monthly Spend</th>
                <th className="py-2.5 px-3">Avg Monthly Usage</th>
                <th className="py-2.5 px-3">Avg Complaints</th>
                <th className="py-2.5 px-3">Avg Outages</th>
                <th className="py-2.5 px-3">Mean CSAT</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EAD3]">
              {personas.map((p) => {
                const s = p.centroidCharacteristics;
                return (
                  <tr key={p.id} className="hover:bg-[#FAF6EA]/50">
                    <td className="py-3 px-3 font-bold text-[#0F3D2E]">{p.name}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1F7A4D]/10 text-[#1F7A4D]">
                        {p.quadrant}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold">
                      £{s.monthlyChargeGbp?.mean || 35}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {s.averageMonthlyUsageGb?.mean || 60} GB
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {s.complaints12M?.mean || 0.2}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {s.networkOutages12M?.mean || 1.1}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#1F7A4D]">
                      {s.satisfactionScore?.mean || 7.2} / 10
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigate(`/risk-explorer?personaId=${p.id}`)}
                        className="text-xs font-semibold text-[#1F7A4D] hover:underline"
                      >
                        Filter Accounts →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
