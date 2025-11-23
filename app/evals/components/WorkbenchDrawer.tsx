// app/evals/components/WorkbenchDrawer.tsx

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useWorkbench } from "../context/WorkbenchContext";
import { 
  X, Trash2, MessageSquare, Send, Loader2, FileJson, BarChart2, 
  ChevronDown, ChevronUp, User, Bot, PieChart, Wrench, Maximize2, Minimize2,
  RotateCcw, RefreshCw // <--- NEW IMPORT
} from "lucide-react";
import { PinnedItem, Conversation, FilterState, Message } from "../types";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

// --- Constants ---
const AGENT_ID_TO_NAME: Record<string, string> = {
  "zvpmic1VqdKVwX1H0W3T": "Blue",
  "agent_0801k5dxcxgye7e9pxf57y9s4c6f": "Onboarding: Step 01 (Player)",
  "agent_8701k5gn6215fcbsh8vfgbab0294": "Onboarding: Step 02 (Player)",
  "agent_3001k5gprnf1fbes64x2txzds04y": "Onboarding: Step 03 (Player)",
  "agent_5601k5gr2crff40a5qh2z407bdgr": "Onboarding: Step 01 (Parent)",
  "agent_0201k5gr2t9ef1rvwrn9jg0mheec": "Onboarding: Step 02 (Parent)",
  "agent_0301k5gr323qfmzb4fkk3c0s68fn": "Onboarding: Step 03 (Parent)",
  "agent_7701k5gr3jbmfgmry0dq8c86tnp9": "Blue sales (Parent)",
  "agent_5801k5gr4wrjedpax5qsqaw1s7hx": "Blue sales (Player without parents)",
  "agent_2601k5gr5gffe05tbj5gcg9z1fyc": "Blue sales (Player with parents)"
};

// --- Helper: Filter Logic ---
const filterConversations = (allConversations: Conversation[], filter: FilterState) => {
  return allConversations.filter(c => {
    if (filter.agentId && c.agent_id !== filter.agentId) return false;
    
    const vars = c.conversation_initiation_client_data?.dynamic_variables || {};
    if (filter.contextType && vars.context_type !== filter.contextType) return false;
    if (filter.contextTitle && vars.context_title !== filter.contextTitle) return false;
    
    if (filter.date) {
      const cDate = format(new Date(c.metadata.start_time_unix_secs * 1000), 'MMM dd');
      if (cDate !== filter.date) return false;
    }

    if (filter.interactionMode) {
      const type = vars.context_type || "General";
      const isStandard = type === "SystemPrompt" || type === "General" || type === "Unknown";
      if (filter.interactionMode === "Standard" && !isStandard) return false;
      if (filter.interactionMode === "Specialized" && isStandard) return false;
    }

    if (filter.filterType === "Tech Failure") return c.transcript.length === 0;
    
    if (filter.filterType === "Long (>60s)") {
      const userTurns = c.transcript.filter(t => t.role === 'user').length;
      return c.metadata.call_duration_secs > 60 && userTurns >= 5;
    }
    
    if (filter.filterType === "Short (<15s)") return c.metadata.call_duration_secs < 15;
    
    if (filter.filterType === "Tool Used") {
      return c.transcript.some(t => t.tool_calls && t.tool_calls.some((tc: any) => tc.tool_name !== 'end_call'));
    }
    
    if (filter.filterType === "Tool Failure") {
      return c.transcript.some(t => t.tool_results && t.tool_results.some((r: any) => r.tool_name !== 'end_call' && r.is_error));
    }

    return true;
  });
};

// --- Sub-Component: Transcript Bubble ---
const TranscriptBubble = ({ msg }: { msg: Message }) => {
  const hasTools = msg.tool_calls && msg.tool_calls.length > 0;

  return (
    <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-sm ${
        msg.role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
      }`}>
        {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
      </div>
      
      <div className={`text-xs p-3 rounded-xl max-w-[85%] leading-relaxed shadow-sm ${
        msg.role === 'user' 
          ? 'bg-[#2B21C1] text-white rounded-tr-none' 
          : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
      }`}>
        <p className="whitespace-pre-wrap">{msg.message}</p>

        {hasTools && (
          <div className={`mt-2 pt-2 border-t ${msg.role === 'user' ? 'border-white/20' : 'border-slate-100'}`}>
            <div className={`text-[10px] font-bold mb-1 flex items-center gap-1 ${msg.role === 'user' ? 'text-indigo-100' : 'text-indigo-600'}`}>
              <Wrench size={10} /> Tool Used
            </div>
            <div className={`rounded p-2 text-[10px] font-mono overflow-x-auto ${
              msg.role === 'user' 
                ? 'bg-black/10 text-indigo-50' 
                : 'bg-slate-50 border border-slate-100 text-slate-600'
            }`}>
              {JSON.stringify(msg.tool_calls, null, 2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Sub-Component: The Powerhouse Card ---
const WorkbenchItemCard = ({ 
  item, 
  onRemove, 
  allConversations 
}: { 
  item: PinnedItem; 
  onRemove: (id: string) => void;
  allConversations: Conversation[];
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);

  const relatedConversations = useMemo(() => {
    if (item.type === 'conversation') return [];
    if (!item.context?.filter) return [];
    return filterConversations(allConversations, item.context.filter);
  }, [item, allConversations]);

  const activeConversation = item.type === 'conversation' 
    ? item.data 
    : relatedConversations.find(c => c.conversation_id === selectedConvoId) || relatedConversations[0];

  const renderContent = () => {
    if (item.type === 'conversation') {
      const transcript = activeConversation?.transcript || [];
      return (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {transcript.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">No transcript available (0 turns)</p>
          ) : (
            transcript.map((msg: Message, idx: number) => <TranscriptBubble key={idx} msg={msg} />)
          )}
        </div>
      );
    }

    if (item.type === 'stat-row' || item.type === 'stat-slice') {
      return (
        <div className="flex flex-col h-[500px]">
          <div className="flex gap-4 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Filter Context</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(item.context?.filter || {}).map(([k, v]) => {
                  let displayValue = String(v);
                  if (k === 'agentId' && AGENT_ID_TO_NAME[displayValue]) {
                    displayValue = AGENT_ID_TO_NAME[displayValue];
                  }
                  return (
                    <span key={k} className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                      {k}: <b>{displayValue}</b>
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Matches</p>
              <p className="text-xl font-bold text-[#161160]">{relatedConversations.length}</p>
            </div>
          </div>

          <div className="flex-1 flex gap-4 min-h-0">
            <div className="w-1/3 border-r border-slate-100 pr-2 overflow-y-auto custom-scrollbar space-y-2">
              {relatedConversations.slice(0, 50).map((c) => (
                <button
                  key={c.conversation_id}
                  onClick={() => setSelectedConvoId(c.conversation_id)}
                  className={`w-full text-left p-2 rounded-lg text-xs border transition-all ${
                    activeConversation?.conversation_id === c.conversation_id
                      ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                      : "bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-slate-700">{format(new Date(c.metadata.start_time_unix_secs * 1000), "MMM d")}</span>
                    <span className={`font-mono ${c.metadata.call_duration_secs < 15 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {c.metadata.call_duration_secs}s
                    </span>
                  </div>
                  <div className="text-slate-400 truncate">
                    {c.conversation_initiation_client_data?.dynamic_variables?.user_firstname || "Unknown User"}
                  </div>
                </button>
              ))}
              {relatedConversations.length > 50 && (
                <p className="text-[10px] text-center text-slate-400 py-2">Showing top 50 of {relatedConversations.length}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pl-2">
              {activeConversation ? (
                <div className="space-y-3">
                  <div className="sticky top-0 bg-white/95 backdrop-blur pb-2 border-b border-slate-100 mb-2 z-10">
                    <p className="text-xs font-bold text-[#161160]">
                      {activeConversation.conversation_initiation_client_data?.dynamic_variables?.context_title || "Conversation"}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">{activeConversation.conversation_id}</p>
                  </div>
                  {activeConversation.transcript.map((msg: Message, idx: number) => <TranscriptBubble key={idx} msg={msg} />)}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Select a conversation to view transcript
                </div>
              )}
            </div>

          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer bg-slate-50/50 hover:bg-slate-100 transition-colors border-b border-slate-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`p-2 rounded-lg flex-shrink-0 ${
            item.type === 'conversation' ? 'bg-blue-100 text-blue-700' : 
            item.type === 'stat-slice' ? 'bg-emerald-100 text-emerald-700' : 
            'bg-purple-100 text-purple-700'
          }`}>
            {item.type === 'conversation' ? <FileJson size={18} /> : item.type === 'stat-slice' ? <PieChart size={18} /> : <BarChart2 size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{item.label}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">{item.type.replace('-', ' ')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
          <div className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-200">
          {renderContent()}
        </div>
      )}
    </div>
  );
};

// --- Main Component: The Drawer ---
export const WorkbenchDrawer = ({ allConversations }: { allConversations: Conversation[] }) => {
  const { isDrawerOpen, toggleDrawer, closeDrawer, items, removeItem, clearWorkbench } = useWorkbench();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Chat State
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isChatMaximized, setIsChatMaximized] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatExpanded, isChatMaximized]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDrawerOpen && drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        closeDrawer();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDrawerOpen, closeDrawer]);

  // --- CORE API CALL FUNCTION ---
  // Used by both Send and Regenerate
  const fetchAIResponse = async (history: { role: 'user' | 'assistant', content: string }[]) => {
    setIsLoading(true);

    // Auto-Enrichment Logic
    const enrichedItems = items.map(item => {
      if ((item.type === 'stat-row' || item.type === 'stat-slice') && item.context?.filter) {
        const matches = filterConversations(allConversations, item.context.filter);
        const samples = matches.sort((a, b) => b.metadata.call_duration_secs - a.metadata.call_duration_secs).slice(0, 5);
        
        return {
          ...item,
          data: {
            ...item.data,
            sampleConversations: samples
          }
        };
      }
      return item;
    });

    try {
      const response = await fetch('/api/evals/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          contextItems: enrichedItems
        })
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error analyzing the data." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || items.length === 0) return;
    setIsChatExpanded(true);
    const userMsg = input;
    setInput("");
    
    const newHistory = [...messages, { role: 'user', content: userMsg } as const];
    setMessages(newHistory);
    
    await fetchAIResponse(newHistory);
  };

  const handleRegenerate = async () => {
    if (messages.length === 0 || isLoading) return;
    
    // Remove the last assistant message
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    const historyWithoutLast = messages.slice(0, -1);
    setMessages(historyWithoutLast);
    
    await fetchAIResponse(historyWithoutLast);
  };

  const handleResetChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMessages([]);
  };

  const handleDeleteMessage = (index: number) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMaximizedState = !isChatMaximized;
    setIsChatMaximized(newMaximizedState);
    if (newMaximizedState) setIsChatExpanded(true);
  };

  const toggleExpand = () => {
    const newExpandedState = !isChatExpanded;
    setIsChatExpanded(newExpandedState);
    if (!newExpandedState) setIsChatMaximized(false);
  };

  if (!isDrawerOpen) return null;

  return (
    <div 
      ref={drawerRef}
      className={`fixed inset-y-0 right-0 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col animate-in slide-in-from-right duration-300 ${
        isChatMaximized ? "w-screen" : "w-[70vw] min-w-[600px]"
      }`}
    >
      
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-[#161160] text-white shadow-md z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
            <MessageSquare size={24} className="text-indigo-200" />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-wide">Analyst Workbench</h2>
            <p className="text-xs text-indigo-300 font-medium">{items.length} items selected</p>
          </div>
        </div>
        <button onClick={toggleDrawer} className="text-indigo-300 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all">
          <X size={24} />
        </button>
      </div>

      {/* Items List (The "Cart") */}
      <div className={`flex-col min-h-0 bg-slate-50/50 ${isChatMaximized ? 'hidden' : 'flex flex-1'}`}>
        <div className="flex justify-between items-center px-6 py-4 bg-slate-50/95 backdrop-blur border-b border-slate-200 z-10 flex-shrink-0">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2B21C1]"></span>
            Selected Data Points
          </h3>
          {items.length > 0 && (
            <button onClick={clearWorkbench} className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors font-medium">
              <Trash2 size={14} /> Clear All
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 m-4">
              <div className="bg-white p-4 rounded-full mb-3 shadow-sm">
                <FileJson size={32} className="text-slate-300" />
              </div>
              <p className="text-base font-medium text-slate-600">Your workbench is empty</p>
              <p className="text-sm opacity-70">Pin conversations or stats to analyze them</p>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item) => (
                <WorkbenchItemCard 
                  key={item.id} 
                  item={item} 
                  onRemove={removeItem} 
                  allConversations={allConversations} 
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div 
        className={`flex flex-col bg-white border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20 transition-all duration-300 ease-in-out ${
          isChatMaximized ? "flex-1 h-full" : "h-auto"
        }`}
      >
        {/* Chat Header / Toggle */}
        <div 
          className="p-3 bg-white border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={toggleExpand}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-[#2B21C1]" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">AI Analyst Chat</span>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button 
                onClick={handleResetChat}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors mr-2"
                title="Reset Chat"
              >
                <RotateCcw size={16} />
              </button>
            )}
            {isChatExpanded && (
              <button 
                onClick={toggleMaximize}
                className="p-1 text-slate-400 hover:text-[#2B21C1] hover:bg-indigo-50 rounded transition-colors"
                title={isChatMaximized ? "Minimize" : "Maximize"}
              >
                {isChatMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            <button className="text-slate-400 hover:text-[#2B21C1] p-1">
              {isChatExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        </div>
        
        {/* Chat Body */}
        <div 
          className={`overflow-y-auto bg-slate-50/30 transition-all duration-300 ease-in-out ${
            isChatMaximized ? "flex-1" : (isChatExpanded ? "h-[500px]" : "h-0")
          }`}
          ref={scrollRef}
        >
          <div className="p-6 space-y-6">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-3 py-10">
                <MessageSquare size={40} className="opacity-20" />
                <p className="text-sm text-center max-w-[250px]">Ask questions about the data you've pinned above.</p>
              </div>
            )}
            
            {messages.map((msg, idx) => {
              const isLastAI = msg.role === 'assistant' && idx === messages.length - 1;
              
              return (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm ${
                      msg.role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-slate-200 text-slate-600'
                    }`}>
                      {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>

                    <div className={`p-4 rounded-2xl text-sm shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-[#2B21C1] text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                    }`}>
                      <ReactMarkdown
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                          code: ({node, inline, className, children, ...props}: any) => (
                            inline 
                              ? <code className={`px-1 py-0.5 rounded text-xs font-mono ${msg.role === 'user' ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`} {...props}>{children}</code>
                              : <pre className={`p-2 rounded-lg text-xs font-mono overflow-x-auto my-2 ${msg.role === 'user' ? 'bg-black/20' : 'bg-slate-800 text-slate-50'}`} {...props}><code>{children}</code></pre>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Action Row (Below Bubble) */}
                  <div className={`flex items-center gap-2 mt-1.5 ${msg.role === 'user' ? 'mr-12 justify-end' : 'ml-12 justify-start'}`}>
                    <button 
                      onClick={() => handleDeleteMessage(idx)}
                      className="text-xs text-slate-300 hover:text-rose-500 flex items-center gap-1 transition-colors px-1"
                      title="Delete message"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                    
                    {isLastAI && (
                      <button 
                        onClick={handleRegenerate}
                        className="text-xs text-slate-300 hover:text-[#2B21C1] flex items-center gap-1 transition-colors px-1"
                        title="Regenerate response"
                      >
                        <RefreshCw size={12} /> Regenerate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex justify-start ml-12">
                <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-3 text-sm text-slate-500 shadow-sm">
                  <Loader2 size={16} className="animate-spin text-[#2B21C1]" /> 
                  <span className="font-medium">Analyzing context...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={items.length > 0 ? "Ask a question..." : "Pin items to start chatting..."}
              className="w-full pl-5 pr-14 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2B21C1]/20 focus:border-[#2B21C1] text-sm transition-all disabled:bg-slate-50 disabled:text-slate-400 shadow-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsChatExpanded(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={items.length === 0 || isLoading}
            />
            <button 
              onClick={handleSendMessage}
              disabled={items.length === 0 || isLoading || !input.trim()}
              className="absolute right-2.5 p-2.5 bg-[#2B21C1] text-white rounded-lg hover:bg-indigo-800 disabled:opacity-50 disabled:hover:bg-[#2B21C1] transition-all shadow-sm hover:shadow"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};