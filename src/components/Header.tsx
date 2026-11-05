import React, { useState } from 'react';
import {
  RotateCw,
  Menu,
  ShieldCheck,
  AlertTriangle,
  Bot,
  Layers,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';
import { formatCurrency } from '../lib/formatters.js';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenAiAssistant: () => void;
  isRefreshing: boolean;
  refreshStageMessage?: string;
  lastRefreshed?: string;
  rowCount?: number;
  dataQualityScore?: number;
  onTriggerRefresh: (force?: boolean) => void;
  diffToast?: {
    totalCustomersDelta: number;
    newlyChurnedCount: number;
    tierMoversCount: number;
    expectedMrrAtRiskDelta: number;
  } | null;
  onDismissDiffToast?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenAiAssistant,
  isRefreshing,
  refreshStageMessage,
  lastRefreshed,
  rowCount,
  dataQualityScore = 98.4,
  onTriggerRefresh,
  diffToast,
  onDismissDiffToast,
}) => {
  const [showRefreshMenu, setShowRefreshMenu] = useState(false);

  // Format time relative or UK locale
  const formattedTime = lastRefreshed
    ? new Date(lastRefreshed).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Just now';

  return (
    <header className="sticky top-0 z-30 bg-[#FAF6EA]/95 backdrop-blur border-b border-[#F1EAD3] px-4 md:px-8 py-3.5 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Context breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="p-2 -ml-2 rounded-lg text-[#0F3D2E] hover:bg-[#F1EAD3] md:hidden focus:ring-2 focus:ring-[#C9A227]"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-base font-bold text-[#0F3D2E] tracking-tight">
                Telecom Customer Intelligence
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1F7A4D]/10 text-[#0F3D2E] border border-[#1F7A4D]/20">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1F7A4D]" />
                Zero Leakage Active
              </span>
            </div>
            <p className="text-xs text-[#1B2A22]/70 font-sans hidden sm:block">
              Connected to Primary Sheet (5,000 live subscriber records)
            </p>
          </div>
        </div>

        {/* Right Action Controls: Data Health, AI Assistant & Refresh Button */}
        <div className="flex items-center gap-3">
          {/* Data Health Quality Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#F1EAD3] shadow-xs text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[#1B2A22]/80 font-medium">Data Health:</span>
            <span className="font-mono font-bold text-[#0F3D2E]">
              {dataQualityScore}%
            </span>
          </div>

          {/* Open Google Sheet External Link */}
          <a
            href="https://docs.google.com/spreadsheets/d/1sS3zh9SS8ptrAE-qg31L1lUNcb_PE6usl0pVucXU9_E/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#F1EAD3] hover:bg-[#FAF6EA] text-[#0F3D2E] transition-colors text-xs font-semibold shadow-xs"
            title="Open primary live Google Sheet in new tab to edit customer rows"
          >
            <span>Open Sheet</span>
            <span className="text-[10px] text-gray-400 font-normal">↗</span>
          </a>

          {/* AI Assistant Quick Trigger */}
          <button
            onClick={onOpenAiAssistant}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F3D2E] text-[#FAF6EA] hover:bg-[#1F7A4D] transition-colors text-xs font-semibold shadow-xs"
            title="Open Gemini Retention Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C9A227]" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>

          {/* Prominent Refresh Button */}
          <div className="relative group/refresh">
            <button
              onClick={() => onTriggerRefresh(true)}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                isRefreshing
                  ? 'bg-[#F1EAD3] text-[#1B2A22]/50 cursor-not-allowed border border-[#C9A227]/30'
                  : 'bg-[#C9A227] text-[#0F3D2E] hover:bg-[#E4C766] active:scale-[0.98] border border-[#C9A227]/50'
              }`}
              title="Fetches latest edits from Google Sheet into BritConnect. (The source sheet is read-only and never overwritten)."
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#0F3D2E]' : ''}`} />
              <span>{isRefreshing ? 'Syncing Sheet...' : 'Refresh Sheet'}</span>
            </button>

            {/* Sub-label under Refresh button */}
            <div className="text-[10px] text-right text-[#1B2A22]/60 mt-0.5 font-tabular">
              {isRefreshing ? (
                <span className="text-[#0F3D2E] font-medium animate-pulse truncate max-w-[150px] inline-block">
                  {refreshStageMessage || 'Syncing...'}
                </span>
              ) : (
                <span>Last: {formattedTime}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot Diff Notification Toast */}
      {diffToast && (
        <div className="mt-3 p-3 bg-white border border-[#C9A227]/40 rounded-xl shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2.5 text-xs text-[#0F3D2E]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-semibold">Snapshot Ingested & Retrained:</span>{' '}
              <span>
                {diffToast.newlyChurnedCount > 0 ? `${diffToast.newlyChurnedCount} newly churned, ` : ''}
                {diffToast.tierMoversCount} risk tier updates. MRR at risk changed by{' '}
                <strong className="font-mono">
                  {diffToast.expectedMrrAtRiskDelta >= 0 ? '+' : ''}
                  {formatCurrency(diffToast.expectedMrrAtRiskDelta)}
                </strong>
                .
              </span>
            </div>
          </div>
          {onDismissDiffToast && (
            <button
              onClick={onDismissDiffToast}
              className="p-1 rounded-md text-[#1B2A22]/50 hover:text-[#1B2A22] hover:bg-[#F1EAD3]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </header>
  );
};
