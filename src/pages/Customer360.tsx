import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  SlidersHorizontal,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  PhoneCall,
  Mail,
  MessageSquare,
  FileText,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import {
  fetchCustomerById,
  fetchRetentionPlan,
  runCustomerWhatIf,
  fetchCampaigns,
} from '../lib/api.js';
import { formatCurrency, formatPercent } from '../lib/formatters.js';

export const Customer360: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [copiedScript, setCopiedScript] = useState(false);

  // Interactive What-If lever state for customer
  const [whatIfDiscount, setWhatIfDiscount] = useState<number | null>(null);
  const [whatIfContract, setWhatIfContract] = useState<string | null>(null);
  const [whatIfComplaints, setWhatIfComplaints] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomerById(id!),
    enabled: !!id,
  });

  const { data: retentionPlan, isLoading: planLoading, refetch: regeneratePlan } = useQuery({
    queryKey: ['retentionPlan', id],
    queryFn: () => fetchRetentionPlan(id!),
    enabled: !!id && !!data,
  });

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 bg-[#F1EAD3] rounded-lg w-48" />
        <div className="h-48 bg-white rounded-2xl border border-[#F1EAD3]" />
      </div>
    );
  }

  const customer = data.customer;
  const isCritical = customer.riskTier === 'Critical';
  const isHigh = customer.riskTier === 'High';

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const levers: any = {
        discountPercent: whatIfDiscount ?? customer.discountPercent,
        contractType: whatIfContract ?? customer.contractType,
        resolvedComplaints: whatIfComplaints ?? customer.complaints12M,
        satisfactionScore: customer.satisfactionScore,
      };
      const res = await runCustomerWhatIf(customer.customerId, levers);
      setSimulationResult(res);
    } catch (err: any) {
      console.error('Simulation error:', err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const copyScriptToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const downloadBriefPdf = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 61, 46);
    doc.text(`BritConnect Customer Retention Brief`, 14, 20);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(27, 42, 34);
    doc.text(`Customer ID: ${customer.customerId} | Service: ${customer.serviceType} | Plan: ${customer.planName}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | Persona: ${customer.personaName}`, 14, 34);

    doc.line(14, 38, 196, 38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`Risk Assessment: ${customer.riskTier} Tier (${(customer.churnProbability * 100).toFixed(0)}% Probability)`, 14, 46);
    doc.text(`Monthly MRR Exposure: £${customer.monthlyChargeGbp}/mo (Expected Risk: £${customer.expectedMrrAtRiskGbp})`, 14, 53);

    doc.setFontSize(12);
    doc.text(`Primary Churn Drivers:`, 14, 64);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let y = 72;
    customer.topRiskDrivers.forEach((d, i) => {
      doc.text(`${i + 1}. ${d.narrative}`, 18, y);
      y += 7;
    });

    if (retentionPlan) {
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`Recommended Retention Strategy:`, 14, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Action: ${retentionPlan.bestNextAction.actionTitle}`, 18, y);
      y += 7;
      doc.text(`Approved Offer: ${retentionPlan.bestNextAction.offer.name} (Cost: £${retentionPlan.bestNextAction.offerCostGbp})`, 18, y);
      y += 7;
      doc.text(`Channel: ${retentionPlan.bestNextAction.channel} | Timing: ${retentionPlan.bestNextAction.bestTiming}`, 18, y);
      y += 9;
      doc.setFont('helvetica', 'bold');
      doc.text(`Personalised Talking Script:`, 18, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(`"${retentionPlan.bestNextAction.personalizedScript}"`, 170);
      doc.text(lines, 18, y);
      y += lines.length * 6 + 6;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(181, 72, 58);
      doc.text(`Do Not Do:`, 18, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(27, 42, 34);
      y += 6;
      retentionPlan.doNotDoGuardrails.forEach((rule) => {
        doc.text(`• ${rule}`, 22, y);
        y += 6;
      });
    }

    doc.save(`BritConnect_RetentionBrief_${customer.customerId}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Back Link & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/risk-explorer"
            className="p-2 rounded-xl bg-white border border-[#F1EAD3] text-[#0F3D2E] hover:bg-[#FAF6EA]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl font-bold text-[#0F3D2E]">
                Customer 360: {customer.customerId}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isCritical ? 'bg-[#B5483A]/15 text-[#B5483A] border border-[#B5483A]/30' :
                isHigh ? 'bg-[#C9A227]/20 text-[#0F3D2E] border border-[#C9A227]/40' :
                'bg-[#1F7A4D]/15 text-[#1F7A4D]'
              }`}>
                {customer.riskTier} Risk ({formatPercent(customer.churnProbability, true)})
              </span>
            </div>
            <p className="text-xs text-[#1B2A22]/70 font-sans mt-0.5">
              {customer.customerSegment} • {customer.ukNation} ({customer.city}) • Member since {customer.joinDate} ({customer.tenureMonths}M tenure)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadBriefPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#C9A227]/40 text-[#0F3D2E] hover:bg-[#FAF6EA] text-xs font-semibold shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>Download Brief (PDF)</span>
          </button>
        </div>
      </div>

      {/* Row 1: Profile Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#1B2A22]/60 uppercase">Monthly Charge</div>
          <div className="font-serif text-2xl font-bold text-[#0F3D2E] font-tabular mt-1">
            {formatCurrency(customer.monthlyChargeGbp)}
          </div>
          <div className="text-[11px] text-[#1B2A22]/70 font-sans mt-0.5">
            {customer.discountPercent > 0 ? `${customer.discountPercent}% active discount` : 'Full headline tariff'}
          </div>
        </div>

        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#1B2A22]/60 uppercase">Expected Risk MRR</div>
          <div className="font-serif text-2xl font-bold text-[#B5483A] font-tabular mt-1">
            {formatCurrency(customer.expectedMrrAtRiskGbp)}
          </div>
          <div className="text-[11px] text-[#1B2A22]/70 font-sans mt-0.5">
            Annual: {formatCurrency(customer.expectedMrrAtRiskGbp * 12)}
          </div>
        </div>

        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#1B2A22]/60 uppercase">Contract Commitment</div>
          <div className="font-serif text-lg font-bold text-[#0F3D2E] mt-1">
            {customer.contractType}
          </div>
          <div className="text-[11px] text-[#1B2A22]/70 font-sans mt-0.5">
            {customer.autoRenew ? 'Auto-renew active' : 'Manual renewal'}
          </div>
        </div>

        <div className="bg-white border border-[#F1EAD3] rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-semibold text-[#1B2A22]/60 uppercase">Persona Segment</div>
          <div className="font-serif text-base font-bold text-[#1F7A4D] mt-1">
            {customer.personaName}
          </div>
          <div className="text-[11px] text-[#1B2A22]/70 font-sans mt-0.5">
            CSAT: {customer.satisfactionScore}/10 • NPS: {customer.npsScore}
          </div>
        </div>
      </div>

      {/* Row 2: Linear SHAP Waterfall & Root Cause Decomposition */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
              SHAP Prediction Explainability & Waterfall
            </h3>
            <p className="text-xs text-[#1B2A22]/70">
              Exact mathematical feature effects (converted to percentage-point deviations from active base median).
            </p>
          </div>
          <div className="text-xs font-mono bg-[#FAF6EA] border border-[#F1EAD3] px-2.5 py-1 rounded-lg text-[#0F3D2E]">
            Base Log-Odds: {customer.shapBaseValue}
          </div>
        </div>

        {/* Top 5 Risk Drivers */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-[#B5483A] uppercase tracking-wider">
            Primary Escalating Risk Drivers (+pp Effect)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customer.topRiskDrivers.map((d, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#FAF6EA] border border-[#F1EAD3] flex items-start justify-between">
                <div>
                  <div className="font-bold text-xs text-[#0F3D2E]">{d.label}</div>
                  <div className="text-[11px] text-[#1B2A22]/70 mt-0.5">{d.narrative}</div>
                </div>
                <span className="font-mono font-bold text-xs text-[#B5483A] bg-[#B5483A]/10 px-2 py-0.5 rounded-md shrink-0 ml-2">
                  +{d.percentagePointEffect} pts
                </span>
              </div>
            ))}
          </div>

          {/* Top 3 Protective Factors */}
          {customer.topProtectiveFactors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#F1EAD3]">
              <h4 className="text-xs font-bold text-[#1F7A4D] uppercase tracking-wider mb-2">
                Stabilising Protective Factors (-pp Effect)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {customer.topProtectiveFactors.map((d, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-[#FAF6EA] border border-[#1F7A4D]/20 flex items-start justify-between">
                    <div>
                      <div className="font-bold text-xs text-[#0F3D2E]">{d.label}</div>
                      <div className="text-[10px] text-[#1B2A22]/70 mt-0.5">{d.narrative}</div>
                    </div>
                    <span className="font-mono font-bold text-xs text-[#1F7A4D] bg-[#1F7A4D]/10 px-1.5 py-0.5 rounded shrink-0 ml-2">
                      {d.percentagePointEffect} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Gemini 3.8 Flash Personalised AI Retention Recommendation */}
      <div className="bg-gradient-to-br from-[#FAF6EA] to-white border-2 border-[#C9A227]/40 rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0F3D2E] flex items-center justify-center text-[#C9A227]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
                Personalised AI Retention Action Plan
              </h3>
              <p className="text-xs text-[#1B2A22]/70">
                Generated with {retentionPlan?.engine === 'gemini' ? 'Gemini 3.8 Flash (Live)' : 'Rule-Based Fallback Engine'}
              </p>
            </div>
          </div>

          <button
            onClick={() => regeneratePlan()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#C9A227] text-[#0F3D2E] hover:bg-[#FAF6EA] text-xs font-semibold"
          >
            <RotateCw className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>Regenerate Plan</span>
          </button>
        </div>

        {planLoading || !retentionPlan ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#0F3D2E]">
            <span className="w-4 h-4 border-2 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
            <span>Synthesizing root causes and approved catalogue offer...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Diagnosis Banner */}
            <div className="p-3.5 bg-white border border-[#C9A227]/30 rounded-xl">
              <span className="text-[11px] font-bold text-[#C9A227] uppercase tracking-wider block mb-1">
                Executive Diagnosis:
              </span>
              <p className="text-xs font-medium text-[#1B2A22] leading-relaxed">
                {retentionPlan.headlineDiagnosis}
              </p>
            </div>

            {/* Recommended Action Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white border border-[#F1EAD3] rounded-xl space-y-2">
                <span className="text-[11px] font-semibold text-[#1B2A22]/60 uppercase">Best Next Action</span>
                <div className="font-bold text-sm text-[#0F3D2E]">{retentionPlan.bestNextAction.actionTitle}</div>
                <div className="text-xs text-[#1F7A4D] font-medium font-tabular">
                  Offer: {retentionPlan.bestNextAction.offer.name}
                </div>
                <div className="text-[11px] text-[#1B2A22]/60">
                  Unit Cost: £{retentionPlan.bestNextAction.offerCostGbp} • Est. Net Value: £{retentionPlan.bestNextAction.expectedNetValueGbp}
                </div>
              </div>

              <div className="p-4 bg-white border border-[#F1EAD3] rounded-xl space-y-2">
                <span className="text-[11px] font-semibold text-[#1B2A22]/60 uppercase">Outreach Channel & Timing</span>
                <div className="font-bold text-sm text-[#0F3D2E] flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-[#1F7A4D]" />
                  <span>{retentionPlan.bestNextAction.channel}</span>
                </div>
                <div className="text-xs text-[#1B2A22]/80">{retentionPlan.bestNextAction.bestTiming}</div>
                <div className="text-[11px] text-[#1F7A4D] font-bold">
                  Expected Save Rate: {(retentionPlan.bestNextAction.expectedSaveProbabilityMin * 100).toFixed(0)}% - {(retentionPlan.bestNextAction.expectedSaveProbabilityMax * 100).toFixed(0)}%
                </div>
              </div>

              <div className="p-4 bg-white border border-[#B5483A]/20 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-[#B5483A] uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#B5483A]" />
                  <span>Operational Do-Not-Do:</span>
                </span>
                <ul className="text-xs text-[#B5483A] space-y-1 list-disc pl-4">
                  {retentionPlan.doNotDoGuardrails.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Personalized Script Box */}
            <div className="p-4 bg-white border border-[#F1EAD3] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F3D2E] uppercase tracking-wider">
                  Recommended Outreach Script & Talking Points
                </span>
                <button
                  onClick={() => copyScriptToClipboard(retentionPlan.bestNextAction.personalizedScript)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F7A4D] hover:underline"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedScript ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>
              <p className="text-xs italic bg-[#FAF6EA] p-3 rounded-xl border border-[#F1EAD3] text-[#1B2A22] leading-relaxed">
                "{retentionPlan.bestNextAction.personalizedScript}"
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {retentionPlan.bestNextAction.talkingPoints.map((tp, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-[#1B2A22]/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227]" />
                    <span>{tp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GDPR & PECR Legal Guardrail */}
            <div className="text-[11px] text-[#1B2A22]/60 border-t border-[#F1EAD3] pt-2 font-sans">
              <strong>UK Regulatory Notice:</strong> {retentionPlan.gdprPecrNotice}
            </div>
          </div>
        )}
      </div>

      {/* Row 4: Interactive What-If Simulator Sandbox for this Customer */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#C9A227]" />
              <span>Simulate Controllable Levers (What-If Sandbox)</span>
            </h3>
            <p className="text-xs text-[#1B2A22]/70">
              Model associational estimates when altering contract term, pricing discount, or resolving tickets.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">
              Discount Level: {whatIfDiscount ?? customer.discountPercent}%
            </label>
            <input
              type="range"
              min="0"
              max="25"
              step="5"
              value={whatIfDiscount ?? customer.discountPercent}
              onChange={(e) => setWhatIfDiscount(Number(e.target.value))}
              className="w-full accent-[#C9A227]"
            />
            <div className="flex justify-between text-[10px] text-[#1B2A22]/50 font-mono">
              <span>0%</span>
              <span>10%</span>
              <span>25% (Cap)</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">
              Contract Commitment
            </label>
            <select
              value={whatIfContract ?? customer.contractType}
              onChange={(e) => setWhatIfContract(e.target.value)}
              className="w-full text-xs bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-2.5 py-1.5 text-[#1B2A22]"
            >
              <option value="Rolling Monthly">Rolling Monthly</option>
              <option value="12 Months">12 Months Fixed</option>
              <option value="24 Months">24 Months Fixed</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#1B2A22]/70 block mb-1">
              Active Complaints: {whatIfComplaints ?? customer.complaints12M}
            </label>
            <input
              type="range"
              min="0"
              max={Math.max(3, customer.complaints12M)}
              step="1"
              value={whatIfComplaints ?? customer.complaints12M}
              onChange={(e) => setWhatIfComplaints(Number(e.target.value))}
              className="w-full accent-[#1F7A4D]"
            />
            <div className="flex justify-between text-[10px] text-[#1B2A22]/50 font-mono">
              <span>0 (Resolved)</span>
              <span>{Math.max(3, customer.complaints12M)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="px-4 py-2 rounded-xl bg-[#0F3D2E] text-[#FAF6EA] hover:bg-[#1F7A4D] text-xs font-semibold transition-colors shadow-xs"
          >
            {isSimulating ? 'Simulating Re-score...' : 'Run What-If Simulation'}
          </button>

          {simulationResult && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                Simulated Churn: <strong className="text-[#1F7A4D]">{formatPercent(simulationResult.simulated.probability, true)}</strong>{' '}
                <span className="text-[#1B2A22]/60">({simulationResult.deltaProbability >= 0 ? '+' : ''}{(simulationResult.deltaProbability * 100).toFixed(1)} pp)</span>
              </div>
              <div>
                Net Value: <strong className="text-[#0F3D2E]">{formatCurrency(simulationResult.netValueGbp)}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
