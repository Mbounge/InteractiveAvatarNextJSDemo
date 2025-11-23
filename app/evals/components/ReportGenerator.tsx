import React, { useState } from "react";
import { FileText, Loader2, Download, CheckCircle, AlertTriangle } from "lucide-react";
import { Conversation, Message } from "../types";

interface ReportGeneratorProps {
  data: Conversation[];
  stats: any; // The calculated stats object from Overview
  dateRange: string;
}

// Helper to count user turns (Must match Overview logic)
const getUserTurns = (transcript: Message[]) => {
  if (!transcript) return 0;
  return transcript.filter(t => t.role === 'user').length;
};

export const ReportGenerator = ({ data, stats, dateRange }: ReportGeneratorProps) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'synthesizing' | 'rendering' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const generateReport = async () => {
    try {
      setStatus('processing');
      setProgress(0);
      setErrorMsg("");

      // 1. Batch Processing (Map)
      const BATCH_SIZE = 1000; 
      const batches = [];
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        batches.push(data.slice(i, i + BATCH_SIZE));
      }

      const batchSummaries = [];
      
      for (let i = 0; i < batches.length; i++) {
        try {
          const response = await fetch('/api/evals/batch-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversations: batches[i] })
          });
          
          if (!response.ok) throw new Error(`Batch ${i+1} failed`);
          
          const json = await response.json();
          batchSummaries.push(json.analysis);
          
          setProgress(Math.round(((i + 1) / batches.length) * 100));
        } catch (err) {
          console.error(`Error processing batch ${i+1}:`, err);
        }
      }

      if (batchSummaries.length === 0) {
        throw new Error("All batches failed to process.");
      }

      // 2. Final Synthesis (Reduce)
      setStatus('synthesizing');
      const reportResponse = await fetch('/api/evals/final-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSummaries, stats })
      });

      if (!reportResponse.ok) throw new Error("Final report generation failed");
      const { html } = await reportResponse.json();

      // 3. PDF Generation
      setStatus('rendering');
      
      // Prepare data for PDF API
      const pdfPayload = {
        dateRange,
        kpis: {
          totalConversations: stats.kpis.total,
          avgDuration: `${Math.round(stats.kpis.avgDuration)}s`,
          meaningfulEngagement: `${((stats.kpis.meaningful / stats.kpis.total) * 100).toFixed(1)}%`,
          techFailureRate: `${((stats.kpis.abandoned / stats.kpis.total) * 100).toFixed(1)}%`
        },
        // Map the agent stats array to the PDF format
        agentStats: stats.agentStats.map((a: any) => {
            const funcSuccess = a.totalToolCalls > 0 
                ? `${((a.successfulToolCalls / a.totalToolCalls) * 100).toFixed(1)}%` 
                : "N/A";

            const minDur = a.durations.length ? Math.min(...a.durations) : 0;
            const maxDur = a.durations.length ? Math.max(...a.durations) : 0;
            const avgDur = a.durations.length ? (a.durations.reduce((x:number,y:number)=>x+y,0)/a.count).toFixed(1) : 0;
            
            const minTurns = a.turns.length ? Math.min(...a.turns) : 0;
            const maxTurns = a.turns.length ? Math.max(...a.turns) : 0;
            const avgTurns = a.turns.length ? (a.turns.reduce((x:number,y:number)=>x+y,0)/a.count).toFixed(1) : 0;

            // Calculate Abandon & Deep Rates for this specific agent
            // Note: 'a' object from Overview stats already has abandonedCount and deepCount
            const abandonRate = `${((a.abandonedCount / a.count) * 100).toFixed(1)}%`;
            const deepRate = `${((a.deepCount / a.count) * 100).toFixed(1)}%`;

            return {
                name: a.name,
                total: a.count,
                abandonRate: abandonRate, // NEW
                deepRate: deepRate,       // NEW
                toolUse: `${((a.toolUseCount/a.count)*100).toFixed(1)}%`,
                funcSuccess: funcSuccess,
                duration: `${minDur} / ${avgDur} / ${maxDur}`,
                turns: `${minTurns} / ${avgTurns} / ${maxTurns}`
            };
        }),
        strategyStats: stats.typeStats ? stats.typeStats.map((s: any) => {
            const avgDur = s.durations.length ? (s.durations.reduce((x:number,y:number)=>x+y,0)/s.count).toFixed(1) : 0;
            return {
                type: s.type,
                count: s.count,
                avgDuration: `${avgDur}s`,
                abandonRate: `${((s.abandonedCount/s.count)*100).toFixed(1)}%`,
                deepRate: `${((s.deepCount/s.count)*100).toFixed(1)}%`
            };
        }) : [],
        analysisHtml: html
      };

      const pdfResponse = await fetch('/api/evals/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfPayload)
      });

      if (!pdfResponse.ok) throw new Error("PDF generation failed");

      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GRAET_AI_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);

    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMsg("Failed");
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <button
      onClick={generateReport}
      disabled={status !== 'idle'}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-sm min-w-[160px] justify-center
        ${status === 'idle' ? 'bg-[#2B21C1] text-white hover:bg-indigo-800' : 'bg-slate-100 text-slate-500 cursor-not-allowed'}
        ${status === 'error' ? 'bg-rose-100 text-rose-700 border border-rose-200' : ''}
        ${status === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : ''}
      `}
    >
      {status === 'idle' && <><FileText size={18} /> Generate Report</>}
      {status === 'processing' && <><Loader2 size={18} className="animate-spin" /> Analyzing ({progress}%)</>}
      {status === 'synthesizing' && <><Loader2 size={18} className="animate-spin" /> Synthesizing...</>}
      {status === 'rendering' && <><Download size={18} className="animate-bounce" /> Creating PDF...</>}
      {status === 'success' && <><CheckCircle size={18} /> Done!</>}
      {status === 'error' && <><AlertTriangle size={18} /> {errorMsg || "Error"}</>}
    </button>
  );
};