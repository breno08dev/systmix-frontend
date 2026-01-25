// src/components/Shared/Modal.tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  maxWidth?: string; // Permite ajustar a largura se necessário (ex: 'max-w-2xl')
}

const Modal: React.FC<ModalProps> = ({ 
    title, 
    children, 
    onClose, 
    footer,
    maxWidth = 'max-w-lg' // Padrão elegante
}) => {
  // Fecha ao pressionar ESC
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Previne scroll do body quando o modal está aberto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      {/* Backdrop com Blur e animação de fade */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-[fade-in_0.2s_ease-out]" 
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Container do Modal com animação de zoom/scale */}
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full ${maxWidth} mx-auto h-auto max-h-[90vh] flex flex-col overflow-hidden transform animate-[zoom-in-95_0.3s_ease-out]`}>
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white z-10 sticky top-0">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Fechar"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>

        {/* Rodapé opcional (Sticky bottom) */}
        {footer && (
          <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 sticky bottom-0 z-10 rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;