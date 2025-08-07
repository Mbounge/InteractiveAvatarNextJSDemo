//app/report/page.tsx

"use client";

import React, { useState } from 'react';
import ReportAccess from '@/components/AccessReport';
import ScoutingPlatform from '@/components/ScoutingReport';
import ReportDashboard from '@/components/ReportDashboard';
import { isValidAccessCode } from '../lib/accessCodes';

const ReportPage: React.FC = () => {
  // State to hold the validated access code after login.
  const [accessCode, setAccessCode] = useState<string | null>(null);
  
  // State for the login form.
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // This is the key state for controlling the view.
  // undefined: Show dashboard.
  // null: Show editor for a NEW report.
  // string: Show editor for an EXISTING report with this ID.
  const [selectedReportId, setSelectedReportId] = useState<string | null | undefined>(undefined);

  // --- NEW: State to hold the type of the report being created/edited ---
  const [reportType, setReportType] = useState<'skater' | 'goalie'>('skater');

  const handleCodeSubmit = (code: string) => {
    setIsLoading(true);
    setError(null);

    // Simulate a network delay for better UX
    setTimeout(() => {
      if (isValidAccessCode(code)) {
        setAccessCode(code);
      } else {
        setError('Invalid access code. Please try again.');
      }
      setIsLoading(false);
    }, 500);
  };

  const handleSelectReport = (reportId: string | null, type: 'skater' | 'goalie' = 'skater') => {
    setSelectedReportId(reportId);
    if (reportId === null) {
      setReportType(type);
    }
  };

  const handleBackToDashboard = () => {
    setSelectedReportId(undefined); 
  };

  if (accessCode) {
    if (typeof selectedReportId === 'undefined') {
      return <ReportDashboard accessCode={accessCode} onSelectReport={handleSelectReport} />;
    }
    
    return (
      <ScoutingPlatform 
        accessCode={accessCode}
        reportId={selectedReportId} // Pass the ID (or null) down
        reportType={reportType}
        onBackToDashboard={handleBackToDashboard} // Pass the back function down
      />
    );
  }

  return (
    <ReportAccess 
      onCodeSubmit={handleCodeSubmit} 
      isLoading={isLoading} 
      error={error} 
    />
  );
};

export default ReportPage;