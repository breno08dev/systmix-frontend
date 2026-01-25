import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Search, Trash2, ShoppingCart, 
  CreditCard, Lock, Unlock, ChevronRight, Plus, Minus, Box 
} from 'lucide-react';
import { useCaixa } from '../../contexts/CaixaContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { produtosService } from '../../services/produtos';
import { comandasService } from '../../services/comandas';
import { Produto } from '../../types';
import { CaixaModal } from './CaixaModal';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../Shared/Modal';

// Interface local para o carrinho
interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

const METODOS_PAGAMENTO_RAPIDO = ['Dinheiro', 'Pix', 'Cartão Débito', 'Cartão Crédito'];

export const CaixaRapido: React.FC = () => {
  const { isOnline } = useOnlineStatus();
  const { caixaAberto } = useCaixa(); 
  const { addToast } = useToast();
  
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  
  const [modalCaixaAberto, setModalCaixaAberto] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const [termoBusca, setTermoBusca] = useState('');
  const [vendaModalAberto, setVendaModalAberto] = useState(false);

  // Carrega produtos (e atualiza estoque visualmente)
  const carregarProdutos = () => {
    produtosService.listarAtivos(isOnline).then(setProdutos).catch(console.error);
  };

  useEffect(() => {
    carregarProdutos();
  }, [isOnline]);

  // Totais
  const totalCarrinho = useMemo(() => {
    return carrinho.reduce((sum, item) => sum + (item.produto.preco * item.quantidade), 0);
  }, [carrinho]);

  const produtosFiltrados = useMemo(() => {
    if (!termoBusca) return produtos;
    const busca = termoBusca.toLowerCase();
    return produtos.filter(p => 
      p.nome.toLowerCase().includes(busca) || 
      p.categoria.toLowerCase().includes(busca)
    );
  }, [produtos, termoBusca]);

  // Adicionar ao Carrinho (Com verificação de estoque)
  const handleAdicionarProduto = (produto: Produto) => {
    setCarrinho(prev => {
      const itemExistente = prev.find(item => item.produto.id === produto.id);
      const qtdAtual = itemExistente ? itemExistente.quantidade : 0;

      // Validação de Estoque
      if (qtdAtual + 1 > produto.estoque) {
          addToast(`Limite de estoque atingido para ${produto.nome}.`, 'error');
          return prev;
      }

      if (itemExistente) {
        // Incrementa quantidade
        return prev.map(item => 
          item.produto.id === produto.id 
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      // Novo item
      return [...prev, { produto, quantidade: 1 }];
    });
  };

  // Alterar Quantidade no Carrinho (+/-)
  const handleAlterarQuantidade = (index: number, delta: number) => {
    setCarrinho(prev => {
      const item = prev[index];
      const novaQtd = item.quantidade + delta;
      
      // Validação de estoque ao aumentar
      if (delta > 0 && novaQtd > item.produto.estoque) {
          addToast('Estoque insuficiente.', 'error');
          return prev;
      }

      // Remove se chegar a 0
      if (novaQtd <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      
      return prev.map((it, i) => i === index ? { ...it, quantidade: novaQtd } : it);
    });
  };

  const handleRemoverItem = (index: number) => {
    setCarrinho(prev => prev.filter((_, i) => i !== index));
  };

  const handleAbrirFinalizarVenda = () => {
    if (carrinho.length === 0) return;
    setVendaModalAberto(true);
  };

  // Processar Venda
  const handleFinalizarVendaComPagamento = async (pagamentos: { metodo: string; valor: number }[], troco: number) => {
    try {
      // 1. Cria Comanda Temporária
      const comanda = await comandasService.criarComanda(isOnline, 0, undefined); 
      
      // 2. Adiciona Itens (O Service deve lidar com a baixa de estoque no banco)
      for (const item of carrinho) {
        await comandasService.adicionarItem(isOnline, comanda.id, {
          id_produto: item.produto.id,
          quantidade: item.quantidade,
          valor_unit: item.produto.preco
        });
      }

      // 3. Fecha Comanda
      await comandasService.fecharComanda(isOnline, comanda.id, pagamentos);
      
      setCarrinho([]);
      setVendaModalAberto(false);
      carregarProdutos(); // Atualiza a lista para refletir o novo estoque
      
      let msg = `Venda finalizada!`;
      if (troco > 0) msg += ` Troco: R$ ${troco.toFixed(2)}`;
      addToast(msg, 'success');

    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Erro ao finalizar venda.', 'error');
    }
  };

  const handleControleCaixa = (fechar: boolean) => {
    setIsClosing(fechar);
    setModalCaixaAberto(true);
  };

  return (
    <div className="p-6 h-screen flex flex-col overflow-hidden bg-slate-50/50">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="text-indigo-600" /> Frente de Caixa
          </h1>
          <p className="text-slate-500 text-sm">Vendas rápidas e diretas.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 border text-sm ${
                caixaAberto 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}>
                {caixaAberto ? <Unlock size={16} /> : <Lock size={16} />}
                {caixaAberto ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
            </div>

            <button
                onClick={() => handleControleCaixa(caixaAberto)}
                className={`px-4 py-2 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-95 ${
                    caixaAberto 
                    ? 'bg-slate-800 hover:bg-slate-900 shadow-slate-500/20' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                }`}
            >
                {caixaAberto ? 'Fechar Caixa' : 'Abrir Caixa'}
            </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        
        {/* ESQUERDA: CATÁLOGO DE PRODUTOS */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-white z-10">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar produto por nome ou código..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-lg font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    autoFocus
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/30">
             {produtosFiltrados.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                    <ShoppingBag size={64} className="mb-4 text-slate-300" />
                    <p className="text-lg font-medium">Nenhum produto encontrado</p>
                </div>
             ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {produtosFiltrados.map(produto => {
                        const semEstoque = produto.estoque <= 0;
                        return (
                            <button
                                key={produto.id}
                                onClick={() => handleAdicionarProduto(produto)}
                                disabled={!caixaAberto || semEstoque}
                                className={`group bg-white p-4 rounded-xl border transition-all flex flex-col justify-between items-start text-left h-[130px] relative overflow-hidden ${
                                    semEstoque 
                                    ? 'opacity-60 border-slate-200 cursor-not-allowed grayscale' 
                                    : 'border-slate-200 hover:border-indigo-400 hover:shadow-lg'
                                }`}
                            >
                                <div className="w-full">
                                    <h3 className="font-bold text-slate-800 text-base leading-tight line-clamp-2 mb-1">
                                        {produto.nome}
                                    </h3>
                                    
                                    {/* Badge de Estoque */}
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                            semEstoque ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            <Box size={10} />
                                            {produto.estoque} un
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="w-full flex items-end justify-between mt-2">
                                    <p className="text-emerald-600 font-black text-xl">
                                        R$ {produto.preco.toFixed(2)}
                                    </p>
                                    {!semEstoque && (
                                        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                                            <Plus size={18} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>

                                {semEstoque && (
                                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                                        <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded shadow-md transform -rotate-12">ESGOTADO</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
             )}
          </div>
        </div>

        {/* DIREITA: CARRINHO */}
        <div className="w-[420px] bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col shrink-0 z-20 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ShoppingCart className="text-indigo-600" /> Carrinho
                    </h2>
                    <p className="text-slate-500 text-xs mt-0.5">
                        {carrinho.reduce((acc, item) => acc + item.quantidade, 0)} itens no total
                    </p>
                </div>
                <button 
                    onClick={() => setCarrinho([])} 
                    disabled={carrinho.length === 0}
                    className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-0"
                >
                    LIMPAR
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-50/20">
                {carrinho.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <ShoppingBag size={64} className="mb-4 opacity-20" />
                        <p className="font-medium text-slate-400">Carrinho vazio</p>
                        <p className="text-sm text-slate-400">Selecione produtos ao lado</p>
                    </div>
                ) : (
                    carrinho.map((item, idx) => (
                        <div key={`${item.produto.id}-${idx}`} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 transition-all shadow-sm">
                            
                            <div className="flex-1 truncate pr-3">
                                <p className="font-bold text-slate-800 text-sm truncate">{item.produto.nome}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                    <span>Unit: R$ {item.produto.preco.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 mr-3">
                                <button 
                                    onClick={() => handleAlterarQuantidade(idx, -1)}
                                    className="w-6 h-6 flex items-center justify-center bg-white text-slate-600 rounded hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                                >
                                    <Minus size={14} strokeWidth={2.5} />
                                </button>
                                <span className="font-bold text-slate-900 w-6 text-center text-sm">{item.quantidade}</span>
                                <button 
                                    onClick={() => handleAlterarQuantidade(idx, 1)}
                                    className="w-6 h-6 flex items-center justify-center bg-white text-slate-600 rounded hover:text-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm"
                                >
                                    <Plus size={14} strokeWidth={2.5} />
                                </button>
                            </div>

                            <div className="text-right min-w-[70px] mr-2">
                                <p className="font-black text-slate-800 text-sm">
                                    R$ {(item.produto.preco * item.quantidade).toFixed(2)}
                                </p>
                            </div>

                            <button 
                                onClick={() => handleRemoverItem(idx)}
                                className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="p-6 bg-slate-900 text-white mt-auto rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] z-30 relative">
                <div className="flex justify-between items-end mb-4">
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Total a Pagar</span>
                    <span className="text-4xl font-black tracking-tight text-emerald-400">
                        R$ {totalCarrinho.toFixed(2)}
                    </span>
                </div>
                
                <button
                    onClick={handleAbrirFinalizarVenda}
                    disabled={carrinho.length === 0 || !caixaAberto}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black rounded-2xl text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                >
                    <span>FINALIZAR VENDA</span>
                    <ChevronRight size={24} strokeWidth={3} />
                </button>
            </div>
        </div>
      </div>

      {/* MODAIS */}
      <CaixaModal 
        isOpen={modalCaixaAberto}
        isClosing={isClosing} 
        onClose={() => setModalCaixaAberto(false)} 
      />
      
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

// === SUB-COMPONENTE: MODAL DE PAGAMENTO ===
const VendaRapidaModal: React.FC<{
    total: number;
    onClose: () => void;
    onFinalizar: (pagamentos: { metodo: string; valor: number }[], troco: number) => void;
  }> = ({ total, onClose, onFinalizar }) => {
    
    const [pagamentos, setPagamentos] = useState([{ metodo: METODOS_PAGAMENTO_RAPIDO[0], valor: total }]);
    
    // Recalcula totais
    const totalPago = pagamentos.reduce((sum, p) => sum + (p.valor || 0), 0);
    const restante = Math.max(0, parseFloat((total - totalPago).toFixed(2)));
    const troco = Math.max(0, parseFloat((totalPago - total).toFixed(2)));
    
    const handleUpdatePagamento = (index: number, field: 'metodo' | 'valor', value: any) => {
        const novos = [...pagamentos];
        novos[index] = { ...novos[index], [field]: value };
        setPagamentos(novos);
    };

    const handleAdicionarMetodo = () => {
        if (restante > 0) {
            setPagamentos([...pagamentos, { metodo: METODOS_PAGAMENTO_RAPIDO[0], valor: restante }]);
        }
    };

    const handleRemoverMetodo = (index: number) => {
        setPagamentos(pagamentos.filter((_, i) => i !== index));
    };

    const modalFooter = (
        <div className="w-full flex gap-3">
             <button onClick={onClose} className="px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
             <button 
                onClick={() => onFinalizar(pagamentos, troco)}
                disabled={restante > 0.01}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
             >
                <CreditCard size={20} />
                CONFIRMAR E RECEBER
             </button>
        </div>
    );

    return (
        <Modal title="Pagamento Venda Rápida" onClose={onClose} footer={modalFooter} maxWidth="max-w-lg">
            <div className="pt-2 pb-6 space-y-6">
                
                <div className="flex items-center justify-between p-5 bg-slate-900 text-white rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <span className="text-slate-400 font-bold text-sm uppercase">Total a Receber</span>
                        <p className="text-4xl font-black text-emerald-400">R$ {total.toFixed(2)}</p>
                    </div>
                    <CreditCard size={64} className="absolute right-[-10px] bottom-[-10px] text-slate-800 opacity-50 rotate-12" />
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-sm font-bold text-slate-700">Formas de Pagamento</label>
                        {restante > 0 && (
                            <button onClick={handleAdicionarMetodo} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md flex items-center gap-1 transition-colors">
                                <Plus size={14} /> ADICIONAR OUTRO
                            </button>
                        )}
                    </div>
                    
                    {pagamentos.map((pag, idx) => (
                        <div key={idx} className="flex gap-2 items-center animate-[fade-in_0.2s]">
                            <select 
                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                                value={pag.metodo}
                                onChange={(e) => handleUpdatePagamento(idx, 'metodo', e.target.value)}
                            >
                                {METODOS_PAGAMENTO_RAPIDO.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            
                            <div className="relative w-36">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-full pl-8 pr-3 py-3 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    value={pag.valor}
                                    onChange={(e) => handleUpdatePagamento(idx, 'valor', parseFloat(e.target.value) || 0)}
                                />
                            </div>

                            {pagamentos.length > 1 && (
                                <button onClick={() => handleRemoverMetodo(idx)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                     <div className="p-4 bg-slate-50 rounded-2xl text-center border border-slate-100">
                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Total Pago</p>
                        <p className="text-2xl font-black text-slate-800">R$ {totalPago.toFixed(2)}</p>
                     </div>
                     <div className={`p-4 rounded-2xl text-center border ${restante > 0.01 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                        <p className="text-xs uppercase font-bold mb-1">{restante > 0.01 ? 'Falta Pagar' : 'Troco'}</p>
                        <p className="text-2xl font-black">R$ {(restante > 0.01 ? restante : troco).toFixed(2)}</p>
                     </div>
                </div>
            </div>
        </Modal>
    );
};