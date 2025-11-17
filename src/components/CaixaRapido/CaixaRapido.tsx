// src/components/CaixaRapido/CaixaRapido.tsx (LÓGICA HÍBRIDA CORRIGIDA)
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, X, Plus, Search } from 'lucide-react';
import { useCaixa } from '../../contexts/CaixaContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { produtosService } from '../../services/produtos';
import { Produto, ItemComanda } from '../../types';
import { CaixaModal } from './CaixaModal';
import { useToast } from '../../contexts/ToastContext';
import { localDatabaseService } from '../../lib/localDatabase';
// NOVO: Importar o comandasService para a lógica online
import { comandasService } from '../../services/comandas';

// ▼▼▼ FUNÇÃO ATUALIZADA (AGORA HÍBRIDA) ▼▼▼
// Agora ela decide se usa o serviço Online (comandasService) ou Offline (localDatabaseService)
const criarVendaRapida = async (isOnline: boolean, produtosNoCarrinho: Produto[], pagamentos: { metodo: string; valor: number }[]) => {
  if (produtosNoCarrinho.length === 0) return;

  if (isOnline) {
    // --- CAMINHO ONLINE ---
    console.log("ONLINE: Registrando Venda Rápida via Supabase...");
    try {
      // 1. Criar Comanda online
      const comanda = await comandasService.criarComanda(isOnline, 0, undefined); // 0 = Venda Rápida
      if (!comanda) throw new Error("Não foi possível criar a comanda online.");

      // 2. Adicionar Itens online
      for (const produto of produtosNoCarrinho) {
        const item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'> = {
          id_produto: produto.id,
          quantidade: 1, 
          valor_unit: produto.preco,
        };
        await comandasService.adicionarItem(isOnline, comanda.id, item);
      }

      // 3. Fechar Comanda online
      await comandasService.fecharComanda(isOnline, comanda.id, pagamentos);
      console.log("ONLINE: Venda Rápida registrada com sucesso.");
      
    } catch (error) {
      console.error("ERRO na Venda Rápida ONLINE:", error);
      // Fallback para offline? (Opcional)
      // Por enquanto, vamos lançar o erro para o usuário saber.
      throw new Error("Falha ao registrar venda online. Verifique a conexão.");
    }

  } else {
    // --- CAMINHO OFFLINE (Como estava antes) ---
    console.log("OFFLINE: Criando comanda no Dexie/SQLite");
    const comanda = await localDatabaseService.criarComanda(0, undefined); 
    
    for (const produto of produtosNoCarrinho) {
      const item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'> = {
        id_produto: produto.id,
        quantidade: 1, 
        valor_unit: produto.preco,
      };
      // O log que você viu
      console.log("OFFLINE: Adicionando item localmente");
      const novoItem = await localDatabaseService.adicionarItem(comanda.id, item);
      
      // O log que você viu
      await localDatabaseService.addPendingAction('ADICIONAR_ITEM', { idComanda: comanda.id, item: novoItem });
    }

    console.log("OFFLINE: Fechando comanda localmente");
    await localDatabaseService.fecharComanda(comanda.id, pagamentos);
    await localDatabaseService.addPendingAction('FECHAR_COMANDA', { idComanda: comanda.id, pagamentos });
  }
};
// ▲▲▲ FIM DA FUNÇÃO ATUALIZADA ▲▲▲

const METODOS_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão'];

export const CaixaRapido: React.FC = () => {
  const { isOnline } = useOnlineStatus();
  const { caixaAberto, caixaSession } = useCaixa();
  const { addToast } = useToast();
  
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosNoCarrinho, setProdutosNoCarrinho] = useState<Produto[]>([]);
  const [modalCaixaAberto, setModalCaixaAberto] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const [termoBusca, setTermoBusca] = useState('');
  const [vendaModalAberto, setVendaModalAberto] = useState(false);

  useEffect(() => {
    produtosService.listarAtivos(isOnline).then(setProdutos).catch(console.error);
  }, [isOnline]);

  const totalCarrinho = produtosNoCarrinho.reduce((sum, p) => sum + p.preco, 0);

  const produtosFiltrados = useMemo(() => {
    if (!termoBusca) return produtos;
    const busca = termoBusca.toLowerCase();
    return produtos.filter(p => p.nome.toLowerCase().includes(busca));
  }, [produtos, termoBusca]);

  const handleAdicionarProduto = (produto: Produto) => {
    setProdutosNoCarrinho(prev => [...prev, produto]);
  };

  const handleRemoverProduto = (index: number) => {
    setProdutosNoCarrinho(prev => prev.filter((_, i) => i !== index));
  };

  const handleAbrirFinalizarVenda = () => {
    if (produtosNoCarrinho.length === 0) return;
    setVendaModalAberto(true);
  };

  const handleFinalizarVendaComPagamento = async (pagamentos: { metodo: string; valor: number }[], troco: number) => {
    try {
      if (pagamentos.length === 0) {
        addToast('Selecione pelo menos um método de pagamento.', 'error');
        return;
      }

      // A 'isOnline' do hook é passada aqui
      await criarVendaRapida(isOnline, produtosNoCarrinho, pagamentos);
      
      setProdutosNoCarrinho([]);
      setVendaModalAberto(false);
      
      let successMessage = `Venda Rápida de R$ ${totalCarrinho.toFixed(2)} registrada!`;
      if (troco > 0) {
        successMessage += ` Troco: R$ ${troco.toFixed(2)}.`;
      }
      // Se estava online, foi direto. Se estava offline, mostrará a msg de sincronização.
      if (!isOnline) {
        successMessage += " A venda será sincronizada quando houver conexão.";
      }
      
      addToast(successMessage, 'success');

    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Erro ao finalizar a venda. Tente novamente.';
      addToast(msg, 'error');
    }
  };

  const handleAbrirModalCaixa = (closing: boolean) => {
    setIsClosing(closing);
    setModalCaixaAberto(true);
  };
  
  // Componente VendaRapidaModal (Sem alterações, mantendo a correção do troco)
  const VendaRapidaModal: React.FC<{
    total: number;
    onClose: () => void;
    onFinalizar: (pagamentos: { metodo: string; valor: number }[], troco: number) => void;
  }> = ({ total, onClose, onFinalizar }) => {
    const [pagamentos, setPagamentos] = useState([{ metodo: METODOS_PAGAMENTO[0], valor: total }]);
    const [valorRestante, setValorRestante] = useState(0);
    const [troco, setTroco] = useState(0);
    const [totalPago, setTotalPago] = useState(total);

    useEffect(() => {
      const pago = pagamentos.reduce((sum, p) => sum + (p.valor || 0), 0);
      setTotalPago(pago);
      const diff = parseFloat((total - pago).toFixed(2));

      if (diff > 0) {
        setValorRestante(diff);
        setTroco(0);
      } else {
        setValorRestante(0);
        setTroco(parseFloat((-diff).toFixed(2)));
      }
    }, [pagamentos, total]);

    const handleAdicionarPagamento = () => {
      const valorParaNovoPagamento = valorRestante > 0.01 ? valorRestante : 0;
      setPagamentos(prev => [...prev, { metodo: METODOS_PAGAMENTO[0], valor: valorParaNovoPagamento }]);
    };
    
    const handleRemoverPagamento = (index: number) => {
        setPagamentos(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdatePagamento = (index: number, key: 'metodo' | 'valor', value: string | number) => {
      setPagamentos(prev => 
        prev.map((p, i) => i === index ? { ...p, [key]: (typeof value === 'string' && key === 'valor') ? parseFloat(value) || 0 : value } : p)
      );
    };

    const isValido = valorRestante === 0 && pagamentos.length > 0;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Finalizar Venda Rápida</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          </div>
          
          <div className="mb-4 p-3 bg-indigo-50 rounded-lg flex justify-between items-center">
            <span className="text-lg text-indigo-700">Total da Venda:</span>
            <span className="text-2xl font-bold text-indigo-700">R$ {total.toFixed(2)}</span>
          </div>
          
          <h3 className="text-lg font-semibold mb-3">Pagamentos</h3>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {pagamentos.map((pagamento, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border">
                <select
                  value={pagamento.metodo}
                  onChange={(e) => handleUpdatePagamento(index, 'metodo', e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                >
                  {METODOS_PAGAMENTO.map(metodo => (
                    <option key={metodo} value={metodo}>{metodo}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={pagamento.valor}
                  onChange={(e) => handleUpdatePagamento(index, 'valor', e.target.value)}
                  className="w-28 p-2 border border-gray-300 rounded-md text-right focus:ring-primary focus:border-primary"
                  step="0.01"
                  min="0"
                />
                <button 
                    onClick={() => handleRemoverPagamento(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                >
                    <X size={18} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleAdicionarPagamento}
            className="w-full mt-4 py-2 flex items-center justify-center gap-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Plus size={18} /> Adicionar Pagamento
          </button>
          
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total Pago</span>
              <span className="text-gray-900">R$ {totalPago.toFixed(2)}</span>
            </div>

            {valorRestante > 0 && (
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Restante a Pagar</span>
                <span className="text-red-600">
                  R$ {valorRestante.toFixed(2)}
                </span>
              </div>
            )}

            {troco > 0 && (
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Troco</span>
                <span className="text-green-600">
                  R$ {troco.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => onFinalizar(pagamentos, troco)}
            disabled={!isValido}
            className="w-full py-3 mt-6 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Pagar e Finalizar Venda
          </button>
        </div>
      </div>
    );
  };

  // JSX Principal (Sem alterações)
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Caixa Rápido</h1>
          <p className="text-gray-600">Vendas rápidas e gestão de caixa</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleAbrirModalCaixa(false)}
            disabled={caixaAberto}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            Abrir Caixa
          </button>
          <button
            onClick={() => handleAbrirModalCaixa(true)}
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
          
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produto por nome..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {produtosFiltrados.map(produto => (
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
            {produtosFiltrados.length === 0 && (
                <p className="col-span-4 text-center text-gray-500 py-8">Nenhum produto encontrado.</p>
            )}
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
              <div key={`${produto.id}-${index}`} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                <span>{produto.nome}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-green-600">R$ {produto.preco.toFixed(2)}</span>
                  <button 
                    onClick={() => handleRemoverProduto(index)} 
                    className="text-red-500 hover:text-red-700"
                  >
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
              onClick={handleAbrirFinalizarVenda}
              disabled={produtosNoCarrinho.length === 0 || !caixaAberto}
              className="w-full py-3 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Finalizar Venda
            </button>
          </div>
        </div>
      </div>

      {modalCaixaAberto && <CaixaModal isClosing={isClosing} onClose={() => setModalCaixaAberto(false)} />}
      
      {vendaModalAberto && (
        <VendaRapidaModal
          total={totalCarrinho}
          onClose={() => setVendaModalAberto(false)}
          onFinalizar={handleFinalizarVendaComPagamento}
        />
      )}
    </div>
  );
};