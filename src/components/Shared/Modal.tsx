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
      {/* Backdrop mais escuro e imersivo (sem o slate cinza) */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-[fade-in_0.2s_ease-out]" 
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Container do Modal no Azul Marinho Escuro (#0B1426) com borda Azul Neon (#172554) */}
      <div className={`relative bg-[#0B1426] border border-[#172554] rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,1)] w-full ${maxWidth} mx-auto h-auto max-h-[90vh] flex flex-col overflow-hidden transform animate-[zoom-in-95_0.3s_ease-out]`}>
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-6 border-b border-[#172554] bg-[#0B1426] z-10 sticky top-0">
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 bg-black/40 text-gray-400 rounded-full border border-[#172554] hover:bg-rose-900/30 hover:text-rose-500 hover:border-rose-900/50 transition-all focus:outline-none"
            aria-label="Fechar"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar-dark text-gray-200">
          {children}
        </div>

        {/* Rodapé opcional (Sticky bottom) agora Preto ou Azul mais escuro */}
        {footer && (
          <div className="p-6 border-t border-[#172554] bg-black/40 flex justify-end gap-3 sticky bottom-0 z-10 rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;