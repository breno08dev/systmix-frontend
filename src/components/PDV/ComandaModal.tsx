// src/components/PDV/ComandaModal.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { comandasService } from '../../services/comandas';
import { logsService } from '../../services/logs'; // <-- IMPORTAÇÃO DOS LOGS
import { useCaixa } from '../../contexts/CaixaContext';
import { Comanda, Produto, PagamentoInput } from '../../types/index';
import { Comprovante } from './Comprovante';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../Shared/Modal';
import { ConfirmacaoModal } from '../Common/ConfirmacaoModal';
import { ModalSenha } from '../Common/ModalSenha';
import { supabase } from '../../lib/supabaseClient';
import { db, localDatabaseService } from '../../lib/localDatabase';

import { Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Printer, Search, ShoppingCart, User, Clock, Loader2, Receipt, Percent, Package, Wallet, BookUser } from 'lucide-react';

const METODOS_PAGAMENTO_COMANDA = {
    DINHEIRO: 'Dinheiro',
    CARTAO: 'Cartão',
    PIX: 'Pix',
    MISTO: 'Misto',
    FIADO: 'Fiado'
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
  const [mistoValores, setMistoValores] = useState({ DINHEIRO: '', CARTAO: '', PIX: '' });
  
  const [carregando, setCarregando] = useState(false);
  const [loadingInicial, setLoadingInicial] = useState(true); 
  const [taxaServico, setTaxaServico] = useState(false);
  
  const [modalConfirmaId, setModalConfirmaId] = useState<string | null>(null);
  const [showConfirmaFechamento, setShowConfirmaFechamento] = useState(false);
  
  const [modalSenhaAberta, setModalSenhaAberta] = useState(false);
  
  // <-- ESTADOS DE AUDITORIA E SENHA -->
  const [acaoProtegida, setAcaoProtegida] = useState<((usuario: {id: string, nome: string}) => void) | null>(null);
  const [quemAutorizou, setQuemAutorizou] = useState<{id: string, nome: string} | null>(null);

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
        if (dados) setComandaAtual(dados);
    } catch (error) {
        console.error("Erro ao atualizar comanda:", error);
    } finally {
        setLoadingInicial(false);
    }
  };

  const solicitarSenha = (acao: (autorizador: {id: string, nome: string}) => void) => {
    setAcaoProtegida(() => acao);
    setModalSenhaAberta(true);
  };

  const subtotalComanda = useMemo(() => {
    return comandaAtual.itens?.reduce((total, item) => total + item.quantidade * item.valor_unit, 0) || 0;
  }, [comandaAtual.itens]);

  const valorTaxa = useMemo(() => taxaServico ? subtotalComanda * 0.10 : 0, [subtotalComanda, taxaServico]);
  const totalFinal = useMemo(() => subtotalComanda + valorTaxa, [subtotalComanda, valorTaxa]);

  const totalMisto = useMemo(() => {
    return (parseFloat(mistoValores.DINHEIRO.replace(',', '.')) || 0) + 
           (parseFloat(mistoValores.CARTAO.replace(',', '.')) || 0) + 
           (parseFloat(mistoValores.PIX.replace(',', '.')) || 0);
  }, [mistoValores]);

  // Busca da comanda por Nome ou Código de Barras
  const produtosFiltrados = useMemo(() => {
    if (!termoBusca.trim()) return produtos.slice(0, 50);
    const termo = termoBusca.toLowerCase().trim();
    return produtos.filter(p => 
        p.nome?.toLowerCase().includes(termo) || 
        p.codigo_barras?.includes(termo)
    );
  }, [produtos, termoBusca]);

  const handlePrint = async () => {
      if (!comprovanteRef.current) return;
      setCarregando(true);
      try {
          const content = comprovanteRef.current.outerHTML;
          const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
              .map(node => node.outerHTML).join('');

          if (window.electron) {
              await window.electron.imprimir(content, styles);
              addToast('Enviado para impressão.', 'success');
          } else {
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
      addToast(error.message || 'Erro ao adicionar.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  // LOGICA DO LEITOR FÍSICO
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        if (produtosFiltrados.length === 1) {
            adicionarProduto(produtosFiltrados[0]);
            setTermoBusca(''); // Limpa a tela pro leitor bipar o próximo!
        } else if (produtosFiltrados.length === 0 && termoBusca.trim().length > 0) {
            addToast('Produto não encontrado.', 'error');
            setTermoBusca('');
        }
    }
  };

  // <-- LOGICA ATUALIZADA DE ALTERAÇÃO E SENHA -->
  const alterarQuantidade = async (itemId: string, novaQuantidade: number, quantidadeAtual: number) => {
    if (novaQuantidade < 1) {
        solicitarSenha((autorizador) => {
            setQuemAutorizou(autorizador);
            setModalConfirmaId(itemId);
        });
        return;
    }
    if (novaQuantidade < quantidadeAtual) {
        solicitarSenha((autorizador) => executarAlteracaoQuantidade(itemId, novaQuantidade, autorizador));
        return;
    }
    // Aumentar passa direto
    executarAlteracaoQuantidade(itemId, novaQuantidade);
  };

  const executarAlteracaoQuantidade = async (itemId: string, novaQuantidade: number, autorizador?: {id: string, nome: string}) => {
    const itemAtual = comandaAtual.itens?.find(i => i.id === itemId);
    const produtoRef = produtos.find(p => p.id === itemAtual?.id_produto);

    if (itemAtual && novaQuantidade > itemAtual.quantidade) {
        const diferenca = novaQuantidade - itemAtual.quantidade;
        if (produtoRef && produtoRef.estoque < diferenca) {
              addToast(`Estoque insuficiente! Apenas ${produtoRef.estoque} un. disponíveis.`, 'error');
              return;
        }
    }

    try {
      await comandasService.atualizarQuantidadeItem(isOnline, comandaAtual.id, itemId, novaQuantidade);
      
      // REGISTRA NO LOG SE FOI UMA REDUÇÃO
      if (autorizador && itemAtual && novaQuantidade < itemAtual.quantidade) {
          await logsService.registrar(
              autorizador,
              'ALTERAR_QTD_ITEM',
              `Quantidade do item "${produtoRef?.nome || 'Desconhecido'}" reduzida na Comanda #${comandaAtual.numero}. De ${itemAtual.quantidade} para ${novaQuantidade}.`
          );
      }

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

  const removerItemConfirmado = async () => {
    if (!modalConfirmaId || !quemAutorizou) return;
    
    const itemRemovido = comandaAtual.itens?.find(i => i.id === modalConfirmaId);

    try {
      await comandasService.removerItem(isOnline, comandaAtual.id, modalConfirmaId);
      
      // REGISTRA NO LOG A REMOÇÃO
      await logsService.registrar(
          quemAutorizou,
          'REMOVER_ITEM_COMANDA',
          `O item "${itemRemovido?.produto?.nome || 'Desconhecido'}" foi excluído permanentemente da Comanda #${comandaAtual.numero}.`
      );

      setComandaAtual(prev => ({ ...prev, itens: (prev.itens || []).filter(i => i.id !== modalConfirmaId) }));
      onItemUpdated(comandaAtual.id);
      addToast('Item removido.', 'success');
    } catch (error) {
      addToast('Erro ao remover item.', 'error');
    } finally {
        setModalConfirmaId(null);
        setQuemAutorizou(null); // Limpa quem autorizou
    }
  };
  
  const solicitarFechamento = () => {
    if (!caixaAberto) return addToast('O Caixa precisa estar aberto para receber valores!', 'error');
    if (totalFinal <= 0) return fecharComandaConfirmado(true);
    
    if (metodoPagamento === METODOS_PAGAMENTO_COMANDA.FIADO && !comandaAtual.cliente) {
        return addToast('Para vender fiado, você precisa vincular um cliente à comanda.', 'error');
    }

    if (metodoPagamento === METODOS_PAGAMENTO_COMANDA.DINHEIRO || metodoPagamento === METODOS_PAGAMENTO_COMANDA.CARTAO || metodoPagamento === METODOS_PAGAMENTO_COMANDA.PIX) {
        const valorPago = parseFloat(valorPagamento.replace(',', '.')) || totalFinal;
        if (valorPago < totalFinal) return addToast('Valor pago insuficiente.', 'error');
    }

    if (metodoPagamento === METODOS_PAGAMENTO_COMANDA.MISTO && totalMisto < totalFinal) {
        return addToast('A soma dos valores mistos é menor que o total da comanda.', 'error');
    }

    setShowConfirmaFechamento(true);
  };

  const fecharComandaConfirmado = async (vazia = false) => {
    setCarregando(true);
    try {
      if (metodoPagamento === METODOS_PAGAMENTO_COMANDA.FIADO && !vazia) {
          const dataFechamento = new Date().toISOString();
          
          if (isOnline && !comandaAtual.id.startsWith('local_')) {
              await supabase.from('comandas').update({ status: 'fiado', fechado_em: dataFechamento }).eq('id', comandaAtual.id);
          }
          await db.comandas.update(comandaAtual.id, { status: 'fiado', fechado_em: dataFechamento } as any);
          
          if (localDatabaseService.addPendingAction) {
              await localDatabaseService.addPendingAction('ATUALIZAR_COMANDA_FIADO', { id: comandaAtual.id, status: 'fiado', fechado_em: dataFechamento });
          }
          
          addToast('Comanda enviada para o Crediário (Fiado)!', 'success');
      } else {
          let pagamentos: PagamentoInput[] = [];
          
          if (!vazia) {
              if (metodoPagamento === METODOS_PAGAMENTO_COMANDA.MISTO) {
                  const valDinheiro = parseFloat(mistoValores.DINHEIRO.replace(',', '.'));
                  const valPix = parseFloat(mistoValores.PIX.replace(',', '.'));
                  const valCartao = parseFloat(mistoValores.CARTAO.replace(',', '.'));
                  
                  if (valDinheiro > 0) pagamentos.push({ metodo: 'DINHEIRO', valor: valDinheiro });
                  if (valPix > 0) pagamentos.push({ metodo: 'PIX', valor: valPix });
                  if (valCartao > 0) pagamentos.push({ metodo: 'CARTAO', valor: valCartao });
              } else {
                  pagamentos.push({ metodo: metodoPagamento, valor: totalFinal });
              }
          }

          await comandasService.fecharComanda(isOnline, comandaAtual.id, pagamentos);
          
          if (!vazia) {
              if (metodoPagamento === METODOS_PAGAMENTO_COMANDA.MISTO) {
                  const vDinheiro = parseFloat(mistoValores.DINHEIRO.replace(',', '.')) || 0;
                  const vPix = parseFloat(mistoValores.PIX.replace(',', '.')) || 0;
                  const vCartao = parseFloat(mistoValores.CARTAO.replace(',', '.')) || 0;
                  if (vDinheiro > 0) await registrarVenda(vDinheiro, 'DINHEIRO');
                  if (vPix > 0) await registrarVenda(vPix, 'PIX');
                  if (vCartao > 0) await registrarVenda(vCartao, 'CARTAO');
              } else {
                  let metodoCaixa = 'OUTROS';
                  if (metodoPagamento.includes('Dinheiro')) metodoCaixa = 'DINHEIRO';
                  else if (metodoPagamento.includes('Cartão')) metodoCaixa = 'CARTAO';
                  else if (metodoPagamento.includes('Pix')) metodoCaixa = 'PIX';
                  await registrarVenda(totalFinal, metodoCaixa);
              }
          }
          addToast(vazia ? `Comanda vazia finalizada!` : `Comanda fechada com sucesso!`, 'success');
      }

      onClose(comandaAtual.id); 
    } catch (error) {
      addToast('Não foi possível fechar a comanda.', 'error');
    } finally {
      setCarregando(false);
      setShowConfirmaFechamento(false);
    }
  };

  const valorPagoFloat = parseFloat(valorPagamento.replace(',', '.')) || 0;
  const trocoDinheiro = valorPagoFloat > totalFinal ? valorPagoFloat - totalFinal : 0;
  const trocoMisto = totalMisto > totalFinal ? totalMisto - totalFinal : 0;

  useEffect(() => {
    if (mostrarPagamento && !valorPagamento && totalFinal > 0) {
      setValorPagamento(totalFinal.toFixed(2));
    }
  }, [mostrarPagamento, totalFinal, valorPagamento]);

  const modalFooter = (
    <div className="w-full flex items-center justify-between">
        {!mostrarPagamento ? (
            <>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handlePrint} 
                        className="p-2 text-white hover:text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors" 
                        title="Imprimir" 
                        disabled={subtotalComanda <= 0}
                    >
                        <Printer size={20} />
                    </button>
                    <div>
                        {taxaServico && (
                            <p className="text-xs text-blue-400 font-medium">Sub: R$ {subtotalComanda.toFixed(2)} + 10%</p>
                        )}
                        <p className="text-xs font-bold text-gray-400 uppercase">Total Final</p>
                        <p className="text-2xl font-black text-white">R$ {totalFinal.toFixed(2)}</p>
                    </div>
                </div>
                <button 
                    onClick={() => {
                        if (totalFinal <= 0) {
                            solicitarFechamento();
                        } else {
                            setMostrarPagamento(true);
                        }
                    }}
                    disabled={carregando}
                    className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                    <Banknote size={20} /> {totalFinal <= 0 ? 'Fechar Comanda Vazia' : 'Pagamento'}
                </button>
            </>
        ) : (
            <div className="w-full flex gap-3">
                 <button 
                    onClick={() => setMostrarPagamento(false)} 
                    className="px-4 py-3 border border-[#172554] text-white font-medium rounded-xl hover:bg-[#172554]"
                 >
                    Voltar
                 </button>
                 <button 
                    onClick={solicitarFechamento} 
                    disabled={carregando || (metodoPagamento === METODOS_PAGAMENTO_COMANDA.FIADO && !comandaAtual.cliente) || (metodoPagamento === METODOS_PAGAMENTO_COMANDA.MISTO && totalMisto < totalFinal)} 
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {carregando ? <Loader2 className="animate-spin" /> : <Receipt size={20} />} Confirmar Fechamento
                </button>
            </div>
        )}
    </div>
  );

  return (
    <>
      <div style={{ display: 'none' }}>
          <Comprovante ref={comprovanteRef} comanda={comandaAtual} taxaServico={taxaServico} />
      </div>

      <Modal title={`Comanda #${comandaAtual.numero}`} onClose={() => onClose()} footer={modalFooter} maxWidth="max-w-5xl">
        {loadingInicial ? (
             <div className="h-[500px] flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>Carregando itens...</p>
             </div>
        ) : (
            <div className="flex flex-col h-[600px]">
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[#172554]">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 text-blue-400 rounded-lg text-sm font-medium">
                        <User size={16} /> {comandaAtual.cliente?.nome || 'Consumidor Final'}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#172554] text-white rounded-lg text-sm font-medium">
                        <Clock size={16} /> Aberto às {formatTimeSafe(comandaAtual.criado_em)}
                    </div>
                </div>

                {!mostrarPagamento ? (
                    <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                        <div className="lg:w-1/2 flex flex-col h-full">
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                <input 
                                    type="text" 
                                    placeholder="Bipar código de barras ou buscar nome..." 
                                    className="w-full pl-10 pr-4 py-3 bg-black border border-[#172554] rounded-xl text-white focus:border-blue-500" 
                                    value={termoBusca} 
                                    onChange={(e) => setTermoBusca(e.target.value)} 
                                    onKeyDown={handleKeyDown} 
                                    autoFocus 
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                {produtosFiltrados.map(produto => {
                                    const semEstoque = produto.estoque <= 0;
                                    return (
                                        <button 
                                            key={produto.id} 
                                            onClick={() => adicionarProduto(produto)} 
                                            disabled={carregando || semEstoque} 
                                            className={`w-full flex items-center justify-between p-3 bg-[#0B1426] border border-[#172554] rounded-xl transition-all group text-left shadow-sm ${semEstoque ? 'opacity-40' : 'hover:border-blue-500'}`}
                                        >
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm text-white">{produto.nome}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <p className="text-xs text-blue-400 font-medium">R$ {produto.preco.toFixed(2)}</p>
                                                    <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${semEstoque ? 'bg-rose-900/30 text-rose-500 border-rose-900' : 'bg-emerald-900/30 text-emerald-500 border-emerald-900'}`}>
                                                        <Package size={10} /> {semEstoque ? 'Esgotado' : `${produto.estoque} un.`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg bg-[#172554] text-white flex items-center justify-center group-hover:bg-blue-600 transition-all">
                                                <Plus size={18} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="lg:w-1/2 flex flex-col h-full bg-[#0B1426] rounded-2xl border border-[#172554] overflow-hidden">
                            <div className="p-3 bg-[#172554] border-b border-[#1E3A8A] flex items-center justify-between">
                                <div className="font-bold text-white flex items-center gap-2">
                                    <ShoppingCart size={18} /> Itens
                                </div>
                                <button 
                                    onClick={() => setTaxaServico(!taxaServico)} 
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${taxaServico ? 'bg-blue-600 text-white border-blue-400' : 'bg-black text-gray-400 border-[#172554]'}`}
                                >
                                    <Percent size={12} /> 10%
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {comandaAtual.itens?.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                        <ShoppingCart size={40} className="mb-2 opacity-20" />
                                        <p className="text-sm">Nenhum item adicionado</p>
                                    </div>
                                ) : (
                                    comandaAtual.itens?.map(item => (
                                        <div key={item.id} className="bg-black p-3 rounded-xl border border-[#172554] flex items-center justify-between">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <p className="font-bold text-white text-sm truncate">{item.produto?.nome}</p>
                                                <p className="text-xs text-blue-400">Un: R$ {item.valor_unit.toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => alterarQuantidade(item.id, item.quantidade - 1, item.quantidade)} className="w-6 h-6 flex items-center justify-center bg-[#172554] text-white rounded hover:bg-blue-600">
                                                    <Minus size={14} />
                                                </button>
                                                <span className="w-6 text-center font-bold text-sm text-white">{item.quantidade}</span>
                                                <button onClick={() => alterarQuantidade(item.id, item.quantidade + 1, item.quantidade)} className="w-6 h-6 flex items-center justify-center bg-[#172554] text-white rounded hover:bg-blue-600">
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                            <div className="text-right ml-3 min-w-[60px]">
                                                <p className="font-bold text-emerald-500 text-sm">R$ {(item.quantidade * item.valor_unit).toFixed(2)}</p>
                                            </div>
                                            <button onClick={() => solicitarSenha((autorizador) => {
                                                    setQuemAutorizou(autorizador);
                                                    setModalConfirmaId(item.id);
                                                })} 
                                                className="ml-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-rose-500 rounded-lg"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 bg-[#172554] border-t border-[#1E3A8A] text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-300">Subtotal</span>
                                    <span className="font-semibold text-white">R$ {subtotalComanda.toFixed(2)}</span>
                                </div>
                                {taxaServico && (
                                    <div className="flex justify-between text-blue-400">
                                        <span className="font-medium">Taxa (10%)</span>
                                        <span className="font-bold">+ R$ {valorTaxa.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full animate-[fade-in_0.2s] overflow-y-auto custom-scrollbar pr-2">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <CreditCard className="text-blue-500" /> Selecione o Pagamento
                        </h3>
                        
                        <div className="grid grid-cols-5 gap-3 mb-6">
                            {[
                              { id: METODOS_PAGAMENTO_COMANDA.DINHEIRO, icon: Banknote, label: 'Dinheiro' }, 
                              { id: METODOS_PAGAMENTO_COMANDA.CARTAO, icon: CreditCard, label: 'Cartão' }, 
                              { id: METODOS_PAGAMENTO_COMANDA.PIX, icon: QrCode, label: 'PIX' },
                              { id: METODOS_PAGAMENTO_COMANDA.MISTO, icon: Wallet, label: 'Misto' },
                              { id: METODOS_PAGAMENTO_COMANDA.FIADO, icon: BookUser, label: 'Fiado' }
                            ].map(m => (
                                <button 
                                    key={m.id} 
                                    onClick={() => setMetodoPagamento(m.id)} 
                                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPagamento === m.id ? 'border-blue-500 bg-blue-900/30 text-blue-400 shadow-lg shadow-blue-900/20' : 'border-[#172554] bg-black text-white hover:border-blue-500'}`}
                                >
                                    <m.icon size={24} />
                                    <span className="font-bold text-xs uppercase text-center">{m.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="bg-black p-6 rounded-2xl border border-[#172554] mt-auto shadow-inner">
                            <div className="flex justify-between items-end mb-4 border-b border-[#172554] pb-4">
                                <label className="text-sm font-semibold text-gray-400">Total a Pagar</label>
                                <span className="text-3xl font-black text-white">R$ {totalFinal.toFixed(2)}</span>
                            </div>

                            {/* CONDICIONAL: DINHEIRO PADRÃO */}
                            {(metodoPagamento === METODOS_PAGAMENTO_COMANDA.DINHEIRO || metodoPagamento === METODOS_PAGAMENTO_COMANDA.CARTAO || metodoPagamento === METODOS_PAGAMENTO_COMANDA.PIX) && (
                                <div className="mt-4 animate-[fade-in_0.3s]">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Valor Recebido ({metodoPagamento})</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={valorPagamento} 
                                        onChange={(e) => setValorPagamento(e.target.value)} 
                                        className="w-full p-4 text-xl font-bold bg-[#0B1426] border border-[#172554] text-white rounded-xl focus:border-blue-500 outline-none" 
                                        placeholder="0.00" 
                                        autoFocus 
                                    />
                                    {metodoPagamento === METODOS_PAGAMENTO_COMANDA.DINHEIRO && trocoDinheiro > 0 && (
                                        <div className="flex justify-between items-center mt-4 p-4 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 rounded-xl">
                                            <span className="font-bold uppercase tracking-wider text-sm">Troco:</span>
                                            <span className="font-black text-2xl">R$ {trocoDinheiro.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* CONDICIONAL: MISTO */}
                            {metodoPagamento === METODOS_PAGAMENTO_COMANDA.MISTO && (
                                <div className="space-y-4 animate-[fade-in_0.3s]">
                                    <div className="flex items-center gap-4">
                                        <label className="text-gray-400 font-bold w-20">Dinheiro:</label>
                                        <input type="number" step="0.01" placeholder="0.00" value={mistoValores.DINHEIRO} onChange={e => setMistoValores({...mistoValores, DINHEIRO: e.target.value})} className="flex-1 p-3 bg-[#0B1426] border border-[#172554] text-white rounded-lg focus:border-blue-500 outline-none font-bold" />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <label className="text-gray-400 font-bold w-20">Cartão:</label>
                                        <input type="number" step="0.01" placeholder="0.00" value={mistoValores.CARTAO} onChange={e => setMistoValores({...mistoValores, CARTAO: e.target.value})} className="flex-1 p-3 bg-[#0B1426] border border-[#172554] text-white rounded-lg focus:border-blue-500 outline-none font-bold" />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <label className="text-gray-400 font-bold w-20">PIX:</label>
                                        <input type="number" step="0.01" placeholder="0.00" value={mistoValores.PIX} onChange={e => setMistoValores({...mistoValores, PIX: e.target.value})} className="flex-1 p-3 bg-[#0B1426] border border-[#172554] text-white rounded-lg focus:border-blue-500 outline-none font-bold" />
                                    </div>
                                    
                                    <div className="pt-4 border-t border-[#172554] flex justify-between items-center">
                                        <span className="text-gray-400 font-medium">Soma Inserida:</span>
                                        <span className={`text-xl font-black ${totalMisto >= totalFinal ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {totalMisto.toFixed(2)}</span>
                                    </div>
                                    
                                    {trocoMisto > 0 && parseFloat(mistoValores.DINHEIRO) > 0 && (
                                        <div className="flex justify-between items-center p-3 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 rounded-xl">
                                            <span className="font-bold uppercase tracking-wider text-sm">Troco (Dinheiro):</span>
                                            <span className="font-black text-xl">R$ {trocoMisto.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* CONDICIONAL: FIADO */}
                            {metodoPagamento === METODOS_PAGAMENTO_COMANDA.FIADO && (
                                <div className="mt-4 p-6 bg-blue-900/20 border border-blue-900/50 rounded-xl text-center animate-[fade-in_0.3s]">
                                    {comandaAtual.cliente ? (
                                        <>
                                            <BookUser size={40} className="text-blue-400 mx-auto mb-3 opacity-80" />
                                            <p className="text-lg font-bold text-white mb-1">Crediário Autorizado</p>
                                            <p className="text-sm text-gray-400">Esta venda será registrada como pendente para <strong>{comandaAtual.cliente.nome}</strong>.</p>
                                        </>
                                    ) : (
                                        <>
                                            <User size={40} className="text-rose-500 mx-auto mb-3 opacity-80" />
                                            <p className="text-lg font-bold text-rose-500 mb-1">Cliente não vinculado!</p>
                                            <p className="text-sm text-gray-400">Para vender fiado, você precisa associar esta comanda a um cliente cadastrado.</p>
                                        </>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        )}
      </Modal>

      <ModalSenha 
        isOpen={modalSenhaAberta} 
        onClose={() => setModalSenhaAberta(false)} 
        onSuccess={(usuario) => { if (acaoProtegida) acaoProtegida(usuario); }} 
      />

      <ConfirmacaoModal 
        isOpen={!!modalConfirmaId}
        onClose={() => {
            setModalConfirmaId(null);
            setQuemAutorizou(null); // Limpa caso cancele a lixeira
        }}
        onConfirm={removerItemConfirmado}
        title="Remover Item"
        message="Tem certeza que deseja remover este produto da comanda?"
        tipo="perigo"
        textoConfirmar="Remover"
      />

      <ConfirmacaoModal 
        isOpen={showConfirmaFechamento}
        onClose={() => setShowConfirmaFechamento(false)}
        onConfirm={() => fecharComandaConfirmado(false)}
        title="Confirmar"
        message={`Deseja confirmar a operação para a comanda #${comandaAtual.numero}?`}
        tipo="sucesso"
        textoConfirmar="Confirmar e Finalizar"
      />
    </>
  );
}