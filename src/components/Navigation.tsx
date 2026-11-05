import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BarChart3,
  PieChart,
  BrainCircuit,
  SlidersHorizontal,
  Megaphone,
  BotMessageSquare,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Layers,
} from 'lucide-react';

interface NavigationProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  rowCount?: number;
  modelVersion?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  isMobileOpen,
  onCloseMobile,
  rowCount,
  modelVersion,
}) => {
  const navItems = [
    { to: '/', label: 'Executive Overview', icon: LayoutDashboard },
    { to: '/risk-explorer', label: 'Risk Explorer', icon: Users },
    { to: '/churn-analytics', label: 'Churn Analytics', icon: BarChart3 },
    { to: '/segments', label: 'Customer Segments', icon: PieChart },
    { to: '/model-lab', label: 'Model Lab & Fairness', icon: BrainCircuit },
    { to: '/what-if', label: 'What-If Simulator', icon: SlidersHorizontal },
    { to: '/campaigns', label: 'Retention Campaigns', icon: Megaphone },
    { to: '/assistant', label: 'AI Assistant', icon: BotMessageSquare },
    { to: '/reports', label: 'Reports & Exports', icon: FileSpreadsheet },
    { to: '/data-health', label: 'Data Health & Quality', icon: Activity },
    { to: '/self-check', label: 'Platform Self-Check', icon: CheckCircle2 },
  ];

  const content = (
    <div className="flex flex-col h-full bg-[#0F3D2E] text-[#FAF6EA] select-none">
      {/* Brand Header */}
      <div className="px-6 py-5 border-b border-[#1F7A4D]/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#C9A227] flex items-center justify-center text-[#0F3D2E] font-serif font-bold text-lg shadow-sm">
            B
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold tracking-tight text-[#FAF6EA]">
              BritConnect
            </h1>
            <p className="text-xs text-[#A8C3A0] font-sans font-medium">
              Churn Intelligence Platform
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#A8C3A0]/70">
          Analytics & Strategy
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#C9A227] text-[#0F3D2E] font-semibold shadow-sm'
                    : 'text-[#FAF6EA]/85 hover:text-[#FAF6EA] hover:bg-[#1F7A4D]/40'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Snapshot Metadata Stamp in Footer */}
      <div className="p-4 border-t border-[#1F7A4D]/40 bg-[#0B2E23] text-xs">
        <div className="flex items-center justify-between text-[#A8C3A0] mb-1.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Ingest Active
          </span>
          <span className="font-tabular font-mono text-[11px] bg-[#1F7A4D]/50 px-1.5 py-0.5 rounded text-[#FAF6EA]">
            {rowCount ? `${rowCount.toLocaleString()} rows` : 'Syncing'}
          </span>
        </div>
        <div className="text-[11px] text-[#A8C3A0]/80 truncate font-mono">
          Model: {modelVersion || 'v2.4-prod'}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-[#1F7A4D]/30 shadow-md h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </div>
    </>
  );
};
