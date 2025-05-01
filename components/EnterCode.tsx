'use client';

import React from 'react';
import { LogoHeader } from './LogoHeader';

interface Props {
  code: string;
  onChange: (c: string) => void;
  onContinue: () => void;
}

export const EnterCode: React.FC<Props> = ({ code, onChange, onContinue }) => {
  return (
    <div className="flex flex-col items-center space-y-6">
      <LogoHeader />
      <h2 className="text-2xl font-bold text-center text-gray-800">
        Enter Verification Code
      </h2>
      <p className="text-sm text-gray-600 text-center">
        Check your email and enter the 6-digit code.
      </p>

      <input
        type="text"
        value={code}
        onChange={(e) => onChange(e.target.value)}
        placeholder="123456"
        className="w-full rounded-2xl border border-[#0e0c66] p-4 text-center text-lg focus:ring-2 focus:ring-[#0e0c66] focus:outline-none"
        maxLength={6}
      />

      <button
        onClick={onContinue}
        disabled={code.length !== 6}
        className="w-full rounded-2xl bg-[#0e0c66] py-3 text-lg font-semibold text-white hover:bg-blue-700 hover:cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  );
};



