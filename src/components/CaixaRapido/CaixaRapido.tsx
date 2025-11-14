// src/components/CaixaRapido/CaixaRapido.tsx
import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Plus } from 'lucide-react';
import { useCaixa } from '../../contexts/CaixaContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { produtosService } from '../../services/produtos';
import { Produto } from '../../types';
import { CaixaModal } from './CaixaModal';

export const CaixaRapido: React.FC = () => {
  const { isOnline } = useOnlineStatus();
  const { caixaAberto, caixaSession } = useCaixa();
  
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosNoCarrinho, setProdutosNoCarrinho] = useState<Produto[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    produtosService.listarAtivos(isOnline).then(setProdutos).catch(console.error);
  }, [isOnline]);

  const totalCarrinho = produtosNoCarrinho.reduce((sum, p) => sum + p.preco, 0);

  const handleAdicionarProduto = (produto: Produto) => {
    setProdutosNoCarrinho(prev => [...prev, produto]);
  };

  const handleRemoverProduto = (index: number) => {
    setProdutosNoCarrinho(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinalizarVenda = () => {
    // Lógica para venda rápida (simulada)
    if (produtosNoCarrinho.length === 0) return;
    
    // TODO: AQUI É ONDE VOCÊ CHAMARIA O SERVIÇO 'comandasService.criarVendaRapida'
    // A chamada faria: criar comanda temporária, adicionar itens, fechar comanda com pagamento.
    
    setProdutosNoCarrinho([]);
    alert(`Venda Rápida de R$ ${totalCarrinho.toFixed(2)} registrada!`);
  };

  const handleAbrirModal = (closing: boolean) => {
    setIsClosing(closing);
    setModalAberto(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Caixa Rápido</h1>
          <p className="text-gray-600">Vendas rápidas e gestão de caixa</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleAbrirModal(false)}
            disabled={caixaAberto}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            Abrir Caixa
          </button>
          <button
            onClick={() => handleAbrirModal(true)}
            disabled={!caixaAberto}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
          >
            Fechar Caixa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Coluna de Produtos */}
        <div className="col-span-2 bg-white rounded-lg shadow-md p-4 max-h-[80vh] overflow-y-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Cardápio</h2>
          <div className="grid grid-cols-4 gap-3">
            {produtos.map(produto => (
              <button
                key={produto.id}
                onClick={() => handleAdicionarProduto(produto)}
                disabled={!caixaAberto}
                className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingBag size={24} className="text-primary mb-1" />
                <span className="text-sm font-medium text-gray-800 text-center">{produto.nome}</span>
                <span className="text-xs text-green-600 mt-1">R$ {produto.preco.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Coluna do Carrinho */}
        <div className="col-span-1 bg-white rounded-lg shadow-md flex flex-col max-h-[80vh]">
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">
              Carrinho ({produtosNoCarrinho.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {produtosNoCarrinho.map((produto, index) => (
              <div key={index} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                <span>{produto.nome}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-green-600">R$ {produto.preco.toFixed(2)}</span>
                  <button onClick={() => handleRemoverProduto(index)} className="text-red-500 hover:text-red-700">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            {produtosNoCarrinho.length === 0 && (
              <p className="text-center text-gray-500 py-8">Adicione produtos</p>
            )}
          </div>
          <div className="p-4 border-t">
            <div className="flex justify-between items-center text-lg font-bold mb-3">
              <span>TOTAL</span>
              <span>R$ {totalCarrinho.toFixed(2)}</span>
            </div>
            <button
              onClick={handleFinalizarVenda}
              disabled={produtosNoCarrinho.length === 0 || !caixaAberto}
              className="w-full py-3 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Finalizar Venda
            </button>
          </div>
        </div>
      </div>

      {modalAberto && <CaixaModal isClosing={isClosing} onClose={() => setModalAberto(false)} />}
    </div>
  );
};