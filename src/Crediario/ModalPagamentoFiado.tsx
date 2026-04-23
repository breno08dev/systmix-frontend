import React, { useState } from 'react';
// Importamos o ItemComanda e adicionamos o /index para forçar o TS a achar o arquivo
import { Comanda, ItemComanda } from '../types/index'; 
import { crediarioService } from '../services/crediario';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import Modal from '../components/Shared/Modal';
import { Banknote, CreditCard, QrCode } from 'lucide-react';

interface Props {
  comanda: Comanda;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ModalPagamentoFiado: React.FC<Props> = ({ comanda, isOpen, onClose, onConfirm }) => {
  const [metodo, setMetodo] = useState<string>('DINHEIRO');
  const [loading, setLoading] = useState(false);
  const { isOnline } = useOnlineStatus();

  if (!isOpen) return null;

  const totalComanda = comanda.itens?.reduce((sum: number, item: ItemComanda) => sum + (item.quantidade * item.valor_unit), 0) || 0;
  
  const BRL = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

  const handlePagar = async () => {
    setLoading(true);
    try {
      // CORREÇÃO INFALÍVEL: Enviamos o método com a etiqueta FIADO_
      await crediarioService.pagarFiado(isOnline, comanda.id, [{ metodo: `FIADO_${metodo}`, valor: totalComanda }]);
      onConfirm();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Receber Pagamento do Fiado">
      <div className="p-4 space-y-6">
        
        <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500 font-medium">Cliente</p>
          <p className="text-xl font-bold text-slate-800">{comanda.cliente?.nome}</p>
          <p className="text-sm text-slate-500 mt-3 font-medium">Valor a Receber</p>
          <p className="text-4xl font-black text-rose-600">{BRL(totalComanda)}</p>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-700 mb-3">Forma de Pagamento:</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { id: 'PIX', label: 'PIX', icon: QrCode, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
              { id: 'CARTAO', label: 'Cartão', icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setMetodo(m.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  metodo === m.id 
                  ? `${m.border} ${m.bg} shadow-sm ring-2 ring-offset-1 ring-${m.color.split('-')[1]}-500` 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                }`}
              >
                <m.icon size={28} className={metodo === m.id ? m.color : 'text-slate-400'} />
                <span className={`font-bold text-sm ${metodo === m.id ? 'text-slate-800' : ''}`}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handlePagar}
            disabled={loading}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </Modal>
  );
};