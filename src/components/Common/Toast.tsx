import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const toastConfig = {
  success: {
    icon: CheckCircle,
    bgClass: 'bg-green-600',
  },
  error: {
    icon: AlertTriangle,
    bgClass: 'bg-red-600',
  },
};

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const { icon: Icon, bgClass } = toastConfig[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // A notificação desaparece após 5 segundos

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div className={`flex items-center text-white p-4 rounded-lg shadow-lg ${bgClass} animate-fade-in-right`}>
      <Icon className="w-6 h-6 mr-3" />
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="ml-4 p-1 rounded-full hover:bg-white/20">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};