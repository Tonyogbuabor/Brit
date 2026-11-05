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

  // Query snapshot metadata
  const { data: metaData, isLoading: metaLoading, error: metaError, refetch: refetchMeta } = useQuery({
    queryKey: ['meta'],
    queryFn: fetchSnapshotMeta,
    retry: 1,
  });

  // Polling refresh status while isRefreshing
  const { data: refreshStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['refreshStatus'],
    queryFn: fetchRefreshStatus,
    refetchInterval: (query) => (query.state.data?.isRefreshing ? 1500 : false),
  });

  // Single-flight refresh mutation
  const refreshMutation = useMutation({
    mutationFn: (force?: boolean) => triggerRefresh(force),
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

  const isRefreshing = refreshMutation.isPending || !!refreshStatus?.isRefreshing;

  // Honest Error State with explicit Retry action if data cannot be loaded (never fallback to fake data)
  if (metaError && !metaData) {
    return (
      <div className="min-h-screen bg-[#FAF6EA] flex items-center justify-center p-6 text-center">
        <div className="bg-white border-2 border-[#B5483A]/40 rounded-3xl p-8 max-w-lg shadow-xl space-y-4">
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
          <div className="p-3 bg-red-50 text-red-900 font-mono text-xs rounded-xl border border-red-200 text-left overflow-x-auto">
            {metaError instanceof Error ? metaError.message : 'Network error or sheet unreachable'}
          </div>
          <div className="pt-2">
            <button
              onClick={() => {
                refreshMutation.mutate(true);
                refetchMeta();
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0F3D2E] text-[#FAF6EA] hover:bg-[#1F7A4D] text-xs font-bold shadow-md transition-all"
            >
              <RotateCw className="w-4 h-4 text-[#C9A227]" />
              <span>Retry Connection Now</span>
            </button>
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
          onTriggerRefresh={(force) => refreshMutation.mutate(force)}
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
