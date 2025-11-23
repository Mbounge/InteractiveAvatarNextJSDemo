import React, { useState } from "react";
import { Conversation } from "../types";
import { ArrowLeft, Clock, User, Bot, Terminal, FileText, Zap, Wrench, Pin } from "lucide-react";
import { format } from "date-fns";
import { useWorkbench } from "../context/WorkbenchContext";

export const TranscriptViewer = ({ conversation, onBack }: { conversation: Conversation, onBack: () => void }) => {
  const { addItem, removeItem, isPinned } = useWorkbench();
  const [activeTab, setActiveTab] = useState<'chat' | 'system'>('chat');
  
  const dynamicVars = conversation.conversation_initiation_client_data?.dynamic_variables || {};
  const { context_title, context_type, system_prompt } = dynamicVars;
  const pinned = isPinned(conversation.conversation_id);

  const handlePin = () => {
    if (pinned) {
      removeItem(conversation.conversation_id);
    } else {
      addItem({
        id: conversation.conversation_id,
        type: 'conversation',
        label: `Conv: ${conversation.conversation_id.slice(0, 8)}...`,
        data: conversation
      });
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-[#161160] transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Back to List
        </button>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={handlePin}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              pinned 
                ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
            }`}
          >
            <Pin size={16} fill={pinned ? "currentColor" : "none"} />
            {pinned ? "Pinned to Workbench" : "Add to Workbench"}
          </button>

          <div className="text-right">
            <h2 className="text-xl font-bold text-[#161160]">{context_title || "Unknown Context"}</h2>
            <div className="flex items-center justify-end gap-4 text-sm text-slate-500 mt-1">
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{context_type}</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {conversation.metadata.call_duration_secs}s</span>
              <span>{format(new Date(conversation.metadata.start_time_unix_secs * 1000), "MMM d, h:mm a")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        
        {/* Left: Chat Interface */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex gap-4">
            <TabButton label="Transcript" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<FileText size={16} />} />
            <TabButton label="System Prompt" active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<Terminal size={16} />} />
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {activeTab === 'chat' ? (
               conversation.transcript.length > 0 ? (
                conversation.transcript.map((msg, idx) => {
                  const metrics = msg.conversation_turn_metrics?.metrics;
                  const llmThink = metrics?.convai_llm_service_ttfb?.elapsed_time;
                  const ttsDelay = metrics?.convai_tts_service_ttfb?.elapsed_time;
                  const totalGen = metrics?.convai_llm_service_tt_last_sentence?.elapsed_time;
                  const hasTools = msg.tool_calls && msg.tool_calls.length > 0;

                  return (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-[#2B21C1] text-white rounded-tr-none' 
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                      }`}>
                        <div className="text-xs opacity-70 mb-2 flex items-center gap-1 font-medium tracking-wide">
                          {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                          {msg.role.toUpperCase()} • {msg.time_in_call_secs}s
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        {hasTools && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1">
                              <Wrench size={12} /> Tool Used
                            </div>
                            <div className="bg-slate-50 rounded p-2 text-xs font-mono text-slate-600 overflow-x-auto border border-slate-100">
                              {JSON.stringify(msg.tool_calls, null, 2)}
                            </div>
                          </div>
                        )}
                        {msg.role === 'agent' && (llmThink || ttsDelay) && (
                          <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap gap-3 text-[10px] font-mono text-slate-400">
                            {llmThink && <span className="flex items-center gap-1" title="Time to First Byte"><Zap size={10} className="text-amber-500" /> LLM: {llmThink.toFixed(2)}s</span>}
                            {ttsDelay && <span title="TTS Generation Delay">🔊 TTS: {ttsDelay.toFixed(2)}s</span>}
                            {totalGen && <span title="Total Generation Time">⏱️ Total: {totalGen.toFixed(2)}s</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
               ) : (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400">
                   <Zap size={48} className="mb-4 opacity-20" />
                   <p>No audio/transcript recorded.</p>
                   <p className="text-sm">This indicates a connection drop or immediate hangup.</p>
                 </div>
               )
            ) : (
              <div className="prose max-w-none">
                <pre className="bg-slate-900 text-slate-50 p-6 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border border-slate-800 shadow-inner">
                  {system_prompt || "No System Prompt Data Available"}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right: Metadata Sidebar */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-y-auto">
          <h3 className="font-bold text-[#161160] mb-4 uppercase text-xs tracking-wider">Session Metadata</h3>
          <MetaItem label="Agent ID" value={conversation.agent_id} />
          <MetaItem label="Conversation ID" value={conversation.conversation_id} />
          <MetaItem label="User Name" value={dynamicVars.user_firstname || "N/A"} />
          <MetaItem label="Termination" value={conversation.metadata.termination_reason} />
          <div className="mt-8">
            <h3 className="font-bold text-[#161160] mb-4 uppercase text-xs tracking-wider">Context Variables</h3>
            <div className="space-y-3">
              {Object.entries(dynamicVars).map(([key, val]) => {
                if (key === 'system_prompt' || key === 'greeting') return null;
                return (
                  <div key={key} className="text-sm border-b border-slate-100 pb-2">
                    <span className="text-slate-400 block text-xs mb-0.5 uppercase">{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-slate-700 break-all">{String(val)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ label, active, onClick, icon }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? "bg-white text-[#2B21C1] shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
    {icon} {label}
  </button>
);

const MetaItem = ({ label, value }: any) => (
  <div className="mb-4">
    <span className="text-xs text-slate-400 uppercase block mb-1">{label}</span>
    <span className="text-sm font-medium text-slate-900 break-all">{value || "—"}</span>
  </div>
);