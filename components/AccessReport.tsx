"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import logo2 from '../public/Graet_Logo.svg';
import { ArrowRight, KeyRound } from 'lucide-react';

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={`animate-spin h-5 w-5 text-white ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

type ReportAccessProps = {
  onCodeSubmit: (code: string) => void;
  isLoading: boolean;
  error: string | null;
};

const ReportAccess: React.FC<ReportAccessProps> = ({ onCodeSubmit, isLoading, error }) => {
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onCodeSubmit(code.trim());
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-sans">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
        <div className="flex justify-center">
          <Image src={logo2} alt="GRAET Logo" width={150} priority />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Report Access</h2>
          <p className="mt-2 text-sm text-gray-600">Please enter your access code to continue.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="access-code"
              name="access-code"
              type="text"
              autoComplete="off"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e0c66] focus:border-transparent"
              placeholder="Your Access Code"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
          <div>
            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#0e0c66] hover:bg-[#0e0c66]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0e0c66] disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Spinner />
              ) : (
                <>
                  <span>Grant Access</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportAccess;