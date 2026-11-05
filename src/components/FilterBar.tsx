import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { GlobalFilterState } from '../lib/api.js';

interface FilterBarProps {
  filters: GlobalFilterState;
  onChange: (filters: GlobalFilterState) => void;
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange, onReset }) => {
  const isFiltered =
    filters.serviceType !== 'All' ||
    filters.contractType !== 'All' ||
    filters.customerSegment !== 'All' ||
    filters.ukNation !== 'All';

  return (
    <div className="bg-white/80 border border-[#F1EAD3] rounded-2xl p-3.5 mb-6 shadow-xs backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] tracking-wider uppercase">
          <Filter className="w-3.5 h-3.5 text-[#C9A227]" />
          <span>Global Cohort Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Service Type */}
          <select
            value={filters.serviceType}
            onChange={(e) => onChange({ ...filters, serviceType: e.target.value })}
            className="text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-2.5 py-1.5 text-[#1B2A22] font-medium focus:ring-2 focus:ring-[#C9A227] focus:outline-none"
          >
            <option value="All">All Services</option>
            <option value="Mobile">Mobile Only</option>
            <option value="Home Broadband">Home Broadband</option>
            <option value="Fibre Broadband">Fibre Broadband</option>
            <option value="Mobile + Broadband Bundle">Bundles</option>
          </select>

          {/* Contract Type */}
          <select
            value={filters.contractType}
            onChange={(e) => onChange({ ...filters, contractType: e.target.value })}
            className="text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-2.5 py-1.5 text-[#1B2A22] font-medium focus:ring-2 focus:ring-[#C9A227] focus:outline-none"
          >
            <option value="All">All Contracts</option>
            <option value="Rolling Monthly">Rolling Monthly</option>
            <option value="12 Months">12 Months Fixed</option>
            <option value="24 Months">24 Months Fixed</option>
          </select>

          {/* Customer Segment */}
          <select
            value={filters.customerSegment}
            onChange={(e) => onChange({ ...filters, customerSegment: e.target.value })}
            className="text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-2.5 py-1.5 text-[#1B2A22] font-medium focus:ring-2 focus:ring-[#C9A227] focus:outline-none"
          >
            <option value="All">All Segments</option>
            <option value="Consumer">Consumer</option>
            <option value="Small Business">Small Business</option>
            <option value="Enterprise">Enterprise</option>
          </select>

          {/* UK Nation */}
          <select
            value={filters.ukNation}
            onChange={(e) => onChange({ ...filters, ukNation: e.target.value })}
            className="text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-2.5 py-1.5 text-[#1B2A22] font-medium focus:ring-2 focus:ring-[#C9A227] focus:outline-none"
          >
            <option value="All">All UK Nations</option>
            <option value="England">England</option>
            <option value="Scotland">Scotland</option>
            <option value="Wales">Wales</option>
            <option value="Northern Ireland">Northern Ireland</option>
          </select>

          {/* Reset button */}
          {isFiltered && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-[#B5483A] hover:bg-[#B5483A]/10 px-2 py-1.5 rounded-lg transition-colors font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
