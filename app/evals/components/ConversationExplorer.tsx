import React, { useState, useEffect, useRef, useMemo } from "react";
import { Conversation, FilterState, Message } from "../types";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { Search, X, ArrowLeft, ChevronDown, Check, Filter, Wrench, AlertTriangle, Pin, ArrowUp, ArrowDown } from "lucide-react";
import { useWorkbench } from "../context/WorkbenchContext";

type FilterOption = "All" | "Tech Failure" | "Short (<15s)" | "Long (>60s)" | "Tool Used" | "Tool Failure";
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

const FILTER_OPTIONS: { label: string; value: FilterOption }[] = [
  { label: "All Durations", value: "All" },
  { label: "Tech Failure (0 Turns)", value: "Tech Failure" },
  { label: "Short (<15s)", value: "Short (<15s)" },
  { label: "Long (>60s)", value: "Long (>60s)" },
  { label: "Has Tool Use", value: "Tool Used" },
  { label: "Has Tool Failure", value: "Tool Failure" },
];

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

// Helper to count user turns
const getUserTurns = (transcript: Message[]) => transcript.filter(t => t.role === 'user').length;

// --- Sub-Component: Sortable Header ---
const SortableHeader = ({ 
  label, 
  sortKey, 
  currentSort, 
  onSort, 
  align = "left", 
  className = "" 
}: {
  label: string;
  sortKey: string;
  currentSort: SortConfig;
  onSort: (key: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
}) => (
  <th className={`p-4 text-${align} ${className}`}>
    <button 
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 font-semibold hover:text-[#161160] transition-colors ${align === 'right' ? 'ml-auto' : ''}`}
    >
      {label}
      {currentSort.key === sortKey ? (
        currentSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
      ) : <div className="w-4" />}
    </button>
  </th>
);

export const ConversationExplorer = ({ 
  data, 
  onSelect, 
  onBack, 
  initialFilters = {}, 
  onClearFilters,
  globalDateRange
}: { 
  data: Conversation[], 
  onSelect: (id: string) => void,
  onBack: () => void,
  initialFilters?: FilterState,
  onClearFilters: () => void,
  globalDateRange: { start: string, end: string }
}) => {
  const { addItem, removeItem, isPinned } = useWorkbench();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterOption>(initialFilters.filterType || "All");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialFilters.filterType) {
      setFilterType(initialFilters.filterType);
    } else {
      setFilterType("All");
    }
  }, [initialFilters]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Filtering Logic ---
  const filtered = useMemo(() => {
    return data.filter(c => {
      if (initialFilters.agentId && c.agent_id !== initialFilters.agentId) return false;
      const vars = c.conversation_initiation_client_data?.dynamic_variables || {};
      if (initialFilters.contextType && vars.context_type !== initialFilters.contextType) return false;
      if (initialFilters.contextTitle && vars.context_title !== initialFilters.contextTitle) return false;
      
      if (initialFilters.startDate && initialFilters.endDate) {
        const start = startOfDay(parseISO(initialFilters.startDate)).getTime() / 1000;
        const end = endOfDay(parseISO(initialFilters.endDate)).getTime() / 1000;
        if (c.metadata.start_time_unix_secs < start || c.metadata.start_time_unix_secs > end) return false;
      } else if (initialFilters.date) {
        const cDate = format(new Date(c.metadata.start_time_unix_secs * 1000), 'MMM dd');
        if (cDate !== initialFilters.date) return false;
      } else if (globalDateRange.start && globalDateRange.end) {
        const start = startOfDay(parseISO(globalDateRange.start)).getTime() / 1000;
        const end = endOfDay(parseISO(globalDateRange.end)).getTime() / 1000;
        if (c.metadata.start_time_unix_secs < start || c.metadata.start_time_unix_secs > end) return false;
      }

      if (initialFilters.interactionMode) {
        const type = vars.context_type || "General";
        const isStandard = type === "SystemPrompt" || type === "General" || type === "Unknown";
        if (filterType === "All") {
            if (initialFilters.interactionMode === "Standard" && !isStandard) return false;
            if (initialFilters.interactionMode === "Specialized" && isStandard) return false;
        }
      }
      const matchesSearch = c.conversation_id.includes(search) || vars.context_title?.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (filterType === "Tech Failure") return c.transcript.length === 0;
      
      if (filterType === "Long (>60s)") {
        return c.metadata.call_duration_secs > 60 && getUserTurns(c.transcript) >= 5;
      }
      
      if (filterType === "Short (<15s)") return c.metadata.call_duration_secs < 15;
      
      if (filterType === "Tool Used") {
        return c.transcript.some(t => t.tool_calls && t.tool_calls.some((tc: any) => tc.tool_name !== 'end_call'));
      }
      
      if (filterType === "Tool Failure") {
        return c.transcript.some(t => t.tool_results && t.tool_results.some((r: any) => r.tool_name !== 'end_call' && r.is_error));
      }
      
      return true;
    });
  }, [data, initialFilters, filterType, search, globalDateRange]);

  // --- Sorting Logic ---
  const sortedData = useMemo(() => {
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortConfig.key) {
        case 'date':
          aValue = a.metadata.start_time_unix_secs;
          bValue = b.metadata.start_time_unix_secs;
          break;
        case 'context':
          aValue = a.conversation_initiation_client_data?.dynamic_variables?.context_title || "Unknown";
          bValue = b.conversation_initiation_client_data?.dynamic_variables?.context_title || "Unknown";
          break;
        case 'duration':
          aValue = a.metadata.call_duration_secs;
          bValue = b.metadata.call_duration_secs;
          break;
        case 'turns':
          aValue = a.transcript.length;
          bValue = b.transcript.length;
          break;
        case 'status':
          aValue = a.transcript.length === 0 ? 0 : 1;
          bValue = b.transcript.length === 0 ? 0 : 1;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filtered, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const hasActiveFilters = Object.keys(initialFilters).length > 0;

  const handlePin = (e: React.MouseEvent, convo: Conversation) => {
    e.stopPropagation();
    if (isPinned(convo.conversation_id)) {
      removeItem(convo.conversation_id);
    } else {
      addItem({
        id: convo.conversation_id,
        type: 'conversation',
        label: `Conv: ${convo.conversation_id.slice(0, 8)}...`,
        data: convo
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-8rem)]">
      
      {hasActiveFilters && (
        <div className="bg-indigo-50 p-3 border-b border-indigo-100 flex items-center gap-3">
          <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
            <Filter size={12} /> Active Filters:
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(initialFilters).map(([key, val]) => {
              let displayValue = val;
              if (key === 'agentId' && typeof val === 'string' && AGENT_ID_TO_NAME[val]) {
                displayValue = AGENT_ID_TO_NAME[val];
              }
              return (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-indigo-200 text-xs font-medium text-indigo-700 shadow-sm">
                  <span className="opacity-50 uppercase text-[10px]">{key}:</span> {displayValue}
                </span>
              );
            })}
          </div>
          <button onClick={onClearFilters} className="ml-auto text-xs text-indigo-600 hover:text-indigo-900 font-medium flex items-center gap-1 hover:underline">
            <X size={14} /> Clear All
          </button>
        </div>
      )}

      <div className="p-4 border-b border-slate-100 flex gap-4 items-center bg-white rounded-t-xl">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-[#161160] font-medium transition-colors pr-4 border-r border-slate-200">
          <ArrowLeft size={18} />
          <span>Pulse</span>
        </button>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search ID or Context..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2B21C1] text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="px-3 py-1.5 bg-slate-100 rounded-md text-xs font-medium text-slate-600 border border-slate-200">
          Showing <strong className="text-slate-900">{sortedData.length}</strong> results
        </div>
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${isDropdownOpen ? "border-[#2B21C1] ring-2 ring-[#2B21C1]/10 bg-indigo-50 text-[#161160]" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
            <span>{FILTER_OPTIONS.find(o => o.value === filterType)?.label}</span>
            <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
              {FILTER_OPTIONS.map((option) => (
                <button key={option.value} onClick={() => { setFilterType(option.value); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${filterType === option.value ? "text-[#2B21C1] font-medium bg-indigo-50/50" : "text-slate-700"}`}>
                  {option.label}
                  {filterType === option.value && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-4 w-8"></th>
              <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Context / Strategy" sortKey="context" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Duration" sortKey="duration" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Turns" sortKey="turns" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={handleSort} />
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedData.map((c) => {
               const context = c.conversation_initiation_client_data?.dynamic_variables?.context_title || "Unknown";
               const type = c.conversation_initiation_client_data?.dynamic_variables?.context_type || "General";
               const isFailure = c.transcript.length === 0;
               
               const hasTools = c.transcript.some(t => t.tool_calls && t.tool_calls.some((tc: any) => tc.tool_name !== 'end_call'));
               const hasToolError = c.transcript.some(t => t.tool_results && t.tool_results.some((r: any) => r.tool_name !== 'end_call' && r.is_error));
               
               const pinned = isPinned(c.conversation_id);

               return (
                <tr key={c.conversation_id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4">
                    <button 
                      onClick={(e) => handlePin(e, c)}
                      className={`p-1.5 rounded hover:bg-indigo-100 transition-colors ${pinned ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}
                    >
                      <Pin size={14} fill={pinned ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td className="p-4 text-slate-500 whitespace-nowrap font-mono text-xs">
                    {format(new Date(c.metadata.start_time_unix_secs * 1000), "MMM d, HH:mm")}
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-[#161160]">{context}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-slate-400 bg-slate-100 inline-block px-1.5 py-0.5 rounded">{type}</span>
                      {hasTools && <span className="text-xs text-indigo-600 bg-indigo-50 inline-flex items-center gap-1 px-1.5 py-0.5 rounded"><Wrench size={10}/> Tool</span>}
                      {hasToolError && <span className="text-xs text-rose-600 bg-rose-50 inline-flex items-center gap-1 px-1.5 py-0.5 rounded"><AlertTriangle size={10}/> Error</span>}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-600">{c.metadata.call_duration_secs}s</td>
                  <td className="p-4 font-mono text-slate-600">{c.transcript.length}</td>
                  <td className="p-4">
                    {isFailure ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">Failed</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">Success</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => onSelect(c.conversation_id)} className="text-[#2B21C1] font-medium hover:underline opacity-0 group-hover:opacity-100 transition-opacity text-xs uppercase tracking-wide">
                      View Transcript
                    </button>
                  </td>
                </tr>
               )
            })}
            {sortedData.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-slate-400">No conversations found matching these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};