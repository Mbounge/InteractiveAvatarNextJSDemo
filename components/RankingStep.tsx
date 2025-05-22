// src/app/components/RankingStep.tsx
'use client';

import { useState, useEffect } from 'react';
import { LogoHeader } from './LogoHeader';
import { ShortlistTable } from './ShortlistTable';
import { ArrowLeft, RefreshCw } from 'lucide-react'; // Import icons
import type { Player } from '../app/lib/types'

interface Props {
  year: number;
  position: 'G' | 'D' | 'F';
  onBack: () => void;
}

const PLAYERS_TO_REQUEST = 50;

export const RankingStep: React.FC<Props> = ({ year, position, onBack }) => {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_SHORTLIST_API_KEY;

  const local = "http://localhost:8001/shortlist"

  const fetchShortlist = async () => {
    setIsLoading(true);
    setError(null);
    setPlayers(null);

    try {
      const response = await fetch(local, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birth_year: year,
          position: position,
          top_n: PLAYERS_TO_REQUEST,
        }),
      });

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorDetail = errorData.detail;
          }
        } catch (jsonError) {
          // Ignore if response body is not JSON
        }
        throw new Error(errorDetail);
      }

      const data: Player[] = await response.json();
      setPlayers(data);
    } catch (err) {
      console.error("Failed to fetch shortlist:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShortlist();
  }, [year, position]);

  const positionFullName = position === 'G' ? 'Goalies' : position === 'D' ? 'Defenders' : 'Forwards';
  const positionColor = position === 'G' ? 'bg-blue-50 text-blue-800' : 
                        position === 'D' ? 'bg-green-50 text-green-800' : 
                        'bg-purple-50 text-purple-800';
  const tableTitle = `Top ${players ? players.length : 0} Ranked ${positionFullName}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white w-3/4">
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center gap-8 px-6 py-10">
        <LogoHeader />
        
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4">
          <button
            className="flex items-center gap-2 text-[#0e0c66] hover:text-purple-800 font-medium transition-colors duration-200 group"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" />
            <span>Back to Filters</span>
          </button>
          
          <button 
            onClick={fetchShortlist}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>

        <div className="w-full text-center mb-2">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Player Shortlist
          </h1>
          
          <div className="flex flex-wrap justify-center items-center gap-3 mb-8">
            <div className="px-4 py-2 rounded-full bg-gray-100 text-gray-800 font-medium shadow-sm">
              Birth Year: {year}
            </div>
            <div className={`px-4 py-2 rounded-full font-medium shadow-sm ${positionColor}`}>
              {positionFullName}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="w-full py-16 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-t-indigo-600 border-r-indigo-300 border-b-indigo-600 border-l-indigo-300 rounded-full animate-spin mb-4"></div>
            <p className="text-lg text-gray-600 font-medium">Loading players data...</p>
          </div>
        ) : error ? (
          <div className="w-full text-center py-8 px-6 bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-sm">
            <p className="text-lg font-semibold mb-2">Error loading data</p>
            <p className="text-sm">{error}</p>
            <button 
              onClick={fetchShortlist}
              className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors duration-200 font-medium flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        ) : !players || players.length === 0 ? (
          <div className="w-full text-center py-16 px-6 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xl font-medium text-gray-400">No players found matching the criteria</p>
          </div>
        ) : (
          <div className="w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-[#0e0c66] to-purple-800 text-white">
              <h2 className="text-xl font-bold">{tableTitle}</h2>
              
            </div>
            <ShortlistTable
              players={players}
              positionGroup={position}
              title={tableTitle}
            />
          </div>
        )}
      </div>
    </div>
  );
};



