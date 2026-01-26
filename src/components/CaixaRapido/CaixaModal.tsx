// src/components/CaixaRapido/CaixaModal.tsx
import React, { useState } from 'react';
import Modal from '../Shared/Modal';
import { useCaixa } from '../../contexts/CaixaContext';
import { useToast } from '../../contexts/ToastContext';
import { DollarSign, Lock, Unlock, Loader2 } from 'lucide-react';

interface CaixaModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: 'abertura' | 'fechamento';
}

export const CaixaModal: React.FC<CaixaModalProps> = ({ isOpen, onClose, tipo }) => {
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);
  const { abrirCaixa, fecharCaixa, caixaAberto } = useCaixa();
  const { addToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    // Converte vírgula para ponto e garante número
    const valorFloat = parseFloat(valor.replace(',', '.')) || 0;
    
    setLoading(true);
    
    try {
      if (tipo === 'abertura') {
        await abrirCaixa(valorFloat);
        addToast('Caixa aberto com sucesso!', 'success');
      } else {
        await fecharCaixa(valorFloat);
        addToast('Caixa fechado com sucesso!', 'success');
      }
      onClose(); // Fecha o modal apenas se sucesso
      setValor(''); // Limpa o campo
    } catch (error: any) {
      console.error(error);
      addToast(error.message || `Erro ao ${tipo} caixa.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isAbertura = tipo === 'abertura';
  const saldoSistema = Number(caixaAberto?.saldo_atual || 0);

  const footer = (
    <>
      <button 
        onClick={onClose} 
        disabled={loading}
        className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Cancelar
      </button>
      <button 
        onClick={handleSubmit}
        disabled={loading}
        className={`px-4 py-2 text-white font-bold rounded-lg flex items-center gap-2 transition-colors ${
            isAbertura ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
        }`}
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : (isAbertura ? <Unlock size={18} /> : <Lock size={18} />)}
        {isAbertura ? 'Confirmar Abertura' : 'Confirmar Fechamento'}
      </button>
    </>
  );

  return (
    <Modal
      title={isAbertura ? 'Abertura de Caixa' : 'Fechamento de Caixa'}
      onClose={onClose}
      footer={footer}
      maxWidth="max-w-sm"
    >
      <div className="space-y-4">
        {!isAbertura && (
            <div className="p-3 bg-slate-100 rounded-lg flex justify-between items-center text-sm">
                <span className="text-slate-500">Abertura de Caixa:</span>
                <span className="font-bold text-slate-800">R$ {saldoSistema.toFixed(2)}</span>
            </div>
        )}

        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
                {isAbertura ? 'Valor Inicial (Fundo de Troco)' : 'Valor Final (Contagem)'}
            </label>
            <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-lg font-medium outline-none transition-all"
                    placeholder="0.00"
                    autoFocus
                    disabled={loading}
                />
            </div>
            {!isAbertura && (
                <p className="text-xs text-slate-400 mt-2">
                    Insira o valor total em dinheiro que está na gaveta.
                </p>
            )}
        </div>
      </div>
    </Modal>
  );
};