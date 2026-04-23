// src/components/Historico/Historico.tsx
import { useEffect, useState } from 'react';
import { useCaixa } from '../../contexts/CaixaContext';
import { comandasService } from '../../services/comandas';
import { sangriasService } from '../../services/sangrias';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { History, XCircle, ArrowDownCircle, PlusCircle, Receipt, Wallet, CreditCard, Banknote, QrCode, BookUser, RefreshCcw } from 'lucide-react';
import { ModalSenha } from '../Common/ModalSenha';
import Modal from '../Shared/Modal';
import { useToast } from '../../contexts/ToastContext';
import { Comanda, Sangria, ItemComanda } from '../../types'; 

type ItemHistorico = (Comanda & { tipo: 'venda' }) | (Sangria & { tipo: 'sangria' });

export const Historico = () => {
  const { caixaAberto } = useCaixa();
  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();
  
  const [itens, setItens] = useState<ItemHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [modalSenhaAberta, setModalSenhaAberta] = useState(false);
  const [acaoProtegida, setAcaoProtegida] = useState<(() => void) | null>(null);

  const [modalSangriaAberta, setModalSangriaAberta] = useState(false);
  const [valorSangria, setValorSangria] = useState('');
  const [motivoSangria, setMotivoSangria] = useState('');

  useEffect(() => {
    carregarHistorico();

    const handleUpdate = () => carregarHistorico();
    window.addEventListener('focus', handleUpdate);
    window.addEventListener('sync_completed', handleUpdate);

    return () => {
      window.removeEventListener('focus', handleUpdate);
      window.removeEventListener('sync_completed', handleUpdate);
    };
  }, [caixaAberto, isOnline]);

  const carregarHistorico = async () => {
    if (!caixaAberto) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      const [vendas, sangrias] = await Promise.all([
        comandasService.listarFechadasTurno(isOnline, caixaAberto.data_abertura),
        sangriasService.listarPorTurno(isOnline, caixaAberto.data_abertura)
      ]);

      const vendasFormatadas = vendas.map(v => ({ ...v, tipo: 'venda' as const }));
      const sangriasFormatadas = sangrias.map(s => ({ ...s, tipo: 'sangria' as const }));

      const listaMista = [...vendasFormatadas, ...sangriasFormatadas].sort((a, b) => {
        const dataA = a.tipo === 'venda' ? (a.fechado_em || '') : a.data;
        const dataB = b.tipo === 'venda' ? (b.fechado_em || '') : b.data;
        return dataB.localeCompare(dataA);
      });

      setItens(listaMista);
    } catch (error) {
      console.error(error);
      addToast('Erro ao carregar o histórico.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const solicitarSenha = (acao: () => void) => {
    setAcaoProtegida(() => acao);
    setModalSenhaAberta(true);
  };

  const handleCancelarVenda = async (id: string) => {
    try {
      await comandasService.cancelarComandaFechada(isOnline, id);
      addToast('Venda cancelada com sucesso!', 'success');
      carregarHistorico();
    } catch (err) {
      addToast('Erro ao cancelar venda.', 'error');
    }
  };

  const handleExcluirSangria = async (id: string) => {
    try {
      await sangriasService.excluir(isOnline, id);
      addToast('Sangria excluída com sucesso!', 'success');
      carregarHistorico();
    } catch (err) {
      addToast('Erro ao excluir sangria.', 'error');
    }
  };

  const handleSalvarSangria = async () => {
    const valorNum = parseFloat(valorSangria);
    if (isNaN(valorNum) || valorNum <= 0) return addToast('Informe um valor válido.', 'error');
    if (!motivoSangria.trim()) return addToast('Informe o motivo da sangria.', 'error');

    try {
      await sangriasService.criar(isOnline, valorNum, motivoSangria);
      addToast('Sangria registrada com sucesso!', 'success');
      setModalSangriaAberta(false);
      setValorSangria('');
      setMotivoSangria('');
      carregarHistorico();
    } catch (error) {
      addToast('Erro ao registrar sangria.', 'error');
    }
  };

  const getPaymentIcon = (metodo: string) => {
    const m = (metodo || '').toUpperCase();
    if (m.includes('PIX')) return <QrCode size={14} className="text-cyan-400" />;
    if (m.includes('CART')) return <CreditCard size={14} className="text-purple-400" />;
    return <Banknote size={14} className="text-emerald-400" />;
  };

  return (
    <div className="p-6 max-w-[1920px] mx-auto min-h-screen flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <History className="text-blue-500" size={32} /> Histórico do Turno
          </h1>
          <p className="text-gray-400 mt-1">Veja todas as vendas e movimentações concluídas no turno.</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={carregarHistorico}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700"
            title="Atualizar lista"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>

          <button 
            onClick={() => setModalSangriaAberta(true)}
            disabled={!caixaAberto}
            className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all disabled:opacity-50"
          >
            <PlusCircle size={20} /> Nova Sangria
          </button>
        </div>
      </div>

      <div className="bg-[#0B1426] border border-[#172554] rounded-2xl p-4 flex-1 shadow-lg">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-blue-500">
             <RefreshCcw size={40} className="animate-spin mb-4" />
             <p className="text-gray-400 font-medium">Sincronizando histórico...</p>
          </div>
        ) : !caixaAberto ? (
          <p className="text-rose-400 text-center py-10 font-medium">O caixa está fechado. Abra o caixa para ver o histórico do turno.</p>
        ) : itens.length === 0 ? (
          <p className="text-gray-400 text-center py-10">Nenhuma movimentação realizada neste turno ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {itens.map((item) => {
               
               if (item.tipo === 'venda') {
                 const pagamentos = item.pagamentos || [];
                 const total = pagamentos.reduce((acc, p) => acc + Number(p.valor), 0);
                 const isMisto = pagamentos.length > 1;
                 
                 // CORREÇÃO INFALÍVEL: Procura a "etiqueta" física no banco de dados. 
                 const isFiadoRecebido = pagamentos.some(p => p.metodo.toUpperCase().includes('FIADO'));

                 return (
                   <div key={item.id} className="bg-black/50 border border-[#172554] p-5 rounded-xl flex flex-col gap-4 shadow-sm hover:border-blue-500/50 transition-colors">
                     
                     <div className="flex justify-between items-start">
                       <div>
                         <p className="text-white font-bold text-lg flex items-center gap-2">
                           <Receipt size={16} className="text-emerald-500"/> Comanda #{item.numero}
                         </p>
                         <p className="text-gray-400 text-xs mt-1">
                           {new Date(item.fechado_em || '').toLocaleTimeString('pt-BR')} - {item.cliente?.nome || 'Consumidor Final'}
                         </p>
                         
                         <div className="flex gap-2 mt-2">
                            {isMisto && (
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 bg-blue-900/30 text-blue-400 border border-blue-900 rounded">
                                <Wallet size={12}/> Pagamento Misto
                              </span>
                            )}
                            {isFiadoRecebido && (
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 bg-indigo-900/30 text-indigo-400 border border-indigo-900 rounded">
                                <BookUser size={12}/> Conta Antiga (Fiado)
                              </span>
                            )}
                         </div>
                       </div>
                       <p className="text-emerald-400 font-black text-lg">+ R$ {total.toFixed(2)}</p>
                     </div>
                     
                     <div className="bg-[#050A15] border border-[#172554] rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar-dark text-sm">
                       {item.itens?.map((i: ItemComanda) => (
                         <div key={i.id} className="flex justify-between text-gray-300 mb-1">
                           <span>{i.quantidade}x {i.produto?.nome}</span>
                         </div>
                       ))}
                     </div>

                     {pagamentos.length > 0 && (
                        <div className="pt-3 border-t border-[#172554]">
                          <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Forma de Pagamento</p>
                          <div className="flex flex-wrap gap-2">
                            {pagamentos.map((p, idx) => {
                              // Tira a palavra "FIADO_" para ficar bonito na tela (Ex: PIX ao invés de FIADO_PIX)
                              const metodoLimpo = p.metodo.replace('FIADO_', ''); 
                              return (
                                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#050A15] border border-[#172554] text-gray-300 text-xs font-medium">
                                  {getPaymentIcon(metodoLimpo)}
                                  <span>{metodoLimpo}</span>
                                  <span className="font-bold text-white ml-1">R$ {Number(p.valor).toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                     )}
  
                     <button 
                       onClick={() => solicitarSenha(() => handleCancelarVenda(item.id))}
                       className="mt-auto w-full pt-3 mt-2 text-rose-500 hover:text-rose-400 transition-colors flex items-center justify-center gap-2 font-medium text-sm border-t border-[#172554]"
                     >
                       <XCircle size={16} /> Estornar Venda
                     </button>
                   </div>
                 )
               }
               
               if (item.tipo === 'sangria') {
                 return (
                   <div key={item.id} className="bg-rose-900/10 border border-rose-900/30 p-5 rounded-xl flex flex-col gap-4 shadow-sm hover:border-rose-500/50 transition-colors">
                     <div className="flex justify-between items-start">
                       <div>
                         <p className="text-white font-bold text-lg flex items-center gap-2"><ArrowDownCircle size={16} className="text-rose-500"/> Retirada (Sangria)</p>
                         <p className="text-rose-300/70 text-xs mt-1">
                           {new Date(item.data).toLocaleTimeString('pt-BR')}
                         </p>
                       </div>
                       <p className="text-rose-500 font-black text-lg">- R$ {Number(item.valor).toFixed(2)}</p>
                     </div>
                     
                     <div className="bg-[#050A15] border border-rose-900/30 rounded-lg p-4 flex-1">
                       <p className="text-rose-200 text-sm italic">"{item.motivo}"</p>
                     </div>
  
                     <button 
                       onClick={() => solicitarSenha(() => handleExcluirSangria(item.id))}
                       className="mt-auto w-full pt-3 mt-2 text-gray-500 hover:text-rose-500 transition-colors flex items-center justify-center gap-2 font-medium text-sm border-t border-rose-900/30"
                     >
                       <XCircle size={16} /> Excluir Registro
                     </button>
                   </div>
                 )
               }
            })}
          </div>
        )}
      </div>

      <ModalSenha 
        isOpen={modalSenhaAberta} 
        onClose={() => setModalSenhaAberta(false)} 
        onSuccess={() => { if (acaoProtegida) acaoProtegida(); }} 
        titulo="Ação Protegida"
        mensagem="Digite a senha gerencial para excluir este registro."
      />

      {modalSangriaAberta && (
        <Modal title="Registrar Sangria" onClose={() => setModalSangriaAberta(false)} maxWidth="max-w-md">
          <div className="space-y-4">
            <p className="text-gray-400 text-sm mb-4">A sangria irá deduzir o valor informado do fechamento do caixa (Dinheiro).</p>
            <div>
              <label className="block text-sm font-medium text-blue-300 mb-1">Valor a Retirar (R$)</label>
              <input 
                type="number" 
                step="0.01"
                value={valorSangria}
                onChange={e => setValorSangria(e.target.value)}
                placeholder="Ex: 150.00"
                className="w-full text-xl py-3 px-4 font-bold"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-300 mb-1">Motivo / Observação</label>
              <input 
                type="text" 
                value={motivoSangria}
                onChange={e => setMotivoSangria(e.target.value)}
                placeholder="Ex: Pagamento fornecedor, Retirada do chefe..."
                className="w-full py-3 px-4"
              />
            </div>
            <button 
              onClick={handleSalvarSangria}
              className="w-full mt-4 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-[0_0_15px_rgba(225,29,72,0.4)]"
            >
              Confirmar Retirada
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};