// src/components/CaixaRapido/CaixaModal.tsx
import React, { useState, useEffect } from 'react';
import Modal from '../Shared/Modal';
import { CheckCircle, Lock, Unlock } from 'lucide-react';
import { useCaixa } from '../../contexts/CaixaContext';

// Props específicas para a tela de PDV
interface CaixaModalProps {
  isOpen: boolean;
  isClosing: boolean; // True = Fechar Caixa, False = Abrir Caixa
  onClose: () => void;
  // Opcionais para compatibilidade com o outro uso (sangria/suprimento)
  type?: string; 
  onSubmit?: (val: number, obs?: string) => void;
}

export const CaixaModal: React.FC<CaixaModalProps> = ({
  isOpen,
  isClosing,
  onClose
}) => {
  const { abrirCaixa, fecharCaixa, caixaSession } = useCaixa();
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setValor('');
        setLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum < 0) return;

    setLoading(true);
    try {
        if (isClosing) {
            await fecharCaixa(valorNum);
        } else {
            await abrirCaixa(valorNum);
        }
        onClose(); // Fecha o modal após sucesso
    } catch (error) {
        console.error(error);
        // O toast de erro já vem do contexto, mas mantemos o modal aberto
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  const config = isClosing ? {
      title: 'Fechar Caixa',
      icon: Lock,
      bgIcon: 'bg-slate-100',
      color: 'text-slate-600',
      desc: 'Informe o valor total presente na gaveta para conferência.',
      btn: 'Confirmar Fechamento',
      btnColor: 'bg-slate-800 hover:bg-slate-900'
  } : {
      title: 'Abrir Caixa',
      icon: Unlock,
      bgIcon: 'bg-indigo-100',
      color: 'text-indigo-600',
      desc: 'Informe o fundo de troco inicial para começar as vendas.',
      btn: 'Confirmar Abertura',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700'
  };

  const Icon = config.icon;

  const footer = (
    <div className="grid grid-cols-2 gap-3 w-full">
        <button onClick={onClose} disabled={loading} className="px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Cancelar</button>
        <button 
            onClick={() => handleSubmit()} 
            disabled={loading}
            className={`px-4 py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-70 ${config.btnColor}`}
        >
            <CheckCircle size={18} />
            {loading ? 'Processando...' : config.btn}
        </button>
    </div>
  );

  return (
    <Modal title="" onClose={onClose} footer={footer} maxWidth="max-w-md">
        <div className="pt-2 pb-4 text-center px-4">
             <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${config.bgIcon}`}>
                <Icon size={32} className={config.color} />
             </div>
             <h2 className="text-2xl font-bold text-slate-900 mb-2">{config.title}</h2>
             <p className="text-slate-500 text-sm mb-6">{config.desc}</p>
             
             {isClosing && caixaSession && (
                <div className="bg-blue-50 p-3 rounded-xl mb-4 text-xs text-blue-800 font-medium">
                    Aberto em: {new Date(caixaSession.data_abertura).toLocaleTimeString()}
                </div>
             )}

             <div className="relative text-left">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Valor (R$)</label>
                <input 
                    type="number" 
                    step="0.01" 
                    autoFocus
                    placeholder="0,00"
                    className="w-full pl-4 pr-4 py-4 text-2xl font-bold text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
             </div>
        </div>
    </Modal>
  );
};