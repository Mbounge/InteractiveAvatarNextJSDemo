"use client";

import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  FileSearch, 
  UploadCloud, 
  FileJson,
  Briefcase,
  CheckCircle2,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { Conversation, ViewMode, FilterState } from "./types";
import { Overview } from "./components/Overview";
import { ConversationExplorer } from "./components/ConversationExplorer";
import { TranscriptViewer } from "./components/TranscriptViewer";
import { WorkbenchProvider, useWorkbench } from "./context/WorkbenchContext";
import { WorkbenchDrawer } from "./components/WorkbenchDrawer";

const EvalsContent = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentView, setCurrentView] = useState<ViewMode>("overview");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  // --- Global Filter State ---
  const [activeFilters, setActiveFilters] = useState<FilterState>({});
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  
  // --- Loading & Error States ---
  const [isLoading, setIsLoading] = useState(false); // Default to false for upload flow
  
  // Workbench hooks
  const { toggleDrawer, items, notification } = useWorkbench();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const sorted = json.sort((a: Conversation, b: Conversation) => 
          b.metadata.start_time_unix_secs - a.metadata.start_time_unix_secs
        );
        setConversations(sorted);

        // --- Initialize Default Date Range (Aug 1st Logic) ---
        if (sorted.length > 0) {
          const timestamps = sorted.map((c: Conversation) => c.metadata.start_time_unix_secs * 1000);
          const maxDate = new Date(Math.max(...timestamps));
          // Default start date to August 1st, 2025 as requested
          const defaultStartDate = "2025-08-01";
          
          setDateRange({
            start: defaultStartDate,
            end: format(maxDate, 'yyyy-MM-dd')
          });
        }

      } catch (err) {
        console.error("Failed to parse JSON", err);
        alert("Invalid JSON file");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDrillDown = (filters: FilterState) => {
    setActiveFilters(filters);
    setCurrentView('explorer');
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setCurrentView('transcript');
  };

  // --- Empty State (Upload Screen) ---
  if (conversations.length === 0 && !isLoading) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center font-sans">
        <div className="flex flex-col items-center text-center max-w-md p-8">
          <div className="bg-white p-6 rounded-2xl shadow-lg shadow-indigo-900/5 mb-8 border border-slate-100">
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <UploadCloud size={40} className="text-[#2B21C1]" />
            </div>
            <h2 className="text-2xl font-bold text-[#161160] mb-2">Load Evaluation Data</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Upload your preprocessed <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono text-xs">conversation_details_tagged.json</code> file to begin analysis.
            </p>
          </div>
          
          <label className="group cursor-pointer relative inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 bg-[#2B21C1] rounded-full hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
            <span>Select JSON File</span>
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-[#2B21C1] animate-spin" />
          <p className="text-slate-500 font-medium">Processing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* --- Top Navigation Bar --- */}
      <header className="bg-white border-b border-slate-200 z-30 flex-shrink-0 sticky top-0">
        <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Left: Brand & Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <img 
                src="/icon.svg" 
                alt="GRAET Logo" 
                className="w-8 h-8 object-contain" 
                onError={(e) => e.currentTarget.style.display = 'none'} 
              />
              <h1 className="text-lg font-bold tracking-tight text-[#161160]">
                GRAET <span className="text-slate-400 font-light">AI</span>
              </h1>
            </div>

            <div className="h-6 w-px bg-slate-200 mx-2" />

            <nav className="flex items-center gap-1">
              <NavTab 
                label="Pulse" 
                icon={<LayoutDashboard size={18} />} 
                isActive={currentView === 'overview'} 
                onClick={() => setCurrentView('overview')} 
              />
              <NavTab 
                label="Inspector" 
                icon={<FileSearch size={18} />} 
                isActive={currentView === 'explorer' || currentView === 'transcript'} 
                onClick={() => setCurrentView('explorer')} 
              />
            </nav>
          </div>

          {/* Right: Global Actions */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 text-xs text-slate-600 font-medium">
              <FileJson size={14} className="text-slate-400" />
              <span>{conversations.length} records</span>
            </div>

            <button 
              onClick={toggleDrawer}
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border
                ${items.length > 0 
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100" 
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }
              `}
            >
              <Briefcase size={18} />
              <span>Workbench</span>
              {items.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#2B21C1] text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm border-2 border-white">
                  {items.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Content Area --- */}
      <main className="flex-1 relative overflow-hidden">
        
        {/* View: Overview (Pulse) */}
        <div className={`absolute inset-0 overflow-y-auto p-6 md:p-8 transition-opacity duration-300 ${currentView === 'overview' ? 'opacity-100 z-10' : 'opacity-0 -z-10 pointer-events-none'}`}>
          <div className="max-w-[1600px] mx-auto">
            <Overview 
              data={conversations} 
              onDrillDown={handleDrillDown}
              // Pass global date state down
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          </div>
        </div>

        {/* View: Explorer (Inspector) */}
        <div className={`absolute inset-0 overflow-y-auto p-6 md:p-8 transition-opacity duration-300 ${currentView === 'explorer' ? 'opacity-100 z-10' : 'opacity-0 -z-10 pointer-events-none'}`}>
          <div className="max-w-[1600px] mx-auto h-full">
            <ConversationExplorer 
              data={conversations} 
              onSelect={handleSelectConversation} 
              initialFilters={activeFilters} 
              onClearFilters={() => setActiveFilters({})}
              onBack={() => setCurrentView('overview')}
              // Pass global date state down for default filtering
              globalDateRange={dateRange}
            />
          </div>
        </div>

        {/* View: Transcript (Overlay) */}
        {currentView === 'transcript' && selectedConversationId && (
          <div className="absolute inset-0 bg-slate-50 z-20 p-6 md:p-8 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="max-w-[1600px] mx-auto h-full">
              <TranscriptViewer 
                conversation={conversations.find(c => c.conversation_id === selectedConversationId)!} 
                onBack={() => setCurrentView('explorer')} 
              />
            </div>
          </div>
        )}
      </main>

      {/* --- Global Components --- */}
      <WorkbenchDrawer allConversations={conversations} />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-[#161160] text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-indigo-500/30">
            <div className="bg-emerald-500 rounded-full p-0.5">
              <CheckCircle2 size={14} className="text-[#161160]" />
            </div>
            <span className="text-sm font-medium pr-1">{notification}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function EvalsPage() {
  return (
    <WorkbenchProvider>
      <EvalsContent />
    </WorkbenchProvider>
  );
}

// --- Sub-Components ---

const NavTab = ({ label, icon, isActive, onClick }: { label: string, icon: React.ReactNode, isActive: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
      ${isActive 
        ? "bg-[#2B21C1] text-white shadow-md shadow-indigo-500/20" 
        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      }
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
);