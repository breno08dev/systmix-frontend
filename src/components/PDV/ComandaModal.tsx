// src/components/PDV/ComandaModal.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { comandasService } from '../../services/comandas';
import { useCaixa } from '../../contexts/CaixaContext';
import { Comanda, Produto } from '../../types';
import { Comprovante } from './Comprovante';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../Shared/Modal';
import { Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Printer, Search, ShoppingCart, User, Clock, Loader2, Receipt, Percent, Package } from 'lucide-react';

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
  const [loadingInicial, setLoadingInicial] = useState(true); 
  const [taxaServico, setTaxaServico] = useState(false);
  
  const comprovanteRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const { registrarVenda, caixaAberto } = useCaixa();

  useEffect(() => {
    if (comandaInicial.id) {
        carregarDadosFrescos();
    }
  }, [comandaInicial.id]);

  const carregarDadosFrescos = async () => {
    setLoadingInicial(true);
    try {
        const dados = await comandasService.buscarPorId(isOnline, comandaInicial.id);
        if (dados) {
            setComandaAtual(dados);
        }
    } catch (error) {
        console.error("Erro ao atualizar comanda:", error);
    } finally {
        setLoadingInicial(false);
    }
  };

  const subtotalComanda = useMemo(() => {
    return comandaAtual.itens?.reduce((total, item) => total + item.quantidade * item.valor_unit, 0) || 0;
  }, [comandaAtual.itens]);

  const valorTaxa = useMemo(() => {
      return taxaServico ? subtotalComanda * 0.10 : 0;
  }, [subtotalComanda, taxaServico]);

  const totalFinal = useMemo(() => {
    return subtotalComanda + valorTaxa;
  }, [subtotalComanda, valorTaxa]);

  const produtosFiltrados = useMemo(() => {
    if (!termoBusca.trim()) return produtos.slice(0, 50);
    const termo = termoBusca.toLowerCase().trim();
    return produtos.filter(p => p.nome?.toLowerCase().includes(termo));
  }, [produtos, termoBusca]);

  const handlePrint = async () => {
      if (!comprovanteRef.current) return;
      
      setCarregando(true);
      try {
          // 1. Pega o HTML do comprovante
          const content = comprovanteRef.current.outerHTML;
          
          // 2. Pega os estilos da página (Tailwind) para o comprovante não sair "pelado"
          const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
              .map(node => node.outerHTML)
              .join('');

          // 3. Verifica se está no Electron
          if (window.electron) {
              await window.electron.imprimir(content, styles);
              addToast('Enviado para impressão.', 'success');
          } else {
              // Fallback para Web (se abrir no navegador normal)
              const printWindow = window.open('', '', 'width=600,height=600');
              if (printWindow) {
                  printWindow.document.write(`<html><head>${styles}</head><body>${content}</body></html>`);
                  printWindow.document.close();
                  printWindow.focus();
                  printWindow.print();
                  printWindow.close();
              }
          }
      } catch (error) {
          console.error("Erro ao imprimir:", error);
          addToast('Erro ao imprimir.', 'error');
      } finally {
          setCarregando(false);
      }
  };

  const adicionarProduto = async (produto: Produto) => {
    if (carregando) return;
    
    if (produto.estoque <= 0) return addToast('Produto esgotado!', 'error');

    setCarregando(true);
    try {
      await comandasService.adicionarItem(isOnline, comandaAtual.id, {
        id_produto: produto.id,
        quantidade: 1,
        valor_unit: produto.preco,
      });

      const comandaAtualizada = await comandasService.buscarPorId(isOnline, comandaAtual.id);
      if(comandaAtualizada) {
         setComandaAtual(comandaAtualizada);
         onItemUpdated(comandaAtual.id);
      }
      addToast('Item adicionado!', 'success');

    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Erro ao adicionar.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  const alterarQuantidade = async (itemId: string, novaQuantidade: number) => {
    if (novaQuantidade < 1) return removerItemConfirmado(itemId);
    
    const itemAtual = comandaAtual.itens?.find(i => i.id === itemId);
    
    if (itemAtual && novaQuantidade > itemAtual.quantidade) {
        const produtoRef = produtos.find(p => p.id === itemAtual.id_produto);
        const diferenca = novaQuantidade - itemAtual.quantidade;
        
        if (produtoRef && produtoRef.estoque < diferenca) {
             addToast(`Estoque insuficiente! Apenas ${produtoRef.estoque} un. disponíveis.`, 'error');
             return;
        }
    }

    try {
      await comandasService.atualizarQuantidadeItem(isOnline, comandaAtual.id, itemId, novaQuantidade);
      
      setComandaAtual(prev => ({
          ...prev,
          itens: (prev.itens || []).map(i => i.id === itemId ? { ...i, quantidade: novaQuantidade } : i)
      }));
      onItemUpdated(comandaAtual.id);

    } catch (error) {
      addToast('Erro ao atualizar quantidade.', 'error');
      carregarDadosFrescos(); 
    }
  };

  const removerItemConfirmado = async (itemId: string) => {
    if (!window.confirm("Remover este item?")) return;
    try {
      await comandasService.removerItem(isOnline, comandaAtual.id, itemId);
      setComandaAtual(prev => ({
        ...prev,
        itens: (prev.itens || []).filter(i => i.id !== itemId)
    }));
      onItemUpdated(comandaAtual.id);
    } catch (error) {
      addToast('Erro ao remover item.', 'error');
    }
  };
  
  const solicitarFechamento = () => {
    if (!caixaAberto) return addToast('O Caixa precisa estar aberto para receber valores!', 'error');

    if (totalFinal <= 0) return addToast('Comanda vazia.', 'error');
    
    const valorPago = parseFloat(valorPagamento) || totalFinal;
    if (metodoPagamento === METODOS_PAGAMENTO_COMANDA.DINHEIRO && valorPago < totalFinal) {
      return addToast('Valor pago insuficiente.', 'error');
    }

    if(window.confirm(`Confirmar recebimento de R$ ${totalFinal.toFixed(2)} e fechar a mesa?`)){
        fecharComandaConfirmado();
    }
  };

  const fecharComandaConfirmado = async () => {
    setCarregando(true);
    try {
      await comandasService.fecharComanda(isOnline, comandaAtual.id, [{
        metodo: metodoPagamento,
        valor: totalFinal,
      }]);
      
      let metodoCaixa = 'OUTROS';
      if (metodoPagamento.includes('Dinheiro')) metodoCaixa = 'DINHEIRO';
      else if (metodoPagamento.includes('Cartão')) metodoCaixa = 'CARTAO';
      else if (metodoPagamento.includes('Pix')) metodoCaixa = 'PIX';
      
      await registrarVenda(totalFinal, metodoCaixa);

      addToast(`Comanda fechada com sucesso!`, 'success');
      onClose(comandaAtual.id); 
    } catch (error) {
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

  const modalFooter = (
    <div className="w-full flex items-center justify-between">
        {!mostrarPagamento ? (
            <>
                <div className="flex items-center gap-4">
                    <button onClick={handlePrint} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Imprimir" disabled={subtotalComanda <= 0}>
                        <Printer size={20} />
                    </button>
                    <div>
                        {taxaServico && <p className="text-xs text-slate-400 font-medium">Sub: R$ {subtotalComanda.toFixed(2)} + 10%</p>}
                        <p className="text-xs font-bold text-slate-500 uppercase">Total Final</p>
                        <p className="text-2xl font-black text-slate-800">R$ {totalFinal.toFixed(2)}</p>
                    </div>
                </div>
                <button 
                    onClick={() => setMostrarPagamento(true)}
                    disabled={totalFinal <= 0 || carregando}
                    className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                    <Banknote size={20} /> Pagamento
                </button>
            </>
        ) : (
            <div className="w-full flex gap-3">
                 <button onClick={() => setMostrarPagamento(false)} className="px-4 py-3 border border-slate-300 text-slate-600 font-medium rounded-xl hover:bg-slate-50">Voltar</button>
                 <button onClick={solicitarFechamento} disabled={carregando} className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2">
                    {carregando ? <Loader2 className="animate-spin" /> : <Receipt size={20} />} Confirmar Fechamento
                </button>
            </div>
        )}
    </div>
  );

  return (
    <>
      <div style={{ display: 'none' }}><Comprovante ref={comprovanteRef} comanda={comandaAtual} taxaServico={taxaServico} /></div>

      <Modal title={`Comanda #${comandaAtual.numero}`} onClose={() => onClose()} footer={modalFooter} maxWidth="max-w-5xl">
        {loadingInicial ? (
             <div className="h-[500px] flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>Carregando itens...</p>
             </div>
        ) : (
            <div className="flex flex-col h-[600px]">
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                        <User size={16} /> {comandaAtual.cliente?.nome || 'Consumidor Final'}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium">
                        <Clock size={16} /> Aberto às {formatTimeSafe(comandaAtual.criado_em)}
                    </div>
                </div>

                {!mostrarPagamento ? (
                    <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                        {/* CATÁLOGO */}
                        <div className="lg:w-1/2 flex flex-col h-full">
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                                <input type="text" placeholder="Buscar produto..." className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} autoFocus />
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                {produtosFiltrados.map(produto => {
                                    const semEstoque = produto.estoque <= 0;
                                    return (
                                        <button key={produto.id} onClick={() => adicionarProduto(produto)} disabled={carregando || semEstoque} className={`w-full flex items-center justify-between p-3 bg-white border rounded-xl transition-all group text-left shadow-sm ${semEstoque ? 'opacity-60 bg-slate-50' : 'hover:border-indigo-300'}`}>
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm">{produto.nome}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <p className="text-xs text-slate-500 font-medium">R$ {produto.preco.toFixed(2)}</p>
                                                    <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${semEstoque ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        <Package size={10} /> {semEstoque ? 'Esgotado' : `${produto.estoque} un.`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all"><Plus size={18} /></div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ITENS */}
                        <div className="lg:w-1/2 flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between">
                                <div className="font-bold text-slate-700 flex items-center gap-2"><ShoppingCart size={18} /> Itens</div>
                                <button onClick={() => setTaxaServico(!taxaServico)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${taxaServico ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}><Percent size={12} /> 10%</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {comandaAtual.itens?.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400"><ShoppingCart size={40} className="mb-2 opacity-20" /><p className="text-sm">Nenhum item adicionado</p></div>
                                ) : (
                                    comandaAtual.itens?.map(item => (
                                        <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <p className="font-bold text-slate-800 text-sm truncate">{item.produto?.nome}</p>
                                                <p className="text-xs text-slate-500">Un: R$ {item.valor_unit.toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => alterarQuantidade(item.id, item.quantidade - 1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-slate-200"><Minus size={14} /></button>
                                                <span className="w-6 text-center font-bold text-sm">{item.quantidade}</span>
                                                <button onClick={() => alterarQuantidade(item.id, item.quantidade + 1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-slate-200"><Plus size={14} /></button>
                                            </div>
                                            <div className="text-right ml-3 min-w-[60px]"><p className="font-bold text-emerald-600 text-sm">R$ {(item.quantidade * item.valor_unit).toFixed(2)}</p></div>
                                            <button onClick={() => removerItemConfirmado(item.id)} className="ml-3 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 bg-slate-100 border-t border-slate-200 text-sm">
                                <div className="flex justify-between mb-1"><span className="text-slate-500">Subtotal</span><span className="font-semibold">R$ {subtotalComanda.toFixed(2)}</span></div>
                                {taxaServico && <div className="flex justify-between text-indigo-600"><span className="font-medium">Taxa (10%)</span><span className="font-bold">+ R$ {valorTaxa.toFixed(2)}</span></div>}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* PAGAMENTO */
                    <div className="flex flex-col h-full animate-[fade-in_0.2s]">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><CreditCard className="text-indigo-600" /> Método</h3>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            {[{ id: METODOS_PAGAMENTO_COMANDA.DINHEIRO, icon: Banknote, label: 'Dinheiro' }, { id: METODOS_PAGAMENTO_COMANDA.CARTAO, icon: CreditCard, label: 'Cartão' }, { id: METODOS_PAGAMENTO_COMANDA.PIX, icon: QrCode, label: 'PIX' }].map(m => (
                                <button key={m.id} onClick={() => setMetodoPagamento(m.id)} className={`flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all ${metodoPagamento === m.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}><m.icon size={28} /><span className="font-bold">{m.label}</span></button>
                            ))}
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-auto">
                            <div className="flex justify-between items-end mb-2"><label className="text-sm font-semibold text-slate-500">Total a Pagar</label><span className="text-3xl font-black text-slate-800">R$ {totalFinal.toFixed(2)}</span></div>
                            {metodoPagamento === METODOS_PAGAMENTO_COMANDA.DINHEIRO && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Valor Recebido</label>
                                    <input type="number" step="0.01" value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} className="w-full p-4 text-xl font-bold border border-slate-300 rounded-xl" placeholder="0,00" autoFocus />
                                    {troco > 0 && <div className="flex justify-between items-center mt-4 p-3 bg-emerald-50 text-emerald-800 rounded-xl"><span className="font-bold">Troco:</span><span className="font-black text-xl">R$ {troco.toFixed(2)}</span></div>}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}
      </Modal>
    </>
  );
};