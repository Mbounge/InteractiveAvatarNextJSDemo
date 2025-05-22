// src/components/DebugDisplay.tsx (or your chosen path)
'use client';

import React, { useRef, useCallback, useState } from 'react';
import {
  Participant,
  RTVIEvent,
  TransportState,
  TranscriptData,
  BotLLMTextData,
} from '@pipecat-ai/client-js';
import { useRTVIClient, useRTVIClientEvent } from '@pipecat-ai/client-react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'; // Import icons

export function DebugDisplay() {
  const debugLogRef = useRef<HTMLDivElement>(null);
  const client = useRTVIClient();
  const [logEntries, setLogEntries] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false); // Start closed

  const log = useCallback((message: string) => {
    const timestampedMessage = `${new Date().toISOString()} - ${message}`;
    setLogEntries((prev) => [...prev.slice(-100), timestampedMessage]); // Keep last 100 entries

    // Auto-scroll if open
    if (isOpen && debugLogRef.current) {
      // Use setTimeout to scroll after the state update renders
      setTimeout(() => {
        if (debugLogRef.current) {
           debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [isOpen]); // Depend on isOpen to trigger scroll correctly

  const clearLog = () => {
    setLogEntries([]);
  }

  // Log transport state changes
  useRTVIClientEvent(
    RTVIEvent.TransportStateChanged,
    useCallback((state: TransportState) => log(`Transport state changed: ${state}`), [log])
  );
  // Log bot connection events
  useRTVIClientEvent(RTVIEvent.BotConnected, useCallback((p?: Participant) => log(`Bot connected: ${p?.name || p?.id || 'unknown'}`), [log]));
  useRTVIClientEvent(RTVIEvent.BotDisconnected, useCallback((p?: Participant) => log(`Bot disconnected: ${p?.name || p?.id || 'unknown'}`), [log]));
  // Log track events
  useRTVIClientEvent(RTVIEvent.TrackStarted, useCallback((t: any, p: any) => log(`Track started: ${t.kind} from ${p?.name || 'unknown'}`), [log]));
  useRTVIClientEvent(RTVIEvent.TrackStopped, useCallback((t: any, p: any) => log(`Track stopped: ${t.kind} from ${p?.name || 'unknown'}`), [log]));
  // Log bot ready state
  useRTVIClientEvent(RTVIEvent.BotReady, useCallback(() => log(`Bot ready`), [log]));
  // Log transcripts
  useRTVIClientEvent(RTVIEvent.UserTranscript, useCallback((d: TranscriptData) => { if (d.final) log(`User: ${d.text}`); }, [log]));
  useRTVIClientEvent(RTVIEvent.BotTranscript, useCallback((d: BotLLMTextData) => log(`Bot: ${d.text}`), [log]));

  const getEntryStyle = (message: string): string => {
    if (message.includes('User: ')) return 'text-blue-600';
    if (message.includes('Bot: ')) return 'text-green-600';
    if (message.includes('error') || message.includes('failed')) return 'text-red-600 font-medium';
    if (message.includes('state changed:')) return 'text-purple-600';
    return 'text-gray-700';
  };

  return (
    <div className="mt-8 w-full max-w-3xl mx-auto mb-5">
      <div className="border border-gray-300 rounded-lg bg-gray-50 overflow-hidden shadow-sm">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex justify-between items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 transition text-left text-sm font-medium text-gray-700"
        >
          <span>Debug Information</span>
          <div className="flex items-center gap-2">
             {isOpen && (
               <button
                 onClick={(e) => { e.stopPropagation(); clearLog(); }}
                 title="Clear Log"
                 className="p-1 text-gray-500 hover:text-red-600"
               >
                 <Trash2 size={14} />
               </button>
             )}
             {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>
        {isOpen && (
          <div ref={debugLogRef} className="p-4 max-h-60 overflow-y-auto text-xs font-mono bg-white border-t border-gray-200">
            {logEntries.length === 0 ? (
                 <p className="text-gray-500 italic">No debug messages yet.</p>
            ) : (
                 logEntries.map((entry, index) => (
                   <p key={index} className={`mb-1 whitespace-pre-wrap ${getEntryStyle(entry)}`}>
                     {entry}
                   </p>
                 ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}