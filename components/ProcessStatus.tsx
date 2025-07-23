"use client";

import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface ProcessStatusProps {
  status: 'idle' | 'transcribing' | 'generating' | 'success' | 'error';
  message: string;
}

const ProcessStatus: React.FC<ProcessStatusProps> = ({ status, message }) => {
  if (status === 'idle') {
    return null; // Don't render anything when idle
  }

  const getIcon = () => {
    switch (status) {
      case 'transcribing':
      case 'generating':
        return <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case 'success':
        return 'text-emerald-700';
      case 'error':
        return 'text-red-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="w-full bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-xl p-4 flex items-center gap-3 transition-all duration-300">
      <div className="flex-shrink-0">
        {getIcon()}
      </div>
      <p className={`text-sm font-medium ${getTextColor()}`}>
        {message}
      </p>
    </div>
  );
};

export default ProcessStatus;