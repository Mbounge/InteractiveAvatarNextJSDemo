"use client";

import React, { useState } from 'react';
import ReportAccess from '@/components/AccessReport';
import ScoutingPlatform from '@/components/ScoutingReport';
import { isValidAccessCode } from '../lib/accessCodes';

const ReportPage: React.FC = () => {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeSubmit = (code: string) => {
    setIsLoading(true);
    setError(null);

    // Simulate a network delay for better UX
    setTimeout(() => {
      if (isValidAccessCode(code)) {
        setHasAccess(true);
      } else {
        setError('Invalid access code. Please try again.');
      }
      setIsLoading(false);
    }, 500);
  };

  if (hasAccess) {
    return <ScoutingPlatform />;
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