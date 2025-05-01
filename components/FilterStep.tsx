'use client';

import React from 'react';
import { LogoHeader } from './LogoHeader';

interface Props {
  year: number;
  position: 'G' | 'D' | 'F';
  onYearSelect: (y: number) => void;
  onPositionSelect: (p: 'G' | 'D' | 'F') => void;
  onContinue: () => void;
}

const YEAR_OPTIONS = [
  { label: '2011', value: 2011 },
  { label: '2010', value: 2010 },
  { label: '2009', value: 2009 },
  { label: '2008', value: 2008 },
  { label: '2007', value: 2007 },
  { label: '2006', value: 2006 },
  { label: '2005', value: 2005 },
  { label: '2004+', value: 2004 },
] as const;

const POSITION_OPTIONS = [
  { label: 'Forward',  value: 'F' },
  { label: 'Defender', value: 'D' },
  { label: 'Goalie',   value: 'G' },
] as const;

export const FilterStep: React.FC<Props> = ({
  year,
  position,
  onYearSelect,
  onPositionSelect,
  onContinue,
}) => (
  <div className="w-full max-w-2xl mx-auto flex flex-col gap-8">
    <LogoHeader />

    <h1 className="text-5xl font-medium text-center">Select YOB & Position</h1>

    {/* Year of Birth */}
    <div>
      <p className="mb-4 text-sm font-semibold text-gray-700">Select Year of Birth</p>
      <div className="grid grid-cols-4 gap-4 justify-items-center">
        {YEAR_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onYearSelect(value)}
            className={`px-5 py-2 rounded-full border transition ${
              year === value
                ? 'bg-[#0e0c66] text-white hover:bg-blue-700 hover:cursor-pointer'
                : 'bg-gray-200 text-gray-800 border-transparent hover:bg-gray-300 hover:cursor-pointer'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    <hr className="border-gray-300" />

    {/* Position */}
    <div>
      <p className="mb-4 text-sm font-semibold text-gray-700">Select Position</p>
      <div className="flex justify-center gap-4">
        {POSITION_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onPositionSelect(value)}
            className={`px-6 py-2 rounded-full border transition ${
              position === value
                ? 'bg-[#0e0c66] text-white hover:bg-blue-700  hover:cursor-pointer'
                : 'bg-gray-200 text-gray-800 border-transparent hover:bg-gray-300 hover:cursor-pointer'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    {/* Continue */}
    <div className="flex justify-center">
      <button
        onClick={onContinue}
        className="mt-6 bg-[#0e0c66] hover:bg-blue-700 hover:cursor-pointer text-white font-semibold px-8 py-2 rounded-full shadow"
      >
        Continue
      </button>
    </div>
  </div>
);




