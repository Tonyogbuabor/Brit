import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Wrench,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  HelpCircle,
} from 'lucide-react';
import { sendChatMessage } from '../lib/api.js';

interface FloatingAiChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'model';
  content: string;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
}

export const FloatingAiChat: React.FC<FloatingAiChatProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content:
        "Hello! I am your **BritConnect Churn Intelligence Copilot**. I query your live Google Sheet data, explain individual predictions with SHAP, simulate what-ifs, and benchmark retention campaigns. How can I assist your retention team today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const samplePrompts = [
    'Which Critical customers have the highest revenue at risk?',
    'What are the primary churn drivers across Fibre subscribers?',
    'Show me the performance and uplift of our active campaigns',
    'How healthy is our Google Sheet data quality and deduplication?',
  ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q || isLoading) return;

    const userMsg: Message = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
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
          content: `Apologies, I encountered an error querying the intelligence engine: ${err.message}. Please try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-lg bg-[#FAF6EA] border border-[#C9A227]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px] animate-in fade-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="bg-[#0F3D2E] text-[#FAF6EA] p-4 flex items-center justify-between border-b border-[#1F7A4D]/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#C9A227] flex items-center justify-center text-[#0F3D2E]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm leading-tight text-[#FAF6EA]">
              BritConnect Retention Assistant
            </h3>
            <p className="text-[11px] text-[#A8C3A0] font-sans">
              Gemini 3.8 Flash • Grounded Tool Calling
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[#FAF6EA]/70 hover:text-[#FAF6EA] hover:bg-[#1F7A4D]/50"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'model' && (
              <div className="w-7 h-7 rounded-full bg-[#1F7A4D] text-[#FAF6EA] flex items-center justify-center shrink-0 text-xs font-serif font-bold">
                BC
              </div>
            )}

            <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs ${
              m.role === 'user'
                ? 'bg-[#0F3D2E] text-[#FAF6EA]'
                : 'bg-white border border-[#F1EAD3] text-[#1B2A22] shadow-xs'
            }`}>
              <div className="prose prose-xs whitespace-pre-wrap leading-relaxed">
                {m.content}
              </div>

              {/* Tool calls inspection accordion */}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[#F1EAD3]">
                  <button
                    onClick={() =>
                      setExpandedTools((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1F7A4D] hover:underline"
                  >
                    <Wrench className="w-3 h-3 text-[#C9A227]" />
                    <span>
                      {m.toolCalls.length} Live Data Function{m.toolCalls.length > 1 ? 's' : ''} Executed
                    </span>
                    {expandedTools[idx] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>

                  {expandedTools[idx] && (
                    <div className="mt-2 space-y-2 text-[10px] font-mono bg-[#FAF6EA] p-2 rounded-xl border border-[#F1EAD3] overflow-x-auto max-h-48">
                      {m.toolCalls.map((tc, cIdx) => (
                        <div key={cIdx} className="space-y-1">
                          <div className="text-[#0F3D2E] font-bold">call: {tc.name}({JSON.stringify(tc.args)})</div>
                          <div className="text-gray-600 bg-white p-1 rounded border border-gray-100">
                            {JSON.stringify(tc.result, null, 2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-[#C9A227] text-[#0F3D2E] flex items-center justify-center shrink-0 text-xs font-bold">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 items-center text-xs text-[#0F3D2E]">
            <div className="w-7 h-7 rounded-full bg-[#1F7A4D] text-[#FAF6EA] flex items-center justify-center shrink-0 text-xs font-serif font-bold animate-pulse">
              BC
            </div>
            <div className="bg-white border border-[#F1EAD3] p-3 rounded-2xl flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#C9A227] animate-ping" />
              <span>Querying live database and synthesizing answer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts carousel */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-[#F1EAD3] bg-[#FAF6EA]">
          <p className="text-[10px] uppercase font-bold text-[#1B2A22]/60 mb-1.5 tracking-wider">
            Suggested Inquiries:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p, pIdx) => (
              <button
                key={pIdx}
                onClick={() => handleSend(p)}
                className="text-[11px] text-[#0F3D2E] bg-white border border-[#C9A227]/40 hover:bg-[#F1EAD3] px-2.5 py-1 rounded-full text-left transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-white border-t border-[#F1EAD3]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about churn drivers, at-risk accounts, or what-ifs..."
            className="flex-1 bg-[#FAF6EA] border border-[#F1EAD3] rounded-xl px-3.5 py-2 text-xs text-[#1B2A22] focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-[#0F3D2E] text-[#FAF6EA] hover:bg-[#1F7A4D] disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
