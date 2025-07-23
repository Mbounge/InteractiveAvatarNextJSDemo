// app/lib/customToast.tsx

"use client";

import React from 'react';
import { toast, Toast } from 'react-hot-toast';
import { Loader2, CheckCircle, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'loading' | 'info';

// This is the component that will be rendered inside the toast
const CustomToast: React.FC<{ t: Toast; type: ToastType; message: string }> = ({ t, type, message }) => {
  
  const getIcon = () => {
    switch (type) {
      case 'loading':
        return <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default: // for 'info'
        return null; 
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-emerald-700';
      case 'error':
        return 'text-red-700';
      default: // for 'loading' and 'info'
        return 'text-gray-700';
    }
  };

  return (
    // This div handles the enter/leave animations
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full pointer-events-auto`}
    >
      {/* This is the main styled container, mimicking ProcessStatus */}
      <div className="w-full bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-xl shadow-lg p-4 flex items-center gap-3">
        {/* Icon */}
        {getIcon() && <div className="flex-shrink-0">{getIcon()}</div>}
        
        {/* Message */}
        <p className={`flex-1 text-sm font-medium ${getTextColor()}`}>
          {message}
        </p>

        {/* Close Button */}
        {t.type !== 'loading' && (
          <button
            onClick={() => toast.dismiss(t.id)}
            className="p-1.5 rounded-full hover:bg-gray-500/10 transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
};

// This is the helper function we will call from our components
export const showToast = (
  message: string,
  type: ToastType = 'info',
  options?: { id?: string; duration?: number }
) => {
  // For loading toasts, we want them to persist until manually dismissed or updated
  const duration = type === 'loading' ? Infinity : options?.duration || 4000;

  return toast.custom(
    (t) => <CustomToast t={t} type={type} message={message} />,
    { ...options, duration }
  );
};