// src/components/StatusDisplay.tsx (or your chosen path)
'use client';

import { useRTVIClientTransportState } from '@pipecat-ai/client-react';
import { Wifi, WifiOff, LoaderCircle } from 'lucide-react'; // Import icons

export function StatusDisplay() {
  const transportState = useRTVIClientTransportState();

  const getStatusInfo = (): { text: string; color: string; icon: JSX.Element } => {
    switch (transportState) {
      case 'connecting':
        return { text: 'Connecting', color: 'bg-yellow-100 text-yellow-700 animate-pulse', icon: <LoaderCircle className="w-4 h-4 animate-spin" /> };
      case 'connected':
      case 'ready': // Treat ready same as connected for display
        return { text: 'Connected', color: 'bg-green-100 text-green-700', icon: <Wifi className="w-4 h-4" /> };
      case 'disconnecting':
        return { text: 'Disconnecting', color: 'bg-yellow-100 text-yellow-700 animate-pulse', icon: <LoaderCircle className="w-4 h-4 animate-spin" /> };
      case 'disconnected':
         return { text: 'Disconnected', color: 'bg-red-100 text-red-700', icon: <WifiOff className="w-4 h-4" /> };
      case 'error':
        return { text: 'Error', color: 'bg-red-100 text-red-700', icon: <WifiOff className="w-4 h-4" /> };
      default:
        return { text: 'Unknown', color: 'bg-gray-100 text-gray-600', icon: <WifiOff className="w-4 h-4" /> };
    }
  };

  const { text, color, icon } = getStatusInfo();

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
}
