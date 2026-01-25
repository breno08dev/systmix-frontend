// src/components/PDV/ComandaModal.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Printer, Search, ShoppingCart, User, Clock, Loader2, Receipt, Percent 
} from 'lucide-react';

import { useReactToPrint } from 'react-to-print';
import { comandasService } from '../../services/comandas';
import { Comanda, Produto } from '../../types';
import { Comprovante } from './Comprovante';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../Shared/Modal';
import { ConfirmacaoModal } from '../Common/ConfirmacaoModal'; // Verifique se o caminho está correto

const METODOS_PAGAMENTO_COMANDA = {
    DINHEIRO: 'Dinheiro - Comanda',
    CARTAO: 'Cartão - Comanda',
    PIX: 'Pix - Comanda',
};

const formatTimeSafe = (dateString: any) => {
    if (!dateString) return '--:--';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
};

interface ComandaModalProps {
  comandaInicial: Comanda;
  produtos: Produto[];
  onClose: (idComandaFechada?: string) => void;
  isOnline: boolean;
  onItemUpdated: (comandaId: string) => void;
}

export default function ComandaModal({
  comandaInicial,
  produtos,
  onClose,
  isOnline,
  onItemUpdated,
}: ComandaModalProps) {

  const [comandaAtual, setComandaAtual] = useState<Comanda>(comandaInicial);
  const [termoBusca, setTermoBusca] = useState('');
  const [mostrarPagamento, setMostrarPagamento] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState(METODOS_PAGAMENTO_COMANDA.DINHEIRO);
  const [valorPagamento, setValorPagamento] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [taxaServico, setTaxaServico] = useState(false);

  // Estado do Modal de Confirmação
  const [confirmacao, setConfirmacao] = useState({
    isOpen: false,
    title: '',
    message: '',
    tipo: 'aviso' as 'aviso' | 'perigo' | 'sucesso',
    acao: () => {},
  });
  
  const comprovanteRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    setComandaAtual(comandaInicial);
  }, [comandaInicial]);

  // --- CÁLCULOS ---
  const subtotalComanda = useMemo(() => {
    return comandaAtual.itens?.reduce((total, item) => total + item.quantidade * item.valor_unit, 0) || 0;
  }, [comandaAtual.itens]);

  const valorTaxa = useMemo(() => {
      return taxaServico ? subtotalComanda * 0.10 : 0;
  }, [subtotalComanda, taxaServico]);

  const totalFinal = useMemo(() => {
    return subtotalComanda + valorTaxa;
  }, [subtotalComanda, valorTaxa]);

  // --- LÓGICA DE PESQUISA CORRIGIDA ---
  const produtosFiltrados = useMemo(() => {
    // Se não tiver termo, retorna os primeiros 50 para performance
    if (!termoBusca.trim()) return produtos.slice(0, 50);
    
    const termo = termoBusca.toLowerCase().trim();
    
    return produtos.filter(p => {
        const nomeProduto = p.nome ? p.nome.toLowerCase() : '';
        // Se você tiver código de barras no tipo Produto, adicione aqui: || (p.codigo_barras && p.codigo_barras.includes(termo))
        return nomeProduto.includes(termo);
    });
  }, [produtos, termoBusca]);

  const handlePrint = useReactToPrint({ contentRef: comprovanteRef });

  // --- AÇÕES ---
  const adicionarProduto = async (produto: Produto) => {
    if (carregando) return;
    setCarregando(true);
    // Limpa a busca para facilitar próxima inserção (opcional)
    // setTermoBusca(''); 
    
    try {
      const itemRetornado = await comandasService.adicionarItem(isOnline, comandaAtual.id, {
        id_produto: produto.id,
        quantidade: 1,
        valor_unit: produto.preco,
      });

      if (itemRetornado) {
        setComandaAtual(prevComanda => {
          const itensAtuais = prevComanda.itens || [];
          const itemExistenteIndex = itensAtuais.findIndex(i => i.id === itemRetornado.id);
          let novosItens;
          
          if (itemExistenteIndex > -1) {
            novosItens = [...itensAtuais];
            novosItens[itemExistenteIndex] = itemRetornado;
          } else {
            const itemComProduto = { ...itemRetornado, produto: produto };
            novosItens = [...itensAtuais, itemComProduto];
          }
          return { ...prevComanda, itens: novosItens };
        });
        
        onItemUpdated(comandaAtual.id); 
      }
    } catch (error: any) {
      console.error('Erro ao adicionar produto:', error);
      addToast(error.message || 'Erro ao adicionar.', 'error');
    } finally {
      setCarregando(false);
      // Mantém o foco no input de busca se desejar
    }
  };

  const alterarQuantidade = async (itemId: string, novaQuantidade: number) => {
    if (novaQuantidade < 1) {
        solicitarRemocaoItem(itemId);
        return;
    }
    
    const estadoAnterior = { ...comandaAtual };
    setComandaAtual(prev => ({
        ...prev,
        itens: (prev.itens || []).map(i => i.id === itemId ? { ...i, quantidade: novaQuantidade } : i)
    }));

    try {
      await comandasService.atualizarQuantidadeItem(isOnline, comandaAtual.id, itemId, novaQuantidade);
      onItemUpdated(comandaAtual.id);
    } catch (error: any) {
      console.error('Erro:', error);
      addToast('Erro ao atualizar quantidade.', 'error');
      setComandaAtual(estadoAnterior);
    }
  };

  const solicitarRemocaoItem = (itemId: string) => {
    setConfirmacao({
        isOpen: true,
        title: 'Remover Item',
        message: 'Tem certeza que deseja remover este item da comanda?',
        tipo: 'perigo',
        acao: () => removerItemConfirmado(itemId)
    });
  };

  const removerItemConfirmado = async (itemId: string) => {
    const estadoAnterior = { ...comandaAtual };
    setComandaAtual(prev => ({
        ...prev,
        itens: (prev.itens || []).filter(i => i.id !== itemId)
    }));
    
    try {
      await comandasService.removerItem(isOnline, comandaAtual.id, itemId);
      onItemUpdated(comandaAtual.id);
    } catch (error: any) {
      console.error('Erro:', error);
      addToast('Erro ao remover item.', 'error');
      setComandaAtual(estadoAnterior);
    }
  };
  
  const solicitarFechamento = () => {
    if (totalFinal <= 0) return addToast('Comanda vazia.', 'error');
    
    const valorPago = parseFloat(valorPagamento) || totalFinal;
    if (metodoPagamento === METODOS_PAGAMENTO_COMANDA.DINHEIRO && valorPago < totalFinal) {
      return addToast('Valor pago insuficiente.', 'error');
    }

    setConfirmacao({
        isOpen: true,
        title: 'Fechar Comanda',
        message: `Confirmar recebimento de R$ ${totalFinal.toFixed(2)} e fechar a mesa?`,
        tipo: 'sucesso',
        acao: () => fecharComandaConfirmado()
    });
  };

  const fecharComandaConfirmado = async () => {
    setCarregando(true);
    try {
      await comandasService.fecharComanda(isOnline, comandaAtual.id, [{
        metodo: metodoPagamento,
        valor: totalFinal,
      }]);
      addToast(`Comanda fechada com sucesso!`, 'success');
      onClose(comandaAtual.id); 
    } catch (error: any) {
      console.error('Erro ao fechar:', error);
      addToast('Não foi possível fechar a comanda.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  const valorPagoFloat = parseFloat(valorPagamento) || 0;
  const troco = valorPagoFloat > totalFinal ? valorPagoFloat - totalFinal : 0;

  useEffect(() => {
    if (mostrarPagamento && !valorPagamento) {
      setValorPagamento(totalFinal.toFixed(2));
    }
  }, [mostrarPagamento, totalFinal, valorPagamento]);

  // --- RENDERIZAÇÃO ---
  const modalFooter = (
    <div className="w-full flex items-center justify-between">
        {!mostrarPagamento ? (
            <>
                <div className="flex items-center gap-4">
                    <button onClick={handlePrint} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Imprimir Comprovante" disabled={subtotalComanda <= 0}>
                        <Printer size={20} />
                    </button>
                    <div>
                        {taxaServico && (
                             <p className="text-xs text-slate-400 font-medium">
                                Sub: R$ {subtotalComanda.toFixed(2)} + 10%
                            </p>
                        )}
                        <p className="text-xs font-bold text-slate-500 uppercase">Total Final</p>
                        <p className="text-2xl font-black text-slate-800">R$ {totalFinal.toFixed(2)}</p>
                    </div>
                </div>
                <button 
                    onClick={() => setMostrarPagamento(true)}
                    disabled={totalFinal <= 0 || carregando}
                    className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
                >
                    <Banknote size={20} />
                    Pagamento
                </button>
            </>
        ) : (
            <div className="w-full flex gap-3">
                 <button 
                    onClick={() => { setMostrarPagamento(false); setValorPagamento(''); }}
                    className="px-4 py-3 border border-slate-300 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                    Voltar
                </button>
                 <button 
                    onClick={solicitarFechamento}
                    disabled={carregando || (metodoPagamento === METODOS_PAGAMENTO_COMANDA.DINHEIRO && valorPagoFloat < totalFinal)}
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                    {carregando ? <Loader2 className="animate-spin" /> : <Receipt size={20} />}
                    Confirmar Fechamento
                </button>
            </div>
        )}
    </div>
  );

  return (
    <>
      <div style={{ display: 'none' }}>
        <Comprovante 
            ref={comprovanteRef} 
            comanda={comandaAtual} 
            taxaServico={taxaServico}
        />
      </div>

      <Modal 
        title={`Comanda #${comandaAtual.numero}`} 
        onClose={() => onClose()} 
        footer={modalFooter}
        maxWidth="max-w-5xl"
      >
        <div className="flex flex-col h-[600px]">
             {/* Header Info */}
             <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                    <User size={16} />
                    {comandaAtual.cliente?.nome || 'Cliente não identificado'}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium">
                    <Clock size={16} />
                    Aberto às {formatTimeSafe(comandaAtual.criado_em)}
                </div>
             </div>

            {!mostrarPagamento ? (
                <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                    
                    {/* ESQUERDA: CATÁLOGO DE PRODUTOS */}
                    <div className="lg:w-1/2 flex flex-col h-full">
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                            <input
                                type="text"
                                placeholder="Buscar produto por nome..."
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-900 bg-white shadow-sm"
                                value={termoBusca}
                                onChange={(e) => setTermoBusca(e.target.value)}
                                autoFocus
                            />
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {produtosFiltrados.map(produto => (
                                <button
                                    key={produto.id}
                                    onClick={() => adicionarProduto(produto)}
                                    disabled={carregando}
                                    className="w-full flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group text-left shadow-sm"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-800 text-sm">{produto.nome}</p>
                                        <p className="text-xs text-slate-500 font-medium">R$ {produto.preco.toFixed(2)}</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        <Plus size={18} />
                                    </div>
                                </button>
                            ))}
                            {produtosFiltrados.length === 0 && (
                                <p className="text-center text-slate-400 mt-4 text-sm">Nenhum produto encontrado.</p>
                            )}
                        </div>
                    </div>

                    {/* DIREITA: ITENS DO PEDIDO */}
                    <div className="lg:w-1/2 flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between">
                            <div className="font-bold text-slate-700 flex items-center gap-2">
                                <ShoppingCart size={18} /> Itens
                            </div>
                            
                            <button 
                                onClick={() => setTaxaServico(!taxaServico)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                    taxaServico 
                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm' 
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                }`}
                            >
                                <Percent size={12} />
                                {taxaServico ? '10% Ativo' : 'Cobrar 10%'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {comandaAtual.itens?.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <ShoppingCart size={40} className="mb-2 opacity-20" />
                                    <p className="text-sm">Nenhum item adicionado</p>
                                </div>
                            ) : (
                                comandaAtual.itens?.map(item => (
                                    <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className="font-bold text-slate-800 text-sm truncate">{item.produto?.nome}</p>
                                            <p className="text-xs text-slate-500">Un: R$ {item.valor_unit.toFixed(2)}</p>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => alterarQuantidade(item.id, item.quantidade - 1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-slate-200"><Minus size={14} /></button>
                                            <span className="w-6 text-center font-bold text-sm">{item.quantidade}</span>
                                            <button onClick={() => alterarQuantidade(item.id, item.quantidade + 1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-slate-200"><Plus size={14} /></button>
                                        </div>

                                        <div className="text-right ml-3 min-w-[60px]">
                                            <p className="font-bold text-emerald-600 text-sm">R$ {(item.quantidade * item.valor_unit).toFixed(2)}</p>
                                        </div>
                                        
                                        <button 
                                            onClick={() => solicitarRemocaoItem(item.id)} 
                                            className="ml-3 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 hover:shadow-sm border border-transparent hover:border-red-100 rounded-lg transition-all duration-200"
                                            title="Remover Item"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <div className="p-3 bg-slate-100 border-t border-slate-200 text-sm">
                            <div className="flex justify-between mb-1">
                                <span className="text-slate-500">Subtotal</span>
                                <span className="font-semibold">R$ {subtotalComanda.toFixed(2)}</span>
                            </div>
                            {taxaServico && (
                                <div className="flex justify-between text-indigo-600 animate-[fade-in_0.3s]">
                                    <span className="font-medium">Taxa de Serviço (10%)</span>
                                    <span className="font-bold">+ R$ {valorTaxa.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* ÁREA DE PAGAMENTO */
                <div className="flex flex-col h-full animate-[fade-in_0.2s]">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CreditCard className="text-indigo-600" /> Selecione o Método
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {[
                            { id: METODOS_PAGAMENTO_COMANDA.DINHEIRO, icon: Banknote, label: 'Dinheiro' },
                            { id: METODOS_PAGAMENTO_COMANDA.CARTAO, icon: CreditCard, label: 'Cartão' },
                            { id: METODOS_PAGAMENTO_COMANDA.PIX, icon: QrCode, label: 'PIX' },
                        ].map(metodo => (
                            <button
                                key={metodo.id}
                                onClick={() => setMetodoPagamento(metodo.id)}
                                className={`flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all ${
                                    metodoPagamento === metodo.id 
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                <metodo.icon size={28} />
                                <span className="font-bold">{metodo.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-auto">
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-sm font-semibold text-slate-500">Valor Total a Pagar</label>
                            <span className="text-3xl font-black text-slate-800">R$ {totalFinal.toFixed(2)}</span>
                        </div>
                        
                        {metodoPagamento === METODOS_PAGAMENTO_COMANDA.DINHEIRO && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Valor Recebido</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={valorPagamento}
                                        onChange={(e) => setValorPagamento(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 text-xl font-bold border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                        placeholder="0,00"
                                        autoFocus
                                    />
                                </div>
                                {troco > 0 && (
                                    <div className="flex justify-between items-center mt-4 p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
                                        <span className="font-bold">Troco a devolver:</span>
                                        <span className="font-black text-xl">R$ {troco.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </Modal>
      
      {/* CORREÇÃO: Modal de confirmação movido para o final do JSX para ficar sobreposto */}
      <ConfirmacaoModal
        isOpen={confirmacao.isOpen}
        onClose={() => setConfirmacao({ ...confirmacao, isOpen: false })}
        onConfirm={confirmacao.acao}
        title={confirmacao.title}
        message={confirmacao.message}
        tipo={confirmacao.tipo}
      />
    </>
  );
};