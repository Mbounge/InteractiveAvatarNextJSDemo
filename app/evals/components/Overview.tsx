import React, { useMemo, useState, useEffect } from "react";
import { Conversation, FilterState, Message } from "../types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Users, Clock, Zap, AlertOctagon, CheckCircle2, MessageSquare, Layers, Filter, Pin, Wrench, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";
import { useWorkbench } from "../context/WorkbenchContext";
import { ReportGenerator } from "./ReportGenerator";

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

const getMinAvgMax = (arr: number[]) => {
  if (arr.length === 0) return "0 / 0.0 / 0";
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return `${min} / ${avg.toFixed(1)} / ${max}`;
};

// Helper to extract the Average from "Min / Avg / Max" string for sorting
const getAvgFromStr = (str: string) => {
  try {
    return parseFloat(str.split(' / ')[1]);
  } catch {
    return 0;
  }
};

const getUserTurns = (transcript: Message[]) => {
  if (!transcript) return 0;
  return transcript.filter(t => t.role === 'user').length;
};

const calculateToolStats = (transcript: Message[]) => {
  let usedTool = false;
  let totalCalls = 0;
  let successCalls = 0;

  if (!transcript) return { usedTool, totalCalls, successCalls };

  transcript.forEach(turn => {
    if (turn.tool_calls) {
      const realTools = turn.tool_calls.filter((tc: any) => tc.tool_name !== 'end_call');
      if (realTools.length > 0) usedTool = true;
    }
    if (turn.tool_results) {
      turn.tool_results.forEach((res: any) => {
        if (res.tool_name !== 'end_call') {
          totalCalls++;
          if (!res.is_error) successCalls++;
        }
      });
    }
  });

  return { usedTool, totalCalls, successCalls };
};

// --- Sorting Types & Helper ---
type SortConfig = { key: string; direction: 'asc' | 'desc' };

const sortData = (data: any[], config: SortConfig) => {
  return [...data].sort((a, b) => {
    let aVal = a[config.key];
    let bVal = b[config.key];

    // Handle calculated fields that aren't direct properties
    if (config.key === 'abandonRate') {
      aVal = a.abandonedCount / a.count;
      bVal = b.abandonedCount / b.count;
    } else if (config.key === 'deepRate') {
      aVal = a.deepCount / a.count;
      bVal = b.deepCount / b.count;
    } else if (config.key === 'toolUseRate') {
      aVal = a.toolUseCount / a.count;
      bVal = b.toolUseCount / b.count;
    } else if (config.key === 'funcSuccessRate') {
      aVal = a.totalToolCalls > 0 ? a.successfulToolCalls / a.totalToolCalls : 0;
      bVal = b.totalToolCalls > 0 ? b.successfulToolCalls / b.totalToolCalls : 0;
    } else if (config.key === 'durationAvg') {
      aVal = a.durations.reduce((x:number,y:number)=>x+y,0) / a.count;
      bVal = b.durations.reduce((x:number,y:number)=>x+y,0) / b.count;
    } else if (config.key === 'turnsAvg') {
      aVal = a.turns.reduce((x:number,y:number)=>x+y,0) / a.count;
      bVal = b.turns.reduce((x:number,y:number)=>x+y,0) / b.count;
    }

    if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
    return 0;
  });
};

const SortableHeader = ({ label, sortKey, currentSort, onSort, align = "left", className = "" }: any) => (
  <th className={`px-6 py-3 text-${align} ${className}`}>
    <button 
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 font-semibold hover:text-[#161160] ${align === 'right' ? 'ml-auto' : ''}`}
    >
      {label}
      {currentSort.key === sortKey ? (
        currentSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
      ) : <div className="w-4" />}
    </button>
  </th>
);

// --- Metric Cell Component ---
const MetricCell = ({ 
  value, 
  label, 
  filter, 
  onDrillDown, 
  textColor = "text-slate-700", 
  bgColor = "hover:bg-slate-100"
}: any) => {
  const { addItem, removeItem, isPinned } = useWorkbench();
  const pinId = `slice-${JSON.stringify(filter)}`;
  const pinned = isPinned(pinId);

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinned) {
      removeItem(pinId);
    } else {
      addItem({
        id: pinId,
        type: 'stat-slice',
        label: label,
        data: { value, filter },
        context: { metric: label, value, filter }
      });
    }
  };

  return (
    <td 
      className={`px-6 py-4 text-right font-mono cursor-pointer transition-colors group relative ${textColor} ${bgColor}`}
      onClick={() => onDrillDown(filter)}
    >
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={handlePin}
          className={`p-1 rounded transition-all opacity-0 group-hover:opacity-100 ${pinned ? 'text-indigo-600 opacity-100' : 'text-slate-300 hover:text-indigo-600 hover:bg-white'}`}
          title={pinned ? "Remove from Workbench" : "Pin to Workbench"}
        >
          <Pin size={12} fill={pinned ? "currentColor" : "none"} />
        </button>
        <span>{value}</span>
      </div>
    </td>
  );
};

export const Overview = ({ 
  data, 
  onDrillDown,
  dateRange,
  setDateRange
}: { 
  data: Conversation[], 
  onDrillDown: (f: FilterState) => void,
  dateRange: { start: string, end: string },
  setDateRange: (range: { start: string, end: string }) => void
}) => {
  const { addItem, removeItem, isPinned } = useWorkbench();
  
  // Sort States for each table
  const [agentSort, setAgentSort] = useState<SortConfig>({ key: 'count', direction: 'desc' });
  const [modeSort, setModeSort] = useState<SortConfig>({ key: 'count', direction: 'desc' });
  const [typeSort, setTypeSort] = useState<SortConfig>({ key: 'count', direction: 'desc' });
  const [promptSort, setPromptSort] = useState<SortConfig>({ key: 'count', direction: 'desc' });

  useEffect(() => {
    if (data.length > 0 && !dateRange.start) {
      const timestamps = data.map(c => c.metadata.start_time_unix_secs * 1000);
      const maxDate = new Date(Math.max(...timestamps));
      const defaultStartDate = "2025-08-01";

      setDateRange({
        start: defaultStartDate,
        end: format(maxDate, 'yyyy-MM-dd')
      });
    }
  }, [data]);

  const filteredData = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return data;
    const start = startOfDay(parseISO(dateRange.start)).getTime() / 1000;
    const end = endOfDay(parseISO(dateRange.end)).getTime() / 1000;
    return data.filter(c => c.metadata.start_time_unix_secs >= start && c.metadata.start_time_unix_secs <= end);
  }, [data, dateRange]);

  const handleDrillDownWithDate = (filter: FilterState) => {
    onDrillDown({
      ...filter,
      startDate: dateRange.start,
      endDate: dateRange.end
    });
  };

  // --- 1. Global KPIs ---
  const kpis = useMemo(() => {
    const total = filteredData.length;
    if (total === 0) return { total: 0, meaningful: 0, abandoned: 0, avgDuration: 0 };
    
    const meaningful = filteredData.filter(c => c.metadata.call_duration_secs > 60 && getUserTurns(c.transcript) >= 5).length;
    const abandoned = filteredData.filter(c => c.metadata.call_duration_secs < 15).length;
    const avgDuration = filteredData.reduce((acc, c) => acc + c.metadata.call_duration_secs, 0) / total;
    return { total, meaningful, abandoned, avgDuration };
  }, [filteredData]);

  // --- 2. Agent Stats ---
  const agentStats = useMemo(() => {
    const stats: Record<string, any> = {};
    Object.keys(AGENT_ID_TO_NAME).forEach(id => {
      stats[id] = {
        id, name: AGENT_ID_TO_NAME[id], count: 0, abandonedCount: 0, deepCount: 0, toolUseCount: 0,
        totalToolCalls: 0, successfulToolCalls: 0, durations: [] as number[], turns: [] as number[]
      };
    });
    filteredData.forEach(c => {
      const id = c.agent_id;
      if (!stats[id]) return; 
      stats[id].count++;
      stats[id].durations.push(c.metadata.call_duration_secs);
      stats[id].turns.push(c.transcript.length);
      if (c.metadata.call_duration_secs < 15) stats[id].abandonedCount++;
      if (c.metadata.call_duration_secs > 60 && getUserTurns(c.transcript) >= 5) stats[id].deepCount++;
      const { usedTool, totalCalls, successCalls } = calculateToolStats(c.transcript);
      if (usedTool) stats[id].toolUseCount++;
      stats[id].totalToolCalls += totalCalls;
      stats[id].successfulToolCalls += successCalls;
    });
    return Object.values(stats).filter(s => s.count > 0);
  }, [filteredData]);

  // --- 3. Interaction Mode Stats ---
  const modeStats = useMemo(() => {
    const stats: Record<string, any> = {
      "Standard Persona": { name: "Standard Persona", count: 0, durations: [], turns: [], abandonedCount: 0, deepCount: 0, toolUseCount: 0, totalToolCalls: 0, successfulToolCalls: 0 },
      "Specialized Contexts": { name: "Specialized Contexts", count: 0, durations: [], turns: [], abandonedCount: 0, deepCount: 0, toolUseCount: 0, totalToolCalls: 0, successfulToolCalls: 0 }
    };
    filteredData.forEach(c => {
      if (c.agent_id !== "zvpmic1VqdKVwX1H0W3T") return;
      const type = c.conversation_initiation_client_data?.dynamic_variables?.context_type || "General";
      const key = (type === "SystemPrompt" || type === "General" || type === "Unknown") ? "Standard Persona" : "Specialized Contexts";
      stats[key].count++;
      stats[key].durations.push(c.metadata.call_duration_secs);
      stats[key].turns.push(c.transcript.length);
      if (c.metadata.call_duration_secs < 15) stats[key].abandonedCount++;
      if (c.metadata.call_duration_secs > 60 && getUserTurns(c.transcript) >= 5) stats[key].deepCount++;
      const { usedTool, totalCalls, successCalls } = calculateToolStats(c.transcript);
      if (usedTool) stats[key].toolUseCount++;
      stats[key].totalToolCalls += totalCalls;
      stats[key].successfulToolCalls += successCalls;
    });
    return Object.values(stats);
  }, [filteredData]);

  // --- 4. Context Type Stats ---
  const typeStats = useMemo(() => {
    const stats: Record<string, any> = {};
    filteredData.forEach(c => {
      if (c.agent_id !== "zvpmic1VqdKVwX1H0W3T") return;
      const type = c.conversation_initiation_client_data?.dynamic_variables?.context_type || "General";
      if (!stats[type]) stats[type] = { type, count: 0, durations: [], turns: [], abandonedCount: 0, deepCount: 0, toolUseCount: 0, totalToolCalls: 0, successfulToolCalls: 0 };
      stats[type].count++;
      stats[type].durations.push(c.metadata.call_duration_secs);
      stats[type].turns.push(c.transcript.length);
      if (c.metadata.call_duration_secs < 15) stats[type].abandonedCount++;
      if (c.metadata.call_duration_secs > 60 && getUserTurns(c.transcript) >= 5) stats[type].deepCount++;
      const { usedTool, totalCalls, successCalls } = calculateToolStats(c.transcript);
      if (usedTool) stats[type].toolUseCount++;
      stats[type].totalToolCalls += totalCalls;
      stats[type].successfulToolCalls += successCalls;
    });
    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // --- 5. Specific Prompt Stats ---
  const promptStats = useMemo(() => {
    const stats: Record<string, any> = {};
    filteredData.forEach(c => {
      if (c.agent_id !== "zvpmic1VqdKVwX1H0W3T") return;
      const title = c.conversation_initiation_client_data?.dynamic_variables?.context_title || "Unknown";
      if (!stats[title]) stats[title] = { title, count: 0, durations: [], turns: [], abandonedCount: 0, deepCount: 0, toolUseCount: 0, totalToolCalls: 0, successfulToolCalls: 0 };
      stats[title].count++;
      stats[title].durations.push(c.metadata.call_duration_secs);
      stats[title].turns.push(c.transcript.length);
      if (c.metadata.call_duration_secs < 15) stats[title].abandonedCount++;
      if (c.metadata.call_duration_secs > 60 && getUserTurns(c.transcript) >= 5) stats[title].deepCount++;
      const { usedTool, totalCalls, successCalls } = calculateToolStats(c.transcript);
      if (usedTool) stats[title].toolUseCount++;
      stats[title].totalToolCalls += totalCalls;
      stats[title].successfulToolCalls += successCalls;
    });
    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [filteredData]);

  const chartData = useMemo(() => {
    const grouped: any = {};
    filteredData.forEach(c => {
      const date = format(new Date(c.metadata.start_time_unix_secs * 1000), 'MMM dd');
      if (!grouped[date]) grouped[date] = { date, count: 0, duration: 0 };
      grouped[date].count += 1;
      grouped[date].duration += c.metadata.call_duration_secs;
    });
    return Object.values(grouped).map((d: any) => ({
      ...d,
      avgDuration: Math.round(d.duration / d.count)
    })).reverse();
  }, [filteredData]);

  // --- Sorting Handlers ---
  const handleAgentSort = (key: string) => setAgentSort(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  const handleModeSort = (key: string) => setModeSort(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  const handleTypeSort = (key: string) => setTypeSort(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  const handlePromptSort = (key: string) => setPromptSort(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));

  const handlePinRow = (e: React.MouseEvent, id: string, label: string, data: any) => {
    e.stopPropagation();
    const fullId = `stat-${id}`;
    if (isPinned(fullId)) {
      removeItem(fullId);
    } else {
      addItem({ id: fullId, type: 'stat-row', label, data });
    }
  };

  // --- Prepare Stats Object for Report Generator ---
  const reportStats = useMemo(() => ({
    kpis,
    agentStats,
    typeStats,
  }), [kpis, agentStats, typeStats]);

  const dateRangeLabel = dateRange.start && dateRange.end 
    ? `${format(parseISO(dateRange.start), 'MMM d')} - ${format(parseISO(dateRange.end), 'MMM d')}`
    : "All Time";

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#161160]">System Pulse</h2>
          <p className="text-slate-500">Real-time evaluation metrics. Click on names or colored metrics to filter the data.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <ReportGenerator 
            data={filteredData} 
            stats={reportStats} 
            dateRange={dateRangeLabel} 
          />
          <DateRangePicker startDate={dateRange.start} endDate={dateRange.end} onChange={(start, end) => setDateRange({ start, end })} />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard icon={<Users size={20} />} label="Total Conversations" value={kpis.total} />
        <KpiCard icon={<Clock size={20} />} label="Avg Duration" value={`${Math.round(kpis.avgDuration)}s`} />
        <KpiCard icon={<CheckCircle2 size={20} />} label="Meaningful Engagement" value={`${kpis.total > 0 ? ((kpis.meaningful / kpis.total) * 100).toFixed(1) : 0}%`} subtext=">60s & 5+ User Turns" color="text-emerald-600" bg="bg-emerald-50" />
        <KpiCard icon={<AlertOctagon size={20} />} label="Quick Abandonment" value={`${kpis.total > 0 ? ((kpis.abandoned / kpis.total) * 100).toFixed(1) : 0}%`} subtext="Duration < 15s" color="text-rose-600" bg="bg-rose-50" />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-[#161160] mb-6">Volume vs. Engagement Trend</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart 
              data={chartData} 
              onClick={(e) => { 
                // FIX: Call onDrillDown directly to avoid merging with global range
                if (e && e.activeLabel) onDrillDown({ date: e.activeLabel }); 
              }} 
              className="cursor-pointer"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Line yAxisId="left" type="monotone" dataKey="count" stroke="#2B21C1" strokeWidth={3} dot={false} name="Conversations" />
              <Line yAxisId="right" type="monotone" dataKey="avgDuration" stroke="#10b981" strokeWidth={2} dot={false} name="Avg Duration (s)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table 1: Agents */}
      <TableSection title="Agent Performance Breakdown" icon={<Users size={20} className="text-indigo-600" />}>
        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
          <tr>
            <th className="px-6 py-3 w-8"></th>
            <SortableHeader label="Agent Name" sortKey="name" currentSort={agentSort} onSort={handleAgentSort} />
            <SortableHeader label="Total" sortKey="count" currentSort={agentSort} onSort={handleAgentSort} align="right" />
            <SortableHeader label="Quick Abandon" sortKey="abandonRate" currentSort={agentSort} onSort={handleAgentSort} align="right" className="text-rose-600" />
            <SortableHeader label="Deep Engage" sortKey="deepRate" currentSort={agentSort} onSort={handleAgentSort} align="right" className="text-emerald-600" />
            <SortableHeader label="Tool Use %" sortKey="toolUseRate" currentSort={agentSort} onSort={handleAgentSort} align="right" className="text-indigo-600" />
            <SortableHeader label="Func. Success %" sortKey="funcSuccessRate" currentSort={agentSort} onSort={handleAgentSort} align="right" className="text-indigo-600" />
            <SortableHeader label="Duration" sortKey="durationAvg" currentSort={agentSort} onSort={handleAgentSort} align="right" />
            <SortableHeader label="Turns" sortKey="turnsAvg" currentSort={agentSort} onSort={handleAgentSort} align="right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortData(agentStats, agentSort).map((agent: any) => {
            const funcSuccess = agent.totalToolCalls > 0 ? ((agent.successfulToolCalls / agent.totalToolCalls) * 100).toFixed(1) : "N/A";
            const pinned = isPinned(`stat-${agent.id}`);
            return (
              <tr key={agent.name} className="group transition-colors hover:bg-slate-50">
                <td className="px-6 py-4">
                  <button 
                    onClick={(e) => handlePinRow(e, agent.id, `Stats: ${agent.name}`, agent)}
                    className={`p-1.5 rounded hover:bg-indigo-100 transition-colors ${pinned ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}
                  >
                    <Pin size={14} fill={pinned ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="px-6 py-4 font-medium text-indigo-700 cursor-pointer group-hover:text-indigo-900 group-hover:underline flex items-center gap-2" onClick={() => handleDrillDownWithDate({ agentId: agent.id, filterType: "All" })}>
                  {agent.name}
                  <Filter size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
                <MetricCell value={agent.count} label={`${agent.name} Total`} filter={{ agentId: agent.id, filterType: "All" }} onDrillDown={handleDrillDownWithDate} />
                <MetricCell value={`${((agent.abandonedCount / agent.count) * 100).toFixed(1)}%`} label={`${agent.name} Abandon`} filter={{ agentId: agent.id, filterType: "Short (<15s)" }} onDrillDown={handleDrillDownWithDate} textColor="text-rose-600" bgColor="hover:bg-rose-50" />
                <MetricCell value={`${((agent.deepCount / agent.count) * 100).toFixed(1)}%`} label={`${agent.name} Deep`} filter={{ agentId: agent.id, filterType: "Long (>60s)" }} onDrillDown={handleDrillDownWithDate} textColor="text-emerald-600" bgColor="hover:bg-emerald-50" />
                <MetricCell value={`${((agent.toolUseCount / agent.count) * 100).toFixed(1)}%`} label={`${agent.name} Tool Use`} filter={{ agentId: agent.id, filterType: "Tool Used" }} onDrillDown={handleDrillDownWithDate} textColor="text-indigo-600" bgColor="hover:bg-indigo-50" />
                <MetricCell value={funcSuccess === "N/A" ? "N/A" : `${funcSuccess}%`} label={`${agent.name} Func Success`} filter={{ agentId: agent.id, filterType: "Tool Failure" }} onDrillDown={handleDrillDownWithDate} textColor="text-indigo-600" bgColor="hover:bg-indigo-50" />
                <td className="px-6 py-4 text-right font-mono text-slate-600">{getMinAvgMax(agent.durations)}</td>
                <td className="px-6 py-4 text-right font-mono text-slate-600">{getMinAvgMax(agent.turns)}</td>
              </tr>
            );
          })}
        </tbody>
      </TableSection>

      {/* Table 2: Interaction Mode */}
      <TableSection title="Interaction Mode: Standard vs. Specialized" icon={<Layers size={20} className="text-indigo-600" />}>
        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
          <tr>
            <th className="px-6 py-3 w-8"></th>
            <SortableHeader label="Mode" sortKey="name" currentSort={modeSort} onSort={handleModeSort} />
            <SortableHeader label="Count" sortKey="count" currentSort={modeSort} onSort={handleModeSort} align="right" />
            <SortableHeader label="Quick Abandon" sortKey="abandonRate" currentSort={modeSort} onSort={handleModeSort} align="right" className="text-rose-600" />
            <SortableHeader label="Deep Engage" sortKey="deepRate" currentSort={modeSort} onSort={handleModeSort} align="right" className="text-emerald-600" />
            <SortableHeader label="Tool Use %" sortKey="toolUseRate" currentSort={modeSort} onSort={handleModeSort} align="right" className="text-indigo-600" />
            <SortableHeader label="Func. Success %" sortKey="funcSuccessRate" currentSort={modeSort} onSort={handleModeSort} align="right" className="text-indigo-600" />
            <SortableHeader label="Duration" sortKey="durationAvg" currentSort={modeSort} onSort={handleModeSort} align="right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortData(modeStats, modeSort).map((mode: any) => {
            if (mode.count === 0) return null;
            const abandonRate = ((mode.abandonedCount / mode.count) * 100).toFixed(1);
            const deepRate = ((mode.deepCount / mode.count) * 100).toFixed(1);
            const funcSuccess = mode.totalToolCalls > 0 ? ((mode.successfulToolCalls / mode.totalToolCalls) * 100).toFixed(1) : "N/A";
            const modeKey = mode.name.includes("Standard") ? "Standard" : "Specialized";
            const pinned = isPinned(`stat-mode-${mode.name}`);

            return (
              <tr key={mode.name} className="group transition-colors hover:bg-slate-50">
                <td className="px-6 py-4">
                  <button 
                    onClick={(e) => handlePinRow(e, `mode-${mode.name}`, `Stats: ${mode.name}`, mode)}
                    className={`p-1.5 rounded hover:bg-indigo-100 transition-colors ${pinned ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}
                  >
                    <Pin size={14} fill={pinned ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="px-6 py-4 font-medium text-indigo-700 cursor-pointer group-hover:text-indigo-900 group-hover:underline flex items-center gap-2" onClick={() => handleDrillDownWithDate({ interactionMode: modeKey, filterType: "All" })}>
                  {mode.name}
                  <Filter size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
                <MetricCell value={mode.count} label={`${mode.name} Total`} filter={{ interactionMode: modeKey, filterType: "All" }} onDrillDown={handleDrillDownWithDate} />
                <MetricCell value={`${abandonRate}%`} label={`${mode.name} Abandon`} filter={{ interactionMode: modeKey, filterType: "Short (<15s)" }} onDrillDown={handleDrillDownWithDate} textColor="text-rose-600" bgColor="hover:bg-rose-50" />
                <MetricCell value={`${deepRate}%`} label={`${mode.name} Deep`} filter={{ interactionMode: modeKey, filterType: "Long (>60s)" }} onDrillDown={handleDrillDownWithDate} textColor="text-emerald-600" bgColor="hover:bg-emerald-50" />
                <MetricCell value={`${((mode.toolUseCount / mode.count) * 100).toFixed(1)}%`} label={`${mode.name} Tool Use`} filter={{ interactionMode: modeKey, filterType: "Tool Used" }} onDrillDown={handleDrillDownWithDate} textColor="text-indigo-600" bgColor="hover:bg-indigo-50" />
                <MetricCell value={funcSuccess === "N/A" ? "N/A" : `${funcSuccess}%`} label={`${mode.name} Func Success`} filter={{ interactionMode: modeKey, filterType: "Tool Failure" }} onDrillDown={handleDrillDownWithDate} textColor="text-indigo-600" bgColor="hover:bg-indigo-50" />
                <td className="px-6 py-4 text-right font-mono text-slate-600">{getMinAvgMax(mode.durations)}</td>
              </tr>
            );
          })}
        </tbody>
      </TableSection>

      {/* Table 3: Context Types */}
      <TableSection title="Context Prompt Types Performance" icon={<Zap size={20} className="text-indigo-600" />}>
        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
          <tr>
            <th className="px-6 py-3 w-8"></th>
            <SortableHeader label="Context Type" sortKey="type" currentSort={typeSort} onSort={handleTypeSort} />
            <SortableHeader label="Count" sortKey="count" currentSort={typeSort} onSort={handleTypeSort} align="right" />
            <SortableHeader label="Quick Abandon" sortKey="abandonRate" currentSort={typeSort} onSort={handleTypeSort} align="right" className="text-rose-600" />
            <SortableHeader label="Deep Engage" sortKey="deepRate" currentSort={typeSort} onSort={handleTypeSort} align="right" className="text-emerald-600" />
            <SortableHeader label="Tool Use %" sortKey="toolUseRate" currentSort={typeSort} onSort={handleTypeSort} align="right" className="text-indigo-600" />
            <SortableHeader label="Func. Success %" sortKey="funcSuccessRate" currentSort={typeSort} onSort={handleTypeSort} align="right" className="text-indigo-600" />
            <SortableHeader label="Duration" sortKey="durationAvg" currentSort={typeSort} onSort={handleTypeSort} align="right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortData(typeStats, typeSort).map((strat: any) => {
            const abandonRate = ((strat.abandonedCount / strat.count) * 100).toFixed(1);
            const deepRate = ((strat.deepCount / strat.count) * 100).toFixed(1);
            const funcSuccess = strat.totalToolCalls > 0 ? ((strat.successfulToolCalls / strat.totalToolCalls) * 100).toFixed(1) : "N/A";
            const pinned = isPinned(`stat-type-${strat.type}`);

            return (
              <tr key={strat.type} className="group transition-colors hover:bg-slate-50">
                <td className="px-6 py-4">
                  <button 
                    onClick={(e) => handlePinRow(e, `type-${strat.type}`, `Stats: ${strat.type}`, strat)}
                    className={`p-1.5 rounded hover:bg-indigo-100 transition-colors ${pinned ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}
                  >
                    <Pin size={14} fill={pinned ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="px-6 py-4 font-medium text-indigo-700 cursor-pointer group-hover:text-indigo-900 group-hover:underline flex items-center gap-2" onClick={() => handleDrillDownWithDate({ contextType: strat.type, filterType: "All" })}>
                  {strat.type}
                  <Filter size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
                <MetricCell value={strat.count} label={`${strat.type} Total`} filter={{ contextType: strat.type, filterType: "All" }} onDrillDown={handleDrillDownWithDate} />
                <MetricCell value={`${abandonRate}%`} label={`${strat.type} Abandon`} filter={{ contextType: strat.type, filterType: "Short (<15s)" }} onDrillDown={handleDrillDownWithDate} textColor="text-rose-600" bgColor="hover:bg-rose-50" />
                <MetricCell value={`${deepRate}%`} label={`${strat.type} Deep`} filter={{ contextType: strat.type, filterType: "Long (>60s)" }} onDrillDown={handleDrillDownWithDate} textColor="text-emerald-600" bgColor="hover:bg-emerald-50" />
                <MetricCell value={`${((strat.toolUseCount / strat.count) * 100).toFixed(1)}%`} label={`${strat.type} Tool Use`} filter={{ contextType: strat.type, filterType: "Tool Used" }} onDrillDown={handleDrillDownWithDate} textColor="text-indigo-600" bgColor="hover:bg-indigo-50" />
                <MetricCell value={funcSuccess === "N/A" ? "N/A" : `${funcSuccess}%`} label={`${strat.type} Func Success`} filter={{ contextType: strat.type, filterType: "Tool Failure" }} onDrillDown={handleDrillDownWithDate} textColor="text-indigo-600" bgColor="hover:bg-indigo-50" />
                <td className="px-6 py-4 text-right font-mono text-slate-600">{getMinAvgMax(strat.durations)}</td>
              </tr>
            );
          })}
        </tbody>
      </TableSection>

      {/* Table 4: Specific Prompts */}
      <TableSection title="Specific Prompt Performance" icon={<MessageSquare size={20} className="text-indigo-600" />}>
        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
          <tr>
            <th className="px-6 py-3 w-8"></th>
            <SortableHeader label="Prompt Title" sortKey="title" currentSort={promptSort} onSort={handlePromptSort} />
            <SortableHeader label="Count" sortKey="count" currentSort={promptSort} onSort={handlePromptSort} align="right" />
            <SortableHeader label="Quick Abandon" sortKey="abandonRate" currentSort={promptSort} onSort={handlePromptSort} align="right" className="text-rose-600" />
            <SortableHeader label="Deep Engage" sortKey="deepRate" currentSort={promptSort} onSort={handlePromptSort} align="right" className="text-emerald-600" />
            <SortableHeader label="Tool Use %" sortKey="toolUseRate" currentSort={promptSort} onSort={handlePromptSort} align="right" className="text-indigo-600" />
            <SortableHeader label="Func. Success %" sortKey="funcSuccessRate" currentSort={promptSort} onSort={handlePromptSort} align="right" className="text-indigo-600" />
            <SortableHeader label="Duration" sortKey="durationAvg" currentSort={promptSort} onSort={handlePromptSort} align="right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortData(promptStats, promptSort).map((prompt: any) => {
            const abandonRate = ((prompt.abandonedCount / prompt.count) * 100).toFixed(1);
            const deepRate = ((prompt.deepCount / prompt.count) * 100).toFixed(1);
            const funcSuccess = prompt.totalToolCalls > 0 ? ((prompt.successfulToolCalls / prompt.totalToolCalls) * 100).toFixed(1) : "N/A";
            const pinned = isPinned(`stat-prompt-${prompt.title}`);

            return (
              <tr key={prompt.title} className="group transition-colors hover:bg-slate-50">
                <td className="px-6 py-4">
                  <button 
                    onClick={(e) => handlePinRow(e, `prompt-${prompt.title}`, `Stats: ${prompt.title}`, prompt)}
                    className={`p-1.5 rounded hover:bg-indigo-100 transition-colors ${pinned ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}
                  >
                    <Pin size={14} fill={pinned ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="px-6 py-4 font-medium text-indigo-700 cursor-pointer group-hover:text-indigo-900 group-hover:underline flex items-center gap-2" onClick={() => handleDrillDownWithDate({ contextTitle: prompt.title, filterType: "All" })}>
                  {prompt.title}
                  <Filter size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
                <MetricCell value={prompt.count} label={`${prompt.title} Total`} filter={{ contextTitle: prompt.title, filterType: "All" }} onDrillDown={handleDrillDownWithDate} />
                <MetricCell value={`${abandonRate}%`} label={`${prompt.title} Abandon`} filter={{ contextTitle: prompt.title, filterType: "Short (<15s)" }} onDrillDown={handleDrillDownWithDate} textColor="text-rose-600" bgColor="hover:bg-rose-50" />
                <MetricCell value={`${deepRate}%`} label={`${prompt.title} Deep`} filter={{ contextTitle: prompt.title, filterType: "Long (>60s)" }} onDrillDown={handleDrillDownWithDate} textColor="text-emerald-600" bgColor="hover:bg-emerald-50" />
                <MetricCell value={`${((prompt.toolUseCount / prompt.count) * 100).toFixed(1)}%`} label={`${prompt.title} Tool Use`} filter={{ contextTitle: prompt.title, filterType: "Tool Used" }} onDrillDown={handleDrillDownWithDate} textColor="text-indigo-600" bgColor="hover:bg-indigo-50" />
                <MetricCell value={funcSuccess === "N/A" ? "N/A" : `${funcSuccess}%`} label={`${prompt.title} Func Success`} filter={{ contextTitle: prompt.title, filterType: "Tool Failure" }} onDrillDown={handleDrillDownWithDate} textColor="text-indigo-600" bgColor="hover:bg-indigo-50" />
                <td className="px-6 py-4 text-right font-mono text-slate-600">{getMinAvgMax(prompt.durations)}</td>
              </tr>
            );
          })}
        </tbody>
      </TableSection>

    </div>
  );
};

const TableSection = ({ title, icon, children }: any) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="p-6 border-b border-slate-100 bg-indigo-50/30">
      <h3 className="text-lg font-bold text-[#161160] flex items-center gap-2">
        {icon} {title}
      </h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        {children}
      </table>
    </div>
  </div>
);

const KpiCard = ({ label, value, subtext, color = "text-[#161160]", bg = "bg-white", icon }: any) => (
  <div className={`p-6 rounded-xl shadow-sm border border-slate-200 ${bg === "bg-white" ? "bg-white" : bg}`}>
    <div className="flex items-center justify-between mb-2">
      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      {icon && <div className="text-slate-400">{icon}</div>}
    </div>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
    {subtext && <p className="text-xs text-slate-500 mt-1 font-medium">{subtext}</p>}
  </div>
);