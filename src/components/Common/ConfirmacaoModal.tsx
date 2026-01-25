// src/components/Common/ConfirmacaoModal.tsx
import React from 'react';
import { AlertTriangle, CheckCircle, X, Info } from 'lucide-react';
import Modal from '../Shared/Modal'; // Certifique-se de importar seu Modal base

interface ConfirmacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  tipo?: 'perigo' | 'aviso' | 'sucesso' | 'info';
  textoConfirmar?: string;
  textoCancelar?: string;
}

export const ConfirmacaoModal: React.FC<ConfirmacaoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  tipo = 'aviso',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar'
}) => {
  if (!isOpen) return null;

  // Configuração visual baseada no tipo de alerta
  const estilos = {
    perigo: {
      bgIcon: 'bg-red-100',
      textIcon: 'text-red-600',
      btnConfirm: 'bg-red-600 hover:bg-red-700 shadow-red-500/20',
      icon: AlertTriangle
    },
    aviso: {
      bgIcon: 'bg-amber-100',
      textIcon: 'text-amber-600',
      btnConfirm: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
      icon: AlertTriangle
    },
    sucesso: {
      bgIcon: 'bg-emerald-100',
      textIcon: 'text-emerald-600',
      btnConfirm: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
      icon: CheckCircle
    },
    info: {
      bgIcon: 'bg-blue-100',
      textIcon: 'text-blue-600',
      btnConfirm: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
      icon: Info
    }
  };

  const currentStyle = estilos[tipo];
  const Icon = currentStyle.icon;

  const footer = (
    <div className="flex gap-3 w-full justify-end">
      <button
        onClick={onClose}
        className="px-5 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
      >
        {textoCancelar}
      </button>
      <button
        onClick={() => {
          onConfirm();
          onClose();
        }}
        className={`px-5 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-[0.98] flex items-center gap-2 ${currentStyle.btnConfirm}`}
      >
        {textoConfirmar}
      </button>
    </div>
  );

  return (
    <Modal
      title="" // Título vazio no header padrão para focar no conteúdo central
      onClose={onClose}
      footer={footer}
      maxWidth="max-w-sm"
    >
      <div className="text-center pt-2 pb-4 px-2">
        <div className={`mx-auto w-16 h-16 ${currentStyle.bgIcon} rounded-full flex items-center justify-center mb-5 animate-[bounce_1s_infinite]`}>
          <Icon size={32} className={currentStyle.textIcon} />
        </div>
        
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          {title}
        </h3>
        
        <p className="text-slate-500 text-sm leading-relaxed">
          {message}
        </p>
      </div>
    </Modal>
  );
};