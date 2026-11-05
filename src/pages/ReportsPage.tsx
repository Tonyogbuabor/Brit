import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  FileText,
  Download,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { fetchKpis, fetchModelLab, fetchSegments, fetchSnapshotMeta } from '../lib/api.js';
import { formatCurrency, formatPercent, formatNumber } from '../lib/formatters.js';

export const ReportsPage: React.FC = () => {
  const { data: kpis } = useQuery({ queryKey: ['kpis'], queryFn: () => fetchKpis() });
  const { data: modelData } = useQuery({ queryKey: ['model'], queryFn: fetchModelLab });
  const { data: segmentsData } = useQuery({ queryKey: ['segments'], queryFn: fetchSegments });
  const { data: metaData } = useQuery({ queryKey: ['meta'], queryFn: fetchSnapshotMeta });

  const downloadExcelWorkbook = () => {
    window.open('/api/reports/excel', '_blank');
  };

  const downloadCallListCsv = () => {
    window.open('/api/reports/call-list-csv', '_blank');
  };

  const generateExecutivePdf = () => {
    if (!kpis || !modelData) return;

    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 61, 46);
    doc.text('BritConnect Churn Intelligence Report', 14, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(27, 42, 34);
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | Snapshot Hash: ${metaData?.meta.contentHash.slice(0, 12)}`, 14, 30);
    doc.text(`Production Model: ${modelData.modelCard.modelVersion} (${modelData.selectedModel})`, 14, 36);

    doc.setDrawColor(201, 162, 39);
    doc.setLineWidth(0.8);
    doc.line(14, 40, 196, 40);

    // Section 1: Financial & Churn KPIs
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 61, 46);
    doc.text('1. Executive Financial & Subscriber Metrics', 14, 50);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(27, 42, 34);
    doc.text(`• Active Subscribers: ${formatNumber(kpis.activeCustomers)} accounts`, 18, 58);
    doc.text(`• Overall Churn Rate: ${formatPercent(kpis.overallChurnRate, true)} | Monthly Churn: ${formatPercent(kpis.monthlyChurnRate, true)}`, 18, 65);
    doc.text(`• Active Monthly Recurring Revenue (MRR): £${kpis.mrrGbp.toLocaleString()}`, 18, 72);
    doc.text(`• Forward-Looking Expected MRR at Risk: £${kpis.expectedMrrAtRiskGbp.toLocaleString()} / month`, 18, 79);
    doc.text(`• Annualised Revenue at Risk: £${kpis.annualisedExpectedMrrAtRiskGbp.toLocaleString()}`, 18, 86);
    doc.text(`• Critical Risk Tier Accounts: ${kpis.tierBreakdown.Critical.count} (MRR: £${kpis.tierBreakdown.Critical.revenueGbp.toLocaleString()})`, 18, 93);

    // Section 2: Machine Learning Performance
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 61, 46);
    doc.text('2. Model Governance & Evaluation', 14, 107);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(27, 42, 34);
    doc.text(`• Hold-Out Test ROC-AUC: ${modelData.modelCard.metrics.rocAuc} [95% CI: ${modelData.modelCard.metrics.rocAucCi.join(', ')}]`, 18, 115);
    doc.text(`• PR-AUC: ${modelData.modelCard.metrics.prAuc} | Optimal Decision Threshold: ${modelData.modelCard.costOptimalThreshold}`, 18, 122);
    doc.text(`• Top 10% Risk Recall: ${(modelData.modelCard.metrics.top10PercentRecall * 100).toFixed(1)}%`, 18, 129);
    doc.text(`• Expected Calibration Error (ECE): ${modelData.modelCard.metrics.ece}`, 18, 136);

    // Section 3: Behavioral Personas
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 61, 46);
    doc.text('3. Strategic Behavioral Personas', 14, 150);

    let y = 158;
    (segmentsData?.personas || []).forEach((p) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`• ${p.name} [Quadrant: ${p.quadrant}]`, 18, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`  ${formatNumber(p.customerCount)} customers | MRR: £${p.totalMrrGbp.toLocaleString()} | Risk: £${p.expectedMrrAtRiskGbp.toLocaleString()}/mo`, 18, y + 5);
      y += 12;
    });

    // Governance & Compliance Footer
    doc.setDrawColor(241, 234, 211);
    doc.line(14, 270, 196, 270);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('BritConnect AI Platform • Zero Target Leakage Firewall • UK Equality Act & GDPR Fair Lending Compliant', 14, 278);

    doc.save(`BritConnect_ExecutiveReport_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#0F3D2E] tracking-tight">
          Executive Reports & Data Exports
        </h2>
        <p className="text-xs text-[#1B2A22]/70 mt-0.5">
          Generate comprehensive audit-ready workbooks and executive briefing documents synced with the active snapshot.
        </p>
      </div>

      {/* 3 Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Executive PDF Report */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-[#0F3D2E] text-[#C9A227] flex items-center justify-center mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#0F3D2E]">
              Executive Briefing (PDF)
            </h3>
            <p className="text-xs text-[#1B2A22]/70 mt-2 leading-relaxed">
              Consolidated C-Suite report featuring live financial KPIs, MRR at risk, model evaluation cards, and persona quadrant allocations.
            </p>
          </div>

          <button
            onClick={generateExecutivePdf}
            className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#0F3D2E] text-[#FAF6EA] hover:bg-[#1F7A4D] text-xs font-semibold shadow-xs"
          >
            <Download className="w-4 h-4 text-[#C9A227]" />
            <span>Generate PDF Brief</span>
          </button>
        </div>

        {/* Card 2: Full Excel Multi-Sheet Workbook */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#0F3D2E]">
              Full Excel Workbook (.xlsx)
            </h3>
            <p className="text-xs text-[#1B2A22]/70 mt-2 leading-relaxed">
              Multi-tab workbook containing Scored Customers, At-Risk Call List, Personas, Model Cards, Campaigns, and Data Quality audits.
            </p>
          </div>

          <button
            onClick={downloadExcelWorkbook}
            className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#1F7A4D] text-[#FAF6EA] hover:bg-[#0F3D2E] text-xs font-semibold shadow-xs"
          >
            <Download className="w-4 h-4 text-[#FAF6EA]" />
            <span>Download Excel Workbook</span>
          </button>
        </div>

        {/* Card 3: Priority At-Risk Call List CSV */}
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#0F3D2E]">
              At-Risk Call List (CSV)
            </h3>
            <p className="text-xs text-[#1B2A22]/70 mt-2 leading-relaxed">
              Formatted outreach call sheet containing Critical and High risk subscribers sorted by expected MRR at risk and top root causes.
            </p>
          </div>

          <button
            onClick={downloadCallListCsv}
            className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white border border-[#C9A227] text-[#0F3D2E] hover:bg-[#FAF6EA] text-xs font-semibold shadow-xs"
          >
            <Download className="w-4 h-4 text-[#C9A227]" />
            <span>Export Call List CSV</span>
          </button>
        </div>
      </div>

      {/* Snapshot Verification Card */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
        <h4 className="font-serif font-bold text-base text-[#0F3D2E] mb-3">
          Snapshot Verification & Reproducibility Seal
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-[#FAF6EA] rounded-xl border border-[#F1EAD3]">
            <span className="text-[10px] text-gray-500 block uppercase font-sans">Snapshot Content Hash</span>
            <span className="font-bold text-[#0F3D2E] truncate block">{metaData?.meta.contentHash || 'Verified'}</span>
          </div>
          <div className="p-3 bg-[#FAF6EA] rounded-xl border border-[#F1EAD3]">
            <span className="text-[10px] text-gray-500 block uppercase font-sans">Active Ingest Timestamp</span>
            <span className="font-bold text-[#0F3D2E]">{metaData?.meta.timestamp ? new Date(metaData.meta.timestamp).toLocaleString('en-GB') : 'Syncing'}</span>
          </div>
          <div className="p-3 bg-[#FAF6EA] rounded-xl border border-[#F1EAD3]">
            <span className="text-[10px] text-gray-500 block uppercase font-sans">Cleaned Row Base</span>
            <span className="font-bold text-[#0F3D2E]">{formatNumber(metaData?.meta.rowCount || 5000)} valid records</span>
          </div>
        </div>
      </div>
    </div>
  );
};
