// src/components/ConnectButton.tsx (or your chosen path)
'use client';

import {
  useRTVIClient,
  useRTVIClientTransportState,
} from '@pipecat-ai/client-react';
import { LoaderCircle, Phone, PhoneOff } from 'lucide-react'; // Import icons

export function ConnectButton() {
  const client = useRTVIClient();
  const transportState = useRTVIClientTransportState();

  const isConnecting = transportState === 'connecting';
  const isDisconnecting = transportState === 'disconnecting';
  const isConnected = transportState === 'connected' || transportState === 'ready';
  const isDisabled = !client || isConnecting || isDisconnecting;

  const handleClick = async () => {
    if (!client || isDisabled) {
      console.error('RTVI client not ready or action in progress');
      return;
    }

    try {
      if (isConnected) {
        console.log('Disconnecting...');
        await client.disconnect();
      } else {
        console.log('Connecting...');
        await client.connect();
      }
    } catch (error) {
      console.error('Connection/Disconnection error:', error);
      // Add user feedback here (e.g., toast notification)
    }
  };

  const getButtonText = () => {
    if (isConnecting) return 'Connecting...';
    if (isDisconnecting) return 'Disconnecting...';
    if (isConnected) return 'End Session';
    return 'Start Session';
  };

  const getButtonIcon = () => {
    if (isConnecting || isDisconnecting) {
      return <LoaderCircle className="w-4 h-4 animate-spin" />;
    }
    if (isConnected) {
      return <PhoneOff className="w-4 h-4" />;
    }
    return <Phone className="w-4 h-4" />;
  };

  const baseClasses =
    'flex items-center justify-center gap-2 px-5 py-2 rounded-full font-semibold text-white shadow-sm transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

  const colorClasses = isConnected
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    : 'bg-green-600 hover:bg-green-700 focus:ring-green-500';

  return (
    <button
      className={`${baseClasses} ${colorClasses}`}
      onClick={handleClick}
      disabled={isDisabled}
    >
      {getButtonIcon()}
      <span>{getButtonText()}</span>
    </button>
  );
}