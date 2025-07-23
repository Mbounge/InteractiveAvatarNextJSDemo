"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Loader2, Search, Clock, User, Users, Calendar, TrendingUp } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { showToast } from './CustomToast';
import Image from 'next/image';
import logo2 from "../public/Graet_Logo.svg"

// A lightweight type for the report data we'll show in the list.
interface ReportSummary {
  _id: string;
  playerContext: {
    name: string;
    currentTeam?: { name: string };
  };
  updatedAt: string;
}

// The props our dashboard needs to function.
interface ReportDashboardProps {
  accessCode: string; // To know who is logged in.
  onSelectReport: (reportId: string | null) => void; // To tell the parent page what to do next.
}

const ReportDashboard: React.FC<ReportDashboardProps> = ({ accessCode, onSelectReport }) => {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredReports, setFilteredReports] = useState<ReportSummary[]>([]);
  
  // --- NEW STATE for inline delete confirmation ---
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filter reports based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredReports(reports);
    } else {
      const filtered = reports.filter(report => 
        report.playerContext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (report.playerContext.currentTeam?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredReports(filtered);
    }
  }, [reports, searchQuery]);

  // This function fetches the list of reports from our new API.
  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/reports', {
        headers: { 'X-Scout-Identifier': accessCode }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch reports from the server.');
      }
      const data = await response.json();
      setReports(data);
    } catch (error) {
      toast.error('Could not load your reports.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [accessCode]);

  // --- NEW: Cleanup timeout on component unmount ---
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // --- MODIFIED: This function now INITIATES the delete confirmation ---
  const handleInitiateDelete = (reportId: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setConfirmingDeleteId(reportId);
    // Automatically cancel after 5 seconds
    timeoutRef.current = setTimeout(() => {
      setConfirmingDeleteId(null);
    }, 5000);
  };

  // --- NEW: This function cancels the confirmation ---
  const cancelDelete = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setConfirmingDeleteId(null);
  };

  // --- NEW: This function EXECUTES the deletion after confirmation ---
  const executeDelete = async (reportId: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const toastId = showToast('Deleting report...', 'loading');
    
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'X-Scout-Identifier': accessCode }
      });

      if (!response.ok) throw new Error('Failed to delete');
     
      showToast('Report deleted!', 'success', { id: toastId });
      setReports(prev => prev.filter(r => r._id !== reportId));
    } catch (error) {
      
      showToast('Could not delete report.', 'error', { id: toastId });
    } finally {
      setConfirmingDeleteId(null); // Reset confirmation state
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getRecentReports = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return reports.filter(report => new Date(report.updatedAt) > oneWeekAgo).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Toaster position="top-center" />
      
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-6">
              <Image src={logo2} alt="GRAET Logo" width={120} priority />
              <div className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
              <div className="hidden sm:block">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Scouting Reports
                </h1>
              </div>
            </div>
            <button
              onClick={() => onSelectReport(null)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0e0c66] text-white font-semibold rounded-lg shadow-md hover:bg-[#0e0c66]/90 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="w-5 h-5" />
              Create New Report
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isLoading && reports.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Reports</p>
                  <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Recent Activity</p>
                  <p className="text-2xl font-bold text-gray-900">{getRecentReports()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">This Week</p>
                  <p className="text-2xl font-bold text-gray-900">{getRecentReports()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              My Reports
            </h2>
            <p className="text-gray-600 mt-1">
              {isLoading ? 'Loading...' : `${filteredReports.length} of ${reports.length} reports shown`}
            </p>
          </div>
          
          {!isLoading && reports.length > 0 && (
            <div className="relative w-full sm:w-80">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search players or teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm placeholder-gray-500"
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
            <p className="text-gray-600 text-lg">Loading your reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center bg-white/60 backdrop-blur-sm p-16 rounded-2xl shadow-sm border border-white/50">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No reports yet</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start building your repository of scouting reports.
            </p>
            <button
              onClick={() => onSelectReport(null)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0e0c66] text-white font-semibold rounded-lg shadow-md hover:bg-[#0e0c66]/90 transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="w-5 h-5" />
              Create Your First Report
            </button>
          </div>
        ) : (
          <div>
            {filteredReports.length === 0 && searchQuery ? (
              <div className="text-center bg-white/60 backdrop-blur-sm p-12 rounded-2xl shadow-sm">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600">Your search for "{searchQuery}" didn't match any reports.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredReports.map((report) => (
                  <div
                    key={report._id}
                    className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm border border-white/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-7 h-7 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-gray-900 text-lg truncate">
                            {report.playerContext.name}
                          </h3>
                          <p className="text-sm text-gray-600 truncate flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {report.playerContext.currentTeam?.name || 'Free Agent'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 bg-gray-50/50 rounded-lg px-3 py-2">
                        <Clock className="w-4 h-4" />
                        <span>Updated {formatDate(report.updatedAt)}</span>
                      </div>

                      {/* --- NEW: Conditional Actions Block --- */}
                      <div className="flex gap-3">
                        {confirmingDeleteId === report._id ? (
                          <>
                            <button
                              onClick={() => executeDelete(report._id)}
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all duration-200"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={cancelDelete}
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all duration-200"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onSelectReport(report._id)}
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 font-semibold rounded-xl hover:from-indigo-100 hover:to-blue-100 transition-all duration-200 group-hover:shadow-sm border border-indigo-200"
                            >
                              <Edit className="w-4 h-4" />
                              Edit Report
                            </button>
                            <button
                              onClick={() => handleInitiateDelete(report._id)}
                              className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 border border-transparent hover:border-red-200"
                              title="Delete Report"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ReportDashboard;