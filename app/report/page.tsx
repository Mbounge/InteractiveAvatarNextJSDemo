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
        // On successful login, we set the access code, which will trigger the view to change.
        setAccessCode(code);
      } else {
        setError('Invalid access code. Please try again.');
      }
      setIsLoading(false);
    }, 500);
  };

  // --- MODIFIED: This function now accepts the reportType from the dashboard modal ---
  const handleSelectReport = (reportId: string | null, type: 'skater' | 'goalie' = 'skater') => {
    setSelectedReportId(reportId);
    // If it's a new report (id is null), we set the type from the modal selection.
    // If editing an existing report, the type will be loaded from the DB, but we default to 'skater'.
    if (reportId === null) {
      setReportType(type);
    }
  };

  // This function is passed down to the Scouting Platform.
  // It allows the user to get back to the dashboard view.
  const handleBackToDashboard = () => {
    setSelectedReportId(undefined); 
  };

  // --- RENDER LOGIC ---

  // 1. If we have a validated access code...
  if (accessCode) {
    // ...and the user has NOT selected a report to view/edit yet...
    if (typeof selectedReportId === 'undefined') {
      // ...show the Dashboard.
      return <ReportDashboard accessCode={accessCode} onSelectReport={handleSelectReport} />;
    }
    
    // ...but if the user HAS selected a report (new or existing)...
    // ...show the Scouting Platform.
    return (
      <ScoutingPlatform 
        accessCode={accessCode}
        reportId={selectedReportId} // Pass the ID (or null) down
        // --- NEW: Pass the reportType down ---
        reportType={reportType}
        onBackToDashboard={handleBackToDashboard} // Pass the back function down
      />
    );
  }

  // 2. If we don't have an access code, show the login page.
  return (
    <ReportAccess 
      onCodeSubmit={handleCodeSubmit} 
      isLoading={isLoading} 
      error={error} 
    />
  );
};

export default ReportPage;