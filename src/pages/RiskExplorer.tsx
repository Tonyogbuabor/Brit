import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
  User,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { fetchCustomers, GlobalFilterState } from '../lib/api.js';
import { formatCurrency, formatPercent, formatNumber } from '../lib/formatters.js';

interface RiskExplorerProps {
  globalFilters: GlobalFilterState;
}

export const RiskExplorer: React.FC<RiskExplorerProps> = ({ globalFilters }) => {
  const navigate = useNavigate();

  // Local filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [riskTier, setRiskTier] = useState('All');
  const [churnStatus, setChurnStatus] = useState('Active'); // default to actionable active base
  const [sortBy, setSortBy] = useState('expectedMrrAtRiskGbp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const limit = 25;

  const queryParams = {
    search: searchTerm,
    riskTier: riskTier !== 'All' ? riskTier : '',
    churnStatus: churnStatus !== 'All' ? churnStatus : '',
    serviceType: globalFilters.serviceType !== 'All' ? globalFilters.serviceType : '',
    contractType: globalFilters.contractType !== 'All' ? globalFilters.contractType : '',
    customerSegment: globalFilters.customerSegment !== 'All' ? globalFilters.customerSegment : '',
    ukNation: globalFilters.ukNation !== 'All' ? globalFilters.ukNation : '',
    sortBy,
    sortOrder,
    page: String(page),
    limit: String(limit),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['customers', queryParams],
    queryFn: () => fetchCustomers(queryParams),
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const exportFilteredCsv = () => {
    const params = new URLSearchParams(queryParams);
    window.open(`/api/reports/call-list-csv?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#0F3D2E] tracking-tight">
            Customer Risk Explorer
          </h2>
          <p className="text-xs text-[#1B2A22]/70 mt-0.5">
            Ranked subscriber base with out-of-fold calibrated probabilities and primary risk drivers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportFilteredCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#C9A227]/40 text-[#0F3D2E] hover:bg-[#FAF6EA] text-xs font-semibold shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-[#1B2A22]/40 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Customer ID, City, or Plan..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl text-[#1B2A22] focus:ring-2 focus:ring-[#C9A227] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status selector */}
          <select
            value={churnStatus}
            onChange={(e) => {
              setChurnStatus(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-2.5 py-1.5 font-medium text-[#1B2A22] focus:ring-2 focus:ring-[#C9A227]"
          >
            <option value="Active">Active Subscribers (Actionable)</option>
            <option value="Churned">Historical Churned</option>
            <option value="All">All Statuses</option>
          </select>

          {/* Risk Tier selector */}
          <select
            value={riskTier}
            onChange={(e) => {
              setRiskTier(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-2.5 py-1.5 font-medium text-[#1B2A22] focus:ring-2 focus:ring-[#C9A227]"
          >
            <option value="All">All Risk Tiers</option>
            <option value="Critical">Critical (≥65%)</option>
            <option value="High">High (40-65%)</option>
            <option value="Medium">Medium (20-40%)</option>
            <option value="Low">Low (&lt;20%)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0F3D2E] text-[#FAF6EA] font-semibold border-b border-[#1F7A4D]/40 select-none">
                <th
                  onClick={() => handleSort('customerId')}
                  className="py-3 px-4 cursor-pointer hover:bg-[#1F7A4D]/50"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Customer ID</span>
                    <ArrowUpDown className="w-3 h-3 text-[#A8C3A0]" />
                  </div>
                </th>
                <th className="py-3 px-4">Service & Plan</th>
                <th
                  onClick={() => handleSort('monthlyChargeGbp')}
                  className="py-3 px-4 cursor-pointer hover:bg-[#1F7A4D]/50"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Monthly (£)</span>
                    <ArrowUpDown className="w-3 h-3 text-[#A8C3A0]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('churnProbability')}
                  className="py-3 px-4 cursor-pointer hover:bg-[#1F7A4D]/50"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Churn Risk</span>
                    <ArrowUpDown className="w-3 h-3 text-[#A8C3A0]" />
                  </div>
                </th>
                <th className="py-3 px-4">Risk Tier</th>
                <th
                  onClick={() => handleSort('expectedMrrAtRiskGbp')}
                  className="py-3 px-4 cursor-pointer hover:bg-[#1F7A4D]/50"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Expected Risk MRR</span>
                    <ArrowUpDown className="w-3 h-3 text-[#A8C3A0]" />
                  </div>
                </th>
                <th className="py-3 px-4">Persona Segment</th>
                <th className="py-3 px-4">Primary Risk Driver</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EAD3]">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#1B2A22]/60">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
                      <span>Loading customer scores...</span>
                    </div>
                  </td>
                </tr>
              ) : !data || data.customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#1B2A22]/60">
                    No customers match the active filters or search terms.
                  </td>
                </tr>
              ) : (
                data.customers.map((c) => {
                  const prob = c.churnProbability;
                  const tier = c.riskTier;
                  const isCritical = tier === 'Critical';
                  const isHigh = tier === 'High';

                  return (
                    <tr
                      key={c.customerId}
                      onClick={() => navigate(`/customers/${c.customerId}`)}
                      className="hover:bg-[#FAF6EA]/80 cursor-pointer transition-colors"
                    >
                      {/* Customer ID */}
                      <td className="py-3 px-4 font-mono font-bold text-[#0F3D2E]">
                        {c.customerId}
                      </td>

                      {/* Service & Plan */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#1B2A22]">{c.serviceType}</div>
                        <div className="text-[11px] text-[#1B2A22]/60 font-sans">{c.planName} • {c.contractType}</div>
                      </td>

                      {/* Monthly Charge */}
                      <td className="py-3 px-4 font-mono font-semibold text-[#1B2A22]">
                        {formatCurrency(c.monthlyChargeGbp)}
                      </td>

                      {/* Churn Probability */}
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isCritical ? 'text-[#B5483A]' : isHigh ? 'text-[#C9A227]' : 'text-[#1F7A4D]'}`}>
                            {formatPercent(prob, true)}
                          </span>
                        </div>
                      </td>

                      {/* Tier Chip */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tier === 'Critical' ? 'bg-[#B5483A]/15 text-[#B5483A] border border-[#B5483A]/30' :
                          tier === 'High' ? 'bg-[#C9A227]/20 text-[#0F3D2E] border border-[#C9A227]/40' :
                          tier === 'Medium' ? 'bg-[#1F7A4D]/15 text-[#1F7A4D]' :
                          'bg-[#0F3D2E]/10 text-[#0F3D2E]'
                        }`}>
                          {tier}
                        </span>
                      </td>

                      {/* Expected Risk MRR */}
                      <td className="py-3 px-4 font-mono font-bold text-[#0F3D2E]">
                        {formatCurrency(c.expectedMrrAtRiskGbp)}
                      </td>

                      {/* Persona */}
                      <td className="py-3 px-4 text-[11px] text-[#1B2A22]/80">
                        {c.personaName}
                      </td>

                      {/* Top Driver */}
                      <td className="py-3 px-4 text-[11px] text-[#1B2A22]/70 max-w-[200px] truncate" title={c.topRiskDrivers[0]?.narrative}>
                        {c.topRiskDrivers[0]?.narrative || 'None'}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[#1F7A4D] font-semibold text-[11px] hover:underline">
                          <span>Profile</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {data && data.totalPages > 1 && (
          <div className="px-4 py-3 bg-[#FAF6EA]/50 border-t border-[#F1EAD3] flex items-center justify-between text-xs text-[#1B2A22]/70">
            <div>
              Showing <strong className="font-mono">{(page - 1) * limit + 1}</strong> to{' '}
              <strong className="font-mono">{Math.min(page * limit, data.total)}</strong> of{' '}
              <strong className="font-mono">{formatNumber(data.total)}</strong> subscribers
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded-lg border border-[#F1EAD3] bg-white hover:bg-[#FAF6EA] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono font-semibold px-2">
                {page} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="p-1 rounded-lg border border-[#F1EAD3] bg-white hover:bg-[#FAF6EA] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
