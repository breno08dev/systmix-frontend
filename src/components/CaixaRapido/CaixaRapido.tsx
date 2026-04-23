// src/components/CaixaRapido/CaixaRapido.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShoppingCart, Search, CreditCard, Banknote, QrCode, CheckCircle, Package, Lock, Unlock, Loader2, Plus, Minus, Wallet, BookUser } from 'lucide-react';
import { produtosService } from '../../services/produtos';
import { comandasService } from '../../services/comandas'; 
import { clientesService } from '../../services/clientes';
import { useCaixa } from '../../contexts/CaixaContext';
import { useToast } from '../../contexts/ToastContext';
import { Produto, Cliente } from '../../types/index';
import { CaixaModal } from './CaixaModal';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { supabase } from '../../lib/supabaseClient';
import { db, localDatabaseService } from '../../lib/localDatabase';

interface ItemCarrinho extends Produto {
    quantidadeCarrinho: number;
}

export const CaixaRapido: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [valorRecebido, setValorRecebido] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('DINHEIRO');
  const [mistoValores, setMistoValores] = useState({ DINHEIRO: '', CARTAO: '', PIX: '' });
  
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [buscaClienteFiado, setBuscaClienteFiado] = useState('');
  
  const [processandoVenda, setProcessandoVenda] = useState(false);

  const { caixaAberto, registrarVenda } = useCaixa();
  const [modalCaixaOpen, setModalCaixaOpen] = useState(false);
  const [tipoModalCaixa, setTipoModalCaixa] = useState<'abertura' | 'fechamento'>('abertura');

  const { addToast } = useToast();
  const { isOnline } = useOnlineStatus();
  const inputBuscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarDadosBase();
  }, [isOnline]);

  useEffect(() => {
    if (caixaAberto && metodoPagamento !== 'FIADO') {
        inputBuscaRef.current?.focus();
    }
  }, [carrinho, caixaAberto, metodoPagamento]);

  const carregarDadosBase = async () => {
    try {
      const [dataProdutos, dataClientes] = await Promise.all([
          produtosService.listarAtivos(isOnline),
          clientesService.listar(isOnline)
      ]);
      setProdutos(dataProdutos);
      setClientes(dataClientes);
    } catch (error) {
      addToast('Erro ao carregar dados do sistema.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const produtosFiltrados = useMemo(() => {
    if (!termoBusca) return produtos; 
    const termo = termoBusca.toLowerCase();
    return produtos.filter(p => p.nome.toLowerCase().includes(termo) || p.codigo_barras?.includes(termo));
  }, [produtos, termoBusca]);

  const clientesFiadoFiltrados = useMemo(() => {
    if (!buscaClienteFiado.trim()) return [];
    const termo = buscaClienteFiado.toLowerCase().trim();
    return clientes.filter(c => 
      c.nome.toLowerCase().includes(termo) ||
      (c.telefone && c.telefone.includes(termo))
    );
  }, [clientes, buscaClienteFiado]);

  const getEstoqueAtual = (produto: Produto) => {
    const itemNoCarrinho = carrinho.find(item => item.id === produto.id);
    return produto.estoque - (itemNoCarrinho ? itemNoCarrinho.quantidadeCarrinho : 0);
  };

  const adicionarAoCarrinho = (produto: Produto) => {
    if (getEstoqueAtual(produto) <= 0) return addToast('Estoque insuficiente!', 'error');

    setCarrinho(prev => {
        const itemExistente = prev.find(item => item.id === produto.id);
        if (itemExistente) {
            return prev.map(item => item.id === produto.id ? { ...item, quantidadeCarrinho: item.quantidadeCarrinho + 1 } : item);
        }
        return [...prev, { ...produto, quantidadeCarrinho: 1 }];
    });
    inputBuscaRef.current?.focus();
  };

  const removerUmDoCarrinho = (produto: Produto) => {
    setCarrinho(prev => {
        const itemExistente = prev.find(item => item.id === produto.id);
        if (!itemExistente) return prev;
        if (itemExistente.quantidadeCarrinho > 1) {
            return prev.map(item => item.id === produto.id ? { ...item, quantidadeCarrinho: item.quantidadeCarrinho - 1 } : item);
        } else {
            return prev.filter(item => item.id !== produto.id);
        }
    });
    inputBuscaRef.current?.focus();
  };

  const totalVenda = useMemo(() => carrinho.reduce((acc, item) => acc + (item.preco * item.quantidadeCarrinho), 0), [carrinho]);
  
  const trocoDinheiro = useMemo(() => {
    const pago = parseFloat(valorRecebido.replace(',', '.')) || 0;
    return pago > totalVenda ? pago - totalVenda : 0;
  }, [valorRecebido, totalVenda]);

  const totalMisto = useMemo(() => {
    return (parseFloat(mistoValores.DINHEIRO.replace(',', '.')) || 0) + 
           (parseFloat(mistoValores.CARTAO.replace(',', '.')) || 0) + 
           (parseFloat(mistoValores.PIX.replace(',', '.')) || 0);
  }, [mistoValores]);

  const trocoMisto = totalMisto > totalVenda ? totalMisto - totalVenda : 0;

  const podeFinalizar = useMemo(() => {
      if (carrinho.length === 0 || processandoVenda) return false;
      if (metodoPagamento === 'FIADO' && !clienteSelecionado) return false;
      if (metodoPagamento === 'MISTO' && totalMisto < totalVenda) return false;
      return true;
  }, [carrinho, processandoVenda, metodoPagamento, clienteSelecionado, totalMisto, totalVenda]);

  const handleFinalizarVenda = async () => {
    if (!caixaAberto) return addToast('Caixa fechado.', 'error');
    if (!podeFinalizar) return;

    setProcessandoVenda(true);
    try {
        const numeroVenda = Math.floor(Math.random() * 90000) + 10000;
        const comanda = await comandasService.criarComanda(isOnline, numeroVenda, clienteSelecionado || undefined);
        
        for (const item of carrinho) {
            await comandasService.adicionarItem(isOnline, comanda.id, {
                id_produto: item.id,
                quantidade: item.quantidadeCarrinho,
                valor_unit: item.preco
            });
        }

        if (metodoPagamento === 'FIADO') {
            const dataFechamento = new Date().toISOString();
            if (isOnline && !comanda.id.startsWith('local_')) {
                await supabase.from('comandas').update({ status: 'fiado', fechado_em: dataFechamento }).eq('id', comanda.id);
            }
            await db.comandas.update(comanda.id, { status: 'fiado', fechado_em: dataFechamento } as any);
            await localDatabaseService.addPendingAction('ATUALIZAR_COMANDA_FIADO', { id: comanda.id, status: 'fiado', fechado_em: dataFechamento });
            
            addToast(`Venda lançada como fiado com sucesso!`, 'success');
        } else {
            let pagamentos = [];
            
            if (metodoPagamento === 'MISTO') {
                const valDinheiro = parseFloat(mistoValores.DINHEIRO.replace(',', '.'));
                const valPix = parseFloat(mistoValores.PIX.replace(',', '.'));
                const valCartao = parseFloat(mistoValores.CARTAO.replace(',', '.'));
                
                if (valDinheiro > 0) pagamentos.push({ metodo: 'DINHEIRO', valor: valDinheiro });
                if (valPix > 0) pagamentos.push({ metodo: 'PIX', valor: valPix });
                if (valCartao > 0) pagamentos.push({ metodo: 'CARTAO', valor: valCartao });
                
                if (valDinheiro > 0) await registrarVenda(valDinheiro, 'DINHEIRO');
                if (valPix > 0) await registrarVenda(valPix, 'PIX');
                if (valCartao > 0) await registrarVenda(valCartao, 'CARTAO');
            } else {
                pagamentos.push({ metodo: metodoPagamento, valor: totalVenda });
                await registrarVenda(totalVenda, metodoPagamento);
            }

            await comandasService.fecharComanda(isOnline, comanda.id, pagamentos);
            
            const trocoFinal = metodoPagamento === 'MISTO' ? trocoMisto : trocoDinheiro;
            addToast(`Venda finalizada! ${trocoFinal > 0 ? `Troco: R$ ${trocoFinal.toFixed(2)}` : ''}`, 'success');
        }
        
        await carregarDadosBase(); 
        setCarrinho([]);
        setValorRecebido('');
        setMistoValores({ DINHEIRO: '', CARTAO: '', PIX: '' });
        setClienteSelecionado('');
        setBuscaClienteFiado('');
        setMetodoPagamento('DINHEIRO');
        setTermoBusca('');

    } catch (error: any) {
        console.error(error);
        addToast(error.message || 'Erro ao processar venda.', 'error');
    } finally {
        setProcessandoVenda(false);
    }
  };

  // LOGICA DO LEITOR FÍSICO MELHORADA AQUI
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        if (produtosFiltrados.length === 1) {
            adicionarAoCarrinho(produtosFiltrados[0]);
            setTermoBusca(''); // Limpa a tela pro leitor bipar o próximo!
        } else if (produtosFiltrados.length === 0 && termoBusca.trim().length > 0) {
            addToast('Produto não encontrado.', 'error');
            setTermoBusca(''); // Limpa mesmo com erro para não travar o leitor
        }
    }
  };

  if (!caixaAberto) {
      return (
          <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center text-slate-500">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                  <Lock size={48} className="text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Caixa Fechado</h2>
              <p className="mb-8">Abra o caixa para iniciar as vendas.</p>
              <button 
                onClick={() => { setTipoModalCaixa('abertura'); setModalCaixaOpen(true); }} 
                className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 flex items-center gap-3 transition-all transform hover:scale-105"
              >
                  <Unlock size={24} /> Abrir Caixa
              </button>
              <CaixaModal isOpen={modalCaixaOpen} onClose={() => setModalCaixaOpen(false)} tipo={tipoModalCaixa} />
          </div>
      );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-30px)] gap-4 p-4 max-w-[1920px] mx-auto overflow-hidden">
      
      <div className="lg:w-2/3 flex flex-col gap-4 h-full">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 shrink-0">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ShoppingCart className="text-indigo-600" size={24} /> Frente de Caixa
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                            Operador: {caixaAberto.operador?.split('@')[0] || 'Admin'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => { setTipoModalCaixa('fechamento'); setModalCaixaOpen(true); }} 
                    className="px-4 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                >
                    <Lock size={16} /> Fechar Caixa
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    ref={inputBuscaRef} 
                    type="text" 
                    placeholder="Bipar código de barras ou buscar nome..." 
                    className="w-full pl-12 pr-4 py-3 text-lg border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm outline-none" 
                    value={termoBusca} 
                    onChange={(e) => setTermoBusca(e.target.value)} 
                    onKeyDown={handleKeyDown} 
                    autoFocus 
                />
            </div>
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 overflow-hidden flex flex-col">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 px-1 shrink-0">
                <Package size={18} /> {termoBusca ? 'Resultados da Busca' : 'Catálogo de Produtos'}
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start pb-4">
                    {(termoBusca ? produtosFiltrados : produtos).map(produto => {
                        const estoqueAtual = getEstoqueAtual(produto);
                        const qtdNoCarrinho = carrinho.find(i => i.id === produto.id)?.quantidadeCarrinho || 0;
                        const esgotado = estoqueAtual <= 0;

                        return (
                            <button 
                                key={produto.id} 
                                onClick={() => !esgotado && adicionarAoCarrinho(produto)} 
                                disabled={esgotado} 
                                className={`
                                    relative p-4 rounded-xl border text-left transition-all group overflow-hidden flex flex-col h-[140px] justify-between 
                                    ${esgotado ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-indigo-500 hover:shadow-md hover:shadow-indigo-500/10 hover:-translate-y-0.5'} 
                                    ${qtdNoCarrinho > 0 ? 'ring-1 ring-indigo-500 border-indigo-500 bg-indigo-50/10' : ''}
                                `}
                            >
                                <div className="w-full">
                                    <span className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight mb-1">{produto.nome}</span>
                                    <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase tracking-wider">
                                        {typeof produto.categoria === 'string' ? produto.categoria : (produto.categoria?.nome || 'Geral')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end w-full mt-auto pt-2 border-t border-slate-50">
                                    <span className="font-black text-emerald-600 text-lg">R$ {produto.preco.toFixed(2)}</span>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${estoqueAtual < 5 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {estoqueAtual} un
                                    </span>
                                </div>
                                {qtdNoCarrinho > 0 && <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-md">{qtdNoCarrinho}</div>}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>

      <div className="lg:w-1/3 flex flex-col bg-slate-900 rounded-2xl shadow-2xl overflow-hidden text-white h-full border border-slate-800">
        <div className="p-5 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center shrink-0">
            <span className="font-bold text-slate-300 text-sm uppercase tracking-wider">Cupom de Venda</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded">{carrinho.length} Itens</span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar-dark space-y-2">
            {carrinho.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                    <ShoppingCart size={48} className="mb-3" />
                    <p className="text-sm font-medium">Caixa Livre</p>
                </div>
            ) : (
                carrinho.map((item, index) => {
                    const estoqueAtual = getEstoqueAtual(item); 
                    return (
                        <div key={`${item.id}-${index}`} className="group flex flex-col p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all gap-2">
                            <div className="flex justify-between items-start">
                                <p className="font-medium truncate text-slate-200 text-sm flex-1 mr-2">{item.nome}</p>
                                <p className="font-bold text-emerald-400 text-sm whitespace-nowrap">R$ {(item.quantidadeCarrinho * item.preco).toFixed(2)}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-400">Unit: R$ {item.preco.toFixed(2)}</div>
                                <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); removerUmDoCarrinho(item); }} 
                                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded transition-colors"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="mx-3 font-bold text-sm min-w-[20px] text-center text-white">{item.quantidadeCarrinho}</span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); adicionarAoCarrinho(item); }} 
                                        disabled={estoqueAtual <= 0} 
                                        className={`p-1 rounded transition-colors ${estoqueAtual <= 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10'}`}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>

        <div className="bg-slate-800 p-5 border-t border-slate-700 shrink-0">
            <div className="space-y-1 mb-5">
                <div className="flex justify-between text-slate-400 text-xs"><span>Subtotal</span><span>R$ {totalVenda.toFixed(2)}</span></div>
                <div className="flex justify-between items-end pt-2 border-t border-slate-700/50">
                    <span className="text-lg font-bold text-slate-200">Total a Pagar</span>
                    <span className="text-3xl font-black text-emerald-400 tracking-tight">R$ {totalVenda.toFixed(2)}</span>
                </div>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-4">
                {[
                    { id: 'DINHEIRO', icon: Banknote, label: 'Dinh.' },
                    { id: 'CARTAO', icon: CreditCard, label: 'Cartão' },
                    { id: 'PIX', icon: QrCode, label: 'PIX' },
                    { id: 'MISTO', icon: Wallet, label: 'Misto' },
                    { id: 'FIADO', icon: BookUser, label: 'Fiado' }
                ].map(m => (
                    <button
                        key={m.id}
                        onClick={() => setMetodoPagamento(m.id)}
                        className={`flex flex-col items-center justify-center py-2.5 rounded-lg border transition-all ${metodoPagamento === m.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                    >
                        <m.icon size={18} className="mb-1" />
                        <span className="text-[9px] font-bold uppercase">{m.label}</span>
                    </button>
                ))}
            </div>

            {metodoPagamento === 'DINHEIRO' && (
                <div className="mb-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600 animate-[fade-in_0.2s]">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase">Recebido:</span>
                        <div className="relative flex-1">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                            <input 
                                type="number" 
                                step="0.01" 
                                value={valorRecebido} 
                                onChange={(e) => setValorRecebido(e.target.value)} 
                                className="w-full pl-6 bg-transparent border-b border-slate-500 text-white font-bold text-lg focus:border-emerald-500 focus:outline-none transition-colors" 
                                placeholder="0.00" 
                            />
                        </div>
                    </div>
                    {trocoDinheiro > 0 && (
                        <div className="mt-2 flex justify-between items-center text-emerald-400 pt-2 border-t border-slate-600/50">
                            <span className="text-xs font-bold uppercase">Troco:</span><span className="text-lg font-black">R$ {trocoDinheiro.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            )}

            {metodoPagamento === 'MISTO' && (
                <div className="mb-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600 animate-[fade-in_0.2s] space-y-2">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 font-bold w-16">Dinh:</label>
                        <input type="number" step="0.01" placeholder="0.00" value={mistoValores.DINHEIRO} onChange={e => setMistoValores({...mistoValores, DINHEIRO: e.target.value})} className="flex-1 bg-slate-800 border border-slate-600 rounded p-1 text-white text-sm outline-none" />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 font-bold w-16">Cartão:</label>
                        <input type="number" step="0.01" placeholder="0.00" value={mistoValores.CARTAO} onChange={e => setMistoValores({...mistoValores, CARTAO: e.target.value})} className="flex-1 bg-slate-800 border border-slate-600 rounded p-1 text-white text-sm outline-none" />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 font-bold w-16">PIX:</label>
                        <input type="number" step="0.01" placeholder="0.00" value={mistoValores.PIX} onChange={e => setMistoValores({...mistoValores, PIX: e.target.value})} className="flex-1 bg-slate-800 border border-slate-600 rounded p-1 text-white text-sm outline-none" />
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-slate-600 mt-2">
                        <span className="text-xs font-medium text-slate-400">Total Inserido:</span>
                        <span className={`text-sm font-bold ${totalMisto >= totalVenda ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {totalMisto.toFixed(2)}</span>
                    </div>
                </div>
            )}

            {metodoPagamento === 'FIADO' && (
                <div className="mb-4 p-4 bg-blue-900/20 rounded-xl border border-blue-900/50 animate-[fade-in_0.2s]">
                    {!clienteSelecionado ? (
                        <>
                            <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Buscar Cliente</label>
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Nome ou telefone..."
                                    value={buscaClienteFiado}
                                    onChange={(e) => setBuscaClienteFiado(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 text-white rounded-lg focus:border-blue-500 outline-none text-sm"
                                />
                            </div>
                            <div className="max-h-32 overflow-y-auto custom-scrollbar-dark bg-slate-900 rounded-lg border border-slate-700">
                                {buscaClienteFiado.trim() === '' ? (
                                    <p className="text-xs text-slate-500 text-center py-3">Digite para buscar...</p>
                                ) : clientesFiadoFiltrados.length === 0 ? (
                                    <p className="text-xs text-slate-500 text-center py-3">Nenhum cliente encontrado.</p>
                                ) : (
                                    clientesFiadoFiltrados.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setClienteSelecionado(c.id)}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-b border-slate-700/50 last:border-0"
                                        >
                                            {c.nome} {c.telefone ? `- ${c.telefone}` : ''}
                                        </button>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-2">
                            <BookUser size={32} className="text-blue-400 mx-auto mb-2 opacity-80" />
                            <p className="text-sm font-bold text-white mb-1">
                                {clientes.find(c => c.id === clienteSelecionado)?.nome}
                            </p>
                            <p className="text-xs text-slate-400 mb-3">Cliente vinculado para o fiado.</p>
                            <button
                                onClick={() => setClienteSelecionado('')}
                                className="text-xs font-bold px-3 py-1.5 bg-slate-800 rounded-lg text-rose-400 hover:bg-slate-700 hover:text-rose-300 transition-colors border border-slate-600"
                            >
                                Trocar Cliente
                            </button>
                        </div>
                    )}
                </div>
            )}

            <button
                onClick={handleFinalizarVenda}
                disabled={!podeFinalizar}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-emerald-500/20 disabled:shadow-none transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]"
            >
                {processandoVenda ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                FINALIZAR VENDA
            </button>
        </div>
      </div>

      <CaixaModal isOpen={modalCaixaOpen} onClose={() => setModalCaixaOpen(false)} tipo={tipoModalCaixa} />
    </div>
  );
};