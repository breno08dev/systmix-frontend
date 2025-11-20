// src/components/CaixaRapido/CaixaModal.tsx
import React, { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { useCaixa } from '../../contexts/CaixaContext';

interface CaixaModalProps {
  isClosing: boolean;
  onClose: () => void;
}

export const CaixaModal: React.FC<CaixaModalProps> = ({ isClosing, onClose }) => {
  const { caixaSession, abrirCaixa, fecharCaixa } = useCaixa();
  const [valor, setValor] = useState(0); 
  const [carregando, setCarregando] = useState(false);

  const valorInicial = isClosing ? (caixaSession?.valor_inicial || 0) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);

    if (valor <= 0 && !isClosing) {
      alert('O valor de abertura deve ser positivo.');
      setCarregando(false);
      return;
    }

    if (isClosing) {
      // FECHAMENTO: O valor (valor contado) é passado para a função que o salva no DB.
      fecharCaixa(valor);
    } else {
      // ABERTURA
      abrirCaixa(valor);
    }

    setCarregando(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {isClosing ? 'Fechar Caixa' : 'Abrir Caixa'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" disabled={carregando}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isClosing && caixaSession && (
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
              
              {/* EXIBIÇÃO: Horário de Abertura */}
              <p className="font-bold">Aberto em: {new Date(caixaSession.data_abertura).toLocaleString('pt-BR')}</p>
              
              {/* EXIBIÇÃO: Valor de Abertura */}
              <p className="font-bold mt-2">Valor de Abertura: R$ {valorInicial.toFixed(2)}</p>
              
              {/* Vendas do Dia e Previsto foram removidos para a simplificação. */}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {/* Rótulo para o valor a ser salvo no banco */}
              {isClosing ? 'Valor Contado em Caixa' : 'Valor Inicial de Troco'} (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(parseFloat(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-secondary"
              required
              disabled={carregando}
            />
          </div>

          <button
            type="submit"
            className={`w-full py-3 text-white rounded-lg font-medium transition-colors ${
              isClosing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
            disabled={carregando}
          >
            {carregando
              ? 'Processando...'
              : isClosing
              ? 'Confirmar Fechamento'
              : 'Confirmar Abertura'}
          </button>
        </form>
      </div>
    </div>
  );
};