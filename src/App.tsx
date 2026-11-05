/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { AlertTriangle, RotateCw, ShieldAlert } from 'lucide-react';

import { Navigation } from './components/Navigation.js';
import { Header } from './components/Header.js';
import { FilterBar } from './components/FilterBar.js';
import { FloatingAiChat } from './components/FloatingAiChat.js';

import { ExecutiveOverview } from './pages/ExecutiveOverview.js';
import { RiskExplorer } from './pages/RiskExplorer.js';
import { Customer360 } from './pages/Customer360.js';
import { ChurnAnalytics } from './pages/ChurnAnalytics.js';
import { SegmentsPage } from './pages/SegmentsPage.js';
import { ModelLab } from './pages/ModelLab.js';
import { WhatIfPage } from './pages/WhatIfPage.js';
import { CampaignsPage } from './pages/CampaignsPage.js';
import { AiAssistantPage } from './pages/AiAssistantPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { DataHealthPage } from './pages/DataHealthPage.js';
import { SelfCheckPage } from './pages/SelfCheckPage.js';

import {
  fetchSnapshotMeta,
  fetchRefreshStatus,
  triggerRefresh,
  GlobalFilterState,
} from './lib/api.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 60 * 1000,
    },
  },
});

function AppContent() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [diffToast, setDiffToast] = useState<any>(null);

  // Global filters
  const [globalFilters, setGlobalFilters] = useState<GlobalFilterState>({
    serviceType: 'All',
    contractType: 'All',
    customerSegment: 'All',
    ukNation: 'All',
  });

  const [isManualRetrying, setIsManualRetrying] = useState(false);

  // Query snapshot metadata with robust retry and polling while initializing
  const { data: metaData, isLoading: metaLoading, error: metaError, refetch: refetchMeta } = useQuery({
    queryKey: ['meta'],
    queryFn: fetchSnapshotMeta,
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 6000),
    refetchInterval: (query) => (query.state.data?.isInitializing || !query.state.data?.meta ? 1500 : false),
  });

  // Polling refresh status while isRefreshing or while initializing
  const { data: refreshStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['refreshStatus'],
    queryFn: fetchRefreshStatus,
    refetchInterval: (query) => (query.state.data?.isRefreshing || metaData?.isInitializing || isManualRetrying ? 1500 : false),
  });

  // Single-flight refresh mutation (always forces fresh fetch from Google Sheet)
  const refreshMutation = useMutation({
    mutationFn: (force: boolean = true) => triggerRefresh(force),
    onSuccess: () => {
      refetchStatus();
    },
  });

  // When a refresh completes, invalidate all queries so every KPI, score, chart and table updates instantly
  useEffect(() => {
    if (refreshStatus && !refreshStatus.isRefreshing && refreshStatus.stage === 'completed') {
      queryClient.invalidateQueries();
      refetchMeta();
    }
  }, [refreshStatus?.isRefreshing, refreshStatus?.stage]);

  const isRefreshing = refreshMutation.isPending || !!refreshStatus?.isRefreshing || isManualRetrying;

  const handleManualRetry = async () => {
    setIsManualRetrying(true);
    try {
      await refreshMutation.mutateAsync(true);
      await refetchMeta();
    } catch (e) {
      console.error('Manual retry error:', e);
      // Ensure meta query is refetched to get latest status
      await refetchMeta();
    } finally {
      setIsManualRetrying(false);
    }
  };

  // Live Ingestion & Model Training Screen while initializing
  if ((metaData?.isInitializing || isManualRetrying || (!metaData?.meta && !metaError)) && !metaData?.meta) {
    const stageMsg = refreshStatus?.message || (isManualRetrying ? 'Connecting to Google Sheets and re-training models...' : 'Ingesting live subscriber records from Google Sheet...');
    const progress = refreshStatus?.stageProgressPercent || (isManualRetrying ? 40 : 25);

    return (
      <div className="min-h-screen bg-[#FAF6EA] flex items-center justify-center p-6 text-center select-none">
        <div className="bg-white border border-[#C9A227]/40 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-[#0F3D2E] text-[#C9A227] flex items-center justify-center mx-auto shadow-md">
            <RotateCw className="w-8 h-8 animate-spin" />
          </div>

          <div>
            <h2 className="font-serif text-2xl font-bold text-[#0F3D2E]">
              Initializing BritConnect Engine
            </h2>
            <p className="text-xs text-[#1B2A22]/70 mt-1.5 font-sans leading-relaxed">
              Ingesting 5,000 live subscriber records from Google Sheets, enforcing Zero Leakage firewall, training 5-fold cross-validated ML models, and calibrating risk tiers.
            </p>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-[#0F3D2E]">
              <span className="font-semibold truncate max-w-[320px]">{stageMsg}</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <div className="h-3 w-full bg-[#FAF6EA] rounded-full overflow-hidden p-0.5 border border-[#F1EAD3]">
              <div
                className="h-full bg-gradient-to-r from-[#1F7A4D] via-[#C9A227] to-[#1F7A4D] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[#1B2A22]/60 font-sans border-t border-[#F1EAD3]">
            Data Source: Primary Sheet ID <span className="font-mono text-[#0F3D2E] font-semibold">1sS3zh9SS8...pVucXU9_E</span>
          </div>
        </div>
      </div>
    );
  }

  // Honest Error State with explicit Retry action if data cannot be loaded (never fallback to fake data)
  if (metaError && !metaData?.meta) {
    const errorMsg = metaError instanceof Error ? metaError.message : (metaData as any)?.error || 'Network error or sheet unreachable';

    return (
      <div className="min-h-screen bg-[#FAF6EA] flex items-center justify-center p-6 text-center">
        <div className="bg-white border-2 border-[#B5483A]/40 rounded-3xl p-8 max-w-xl shadow-xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-[#B5483A] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#0F3D2E]">
            Unable to Load Customer Dataset
          </h2>
          <p className="text-xs text-[#1B2A22]/80 leading-relaxed font-sans">
            BritConnect requires live customer data from Google Sheets to guarantee reproducibility.
            The server encountered an issue connecting to the primary spreadsheet.
          </p>

          <div className="p-3 bg-red-50 text-red-900 font-mono text-xs rounded-xl border border-red-200 text-left overflow-x-auto whitespace-pre-wrap">
            {errorMsg}
          </div>

          {/* Explanation on Data Direction */}
          <div className="p-3 bg-[#FAF6EA] rounded-xl border border-[#F1EAD3] text-left text-xs space-y-1.5 text-[#1B2A22]/80">
            <div className="font-semibold text-[#0F3D2E] flex items-center gap-1.5">
              <span>ℹ️ Google Sheets Integration Note:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              BritConnect reads <strong>from</strong> the Google Sheet into the dashboard. To protect your raw billing records, BritConnect is read-only and does not modify the source Google Sheet. Any updates or changes you make in Google Sheets sync directly into BritConnect when you click Sync/Retry below.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleManualRetry}
              disabled={isManualRetrying}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all ${
                isManualRetrying
                  ? 'bg-[#0F3D2E]/70 text-white cursor-wait'
                  : 'bg-[#0F3D2E] text-[#FAF6EA] hover:bg-[#1F7A4D]'
              }`}
            >
              <RotateCw className={`w-4 h-4 text-[#C9A227] ${isManualRetrying ? 'animate-spin' : ''}`} />
              <span>{isManualRetrying ? 'Syncing Sheet & Re-training ML...' : 'Retry Connection Now'}</span>
            </button>

            <a
              href="https://docs.google.com/spreadsheets/d/1sS3zh9SS8ptrAE-qg31L1lUNcb_PE6usl0pVucXU9_E/edit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#0F3D2E]/20 text-[#0F3D2E] hover:bg-[#FAF6EA] text-xs font-semibold transition-all"
            >
              <span>Open Primary Sheet</span>
              <span className="text-[11px]">↗</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAF6EA] text-[#1B2A22]">
      {/* Sidebar Navigation */}
      <Navigation
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        rowCount={metaData?.meta?.rowCount}
        modelVersion={metaData?.meta?.modelVersion}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenAiAssistant={() => setIsAiChatOpen(true)}
          isRefreshing={isRefreshing}
          refreshStageMessage={refreshStatus?.message}
          lastRefreshed={metaData?.meta?.timestamp}
          rowCount={metaData?.meta?.rowCount}
          dataQualityScore={metaData?.qualityScore}
          onTriggerRefresh={(force) => refreshMutation.mutate(force ?? true)}
          diffToast={diffToast}
          onDismissDiffToast={() => setDiffToast(null)}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {/* Global Filter Bar */}
          <FilterBar
            filters={globalFilters}
            onChange={setGlobalFilters}
            onReset={() =>
              setGlobalFilters({
                serviceType: 'All',
                contractType: 'All',
                customerSegment: 'All',
                ukNation: 'All',
              })
            }
          />

          <Routes>
            <Route path="/" element={<ExecutiveOverview filters={globalFilters} />} />
            <Route path="/risk-explorer" element={<RiskExplorer globalFilters={globalFilters} />} />
            <Route path="/customers/:id" element={<Customer360 />} />
            <Route path="/churn-analytics" element={<ChurnAnalytics globalFilters={globalFilters} />} />
            <Route path="/segments" element={<SegmentsPage />} />
            <Route path="/model-lab" element={<ModelLab />} />
            <Route path="/what-if" element={<WhatIfPage globalFilters={globalFilters} />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/assistant" element={<AiAssistantPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/data-health" element={<DataHealthPage />} />
            <Route path="/self-check" element={<SelfCheckPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Floating AI Chat Assistant Drawer */}
      <FloatingAiChat
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
