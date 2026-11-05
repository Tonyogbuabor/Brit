import React, { useState, useRef, useEffect } from 'react';
import {
  BotMessageSquare,
  Sparkles,
  Send,
  Wrench,
  ChevronDown,
  ChevronRight,
  User,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { sendChatMessage } from '../lib/api.js';

interface Message {
  role: 'user' | 'model';
  content: string;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
}

export const AiAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: `Welcome to the **BritConnect Intelligence Assistant**. I am a full-stack AI Copilot connected directly to your live 5,000-subscriber dataset via read-only tools.

**What I can do for you:**
• **Financial & Churn Analysis**: Pull exact live KPIs, ARPU, and MRR at risk.
• **Root Cause Diagnosis**: Inspect SHAP waterfall drivers for individual accounts.
• **Retention Strategy**: Suggest catalogue offers and evaluate campaign uplift.
• **Fairness & Data Quality**: Check schema health, deduplication, and regulatory fairness.

Try asking: *"Which Critical customers have the highest revenue at risk?"* or *"Why is Fibre churn elevated?"*`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sampleQuestions = [
    'Which Critical customers have the highest revenue at risk?',
    'What are the top 5 churn drivers across the entire subscriber base?',
    'Show me the latest retention campaign results and ROI.',
    'Explain the churn risk drivers for customer BCT-000001.',
    'How many rows were quarantined during the latest data cleaning sync?',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(q, history);
      setMessages((prev) => [...prev, response]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: `Apologies, I encountered an error executing your query: ${err.message}. Please try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#0F3D2E] tracking-tight">
            BritConnect AI Churn Assistant
          </h2>
          <p className="text-xs text-[#1B2A22]/70 mt-0.5">
            Gemini 3.8 Flash agent equipped with read-only database query and explainability tools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1F7A4D]/10 text-[#0F3D2E] border border-[#1F7A4D]/20 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1F7A4D]" />
            <span>Prompt Injection Defense Active</span>
          </span>
        </div>
      </div>

      {/* Suggested Prompts Banner */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl p-4 shadow-xs">
        <span className="text-[11px] font-bold text-[#1B2A22]/60 uppercase tracking-wider block mb-2">
          Suggested Inquiries:
        </span>
        <div className="flex flex-wrap gap-2">
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-xs text-[#0F3D2E] bg-[#FAF6EA] border border-[#C9A227]/40 hover:bg-[#F1EAD3] px-3 py-1.5 rounded-xl transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="bg-white border border-[#F1EAD3] rounded-2xl shadow-xs overflow-hidden flex flex-col h-[650px]">
        {/* Messages list */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#FAF6EA]/30">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'model' && (
                <div className="w-8 h-8 rounded-xl bg-[#0F3D2E] text-[#C9A227] flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                m.role === 'user'
                  ? 'bg-[#0F3D2E] text-[#FAF6EA]'
                  : 'bg-white border border-[#F1EAD3] text-[#1B2A22]'
              }`}>
                <div className="prose prose-xs whitespace-pre-wrap">
                  {m.content}
                </div>

                {/* Inspect Tool Calling Results */}
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#F1EAD3]">
                    <button
                      onClick={() =>
                        setExpandedTools((prev) => ({ ...prev, [idx]: !prev[idx] }))
                      }
                      className="flex items-center gap-1.5 text-xs font-bold text-[#1F7A4D] hover:underline"
                    >
                      <Wrench className="w-3.5 h-3.5 text-[#C9A227]" />
                      <span>{m.toolCalls.length} Live Data Tools Executed</span>
                      {expandedTools[idx] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {expandedTools[idx] && (
                      <div className="mt-3 space-y-2 text-[11px] font-mono bg-[#FAF6EA] p-3 rounded-xl border border-[#F1EAD3] max-h-56 overflow-auto">
                        {m.toolCalls.map((tc, cIdx) => (
                          <div key={cIdx} className="space-y-1">
                            <div className="font-bold text-[#0F3D2E]">
                              Tool: {tc.name}({JSON.stringify(tc.args)})
                            </div>
                            <pre className="bg-white p-2 rounded border border-[#F1EAD3] text-[10px] overflow-x-auto">
                              {JSON.stringify(tc.result, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-[#C9A227] text-[#0F3D2E] flex items-center justify-center shrink-0 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-[#0F3D2E]">
              <div className="w-8 h-8 rounded-xl bg-[#0F3D2E] text-[#C9A227] flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-white border border-[#F1EAD3] p-4 rounded-2xl flex items-center gap-3 shadow-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C9A227] animate-ping" />
                <span>Executing read-only tools and evaluating live snapshot metrics...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="p-4 bg-white border-t border-[#F1EAD3]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about subscriber risk, model metrics, or retention playbooks..."
              className="flex-1 bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-4 py-3 text-xs text-[#1B2A22] focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-5 py-3 rounded-xl bg-[#0F3D2E] text-[#FAF6EA] hover:bg-[#1F7A4D] disabled:opacity-40 transition-colors font-semibold text-xs flex items-center gap-2 shadow-xs"
            >
              <span>Ask Copilot</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
