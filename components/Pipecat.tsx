// src/app/advisor/page.tsx
'use client';

import React from 'react';
import {
  RTVIClientAudio,
  RTVIClientVideo,
  useRTVIClientTransportState,
} from '@pipecat-ai/client-react';

// --- Adjusted Imports ---
import { RTVIProvider } from '@/app/providers/RTVIProvider';
import { ConnectButton } from '@/components/ConnectButton'; // Use alias or adjust path
import { StatusDisplay } from '@/components/StatusDisplay'; // Use alias or adjust path
import { DebugDisplay } from '@/components/DebugDisplay';   // Use alias or adjust path
import { LogoHeader } from '@/components/LogoHeader';     // Use alias or adjust path
// -----------------------

// Component to display the User's Video Feed (Improved Styling)
function UserVideoDisplay() {
  const transportState = useRTVIClientTransportState();
  const isConnected = transportState !== 'disconnected';

  return (
    <div className="w-full max-w-lg mx-auto"> {/* Adjusted max-width */}
      <div className="relative aspect-[4/3] bg-gray-800 rounded-xl overflow-hidden shadow-lg border-2 border-gray-300">
        {/* Added aspect ratio and border */}
        {isConnected ? (
          <RTVIClientVideo
            participant="local"
            mirror
            className="absolute inset-0 w-full h-full object-cover" // Use cover for better fit
            onResize={({ aspectRatio, height, width }) => {
              console.log('User video dimensions changed:', {
                aspectRatio,
                height,
                width,
              });
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-sm font-medium">Your camera feed will appear here</p>
            <p className="text-gray-500 text-xs mt-1">Connect to start the session</p>
          </div>
        )}
         {/* Optional: Add a small indicator for mirroring */}
         {isConnected && (
            <span className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded">
                Mirrored
            </span>
         )}
      </div>
    </div>
  );
}

// Component for the top status bar (Improved Styling)
function StatusBar() {
  return (
    // Removed mb-6, padding adjusted, added gradient bg
    <div className="w-full flex flex-wrap justify-between items-center gap-4 px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
      <StatusDisplay />
      <ConnectButton />
    </div>
  );
}

// --- Main Advisor Page Component ---
export default function AdvisorPage() {
  return (
    <RTVIProvider>
      {/* Match Ranking Page background and padding */}
      <main className="min-h-[90dvh] flex flex-col items-center justify-start bg-gradient-to-b from-gray-100 to-white px-4 py-10 sm:px-6 lg:px-8">

        {/* Use a wider container like Ranking page */}
        <div className="w-full max-w-5xl">
          <LogoHeader />

          <div className="mt-8 bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100">
            {/* Status Bar */}
            <StatusBar />

            {/* Main content area */}
            <div className="p-6 md:p-8 flex flex-col items-center gap-6">
              <h1 className="text-3xl font-bold text-gray-800 text-center">
                AI Advisor
              </h1>
              
              {/* User Video Display */}
              <UserVideoDisplay />
              {/* Placeholder for Bot Video */}
              {/* <div className="mt-4 text-center text-gray-400 text-sm">[Bot Video Area Placeholder]</div> */}
            </div>

            {/* Non-visual Component */}
            <RTVIClientAudio />
          </div>

           {/* Debug Display (Collapsible, outside main card) */}
           <DebugDisplay />
        </div>
      </main>
    </RTVIProvider>
  );
}