// src/components/Historico/Historico.tsx
import  { useEffect, useState } from 'react';
import { useCaixa } from '../../contexts/CaixaContext';
import { comandasService } from '../../services/comandas';
import { sangriasService } from '../../services/sangrias';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { History, XCircle, ArrowDownCircle, PlusCircle, Receipt } from 'lucide-react';
import { ModalSenha } from '../Common/ModalSenha';
import Modal from '../Shared/Modal';
import { useToast } from '../../contexts/ToastContext';
// CORREÇÃO: Importamos Comanda, Sangria e ItemComanda diretamente dos types globais
import { Comanda, Sangria, ItemComanda } from '../../types'; 

type ItemHistorico = (Comanda & { tipo: 'venda' }) | (Sangria & { tipo: 'sangria' });

export const Historico = () => {
  const { caixaAberto } = useCaixa();
  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();
  
  const [itens, setItens] = useState<ItemHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle Modal de Senha
  const [modalSenhaAberta, setModalSenhaAberta] = useState(false);
  const [acaoProtegida, setAcaoProtegida] = useState<(() => void) | null>(null);

  // Controle Modal Nova Sangria
  const [modalSangriaAberta, setModalSangriaAberta] = useState(false);
  const [valorSangria, setValorSangria] = useState('');
  const [motivoSangria, setMotivoSangria] = useState('');

  useEffect(() => {
    carregarHistorico();
  }, [caixaAberto]);

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

      // Junta as duas listas e ordena pela data mais recente
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

  return (
    <div className="p-6 max-w-[1920px] mx-auto min-h-screen flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <History className="text-blue-500" size={32} /> Histórico do Turno
          </h1>
          <p className="text-gray-400 mt-1">Veja todas as vendas e movimentações concluídas no turno.</p>
        </div>
        
        <button 
          onClick={() => setModalSangriaAberta(true)}
          disabled={!caixaAberto}
          className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all disabled:opacity-50"
        >
          <PlusCircle size={20} /> Nova Sangria
        </button>
      </div>

      <div className="bg-[#0B1426] border border-[#172554] rounded-2xl p-4 flex-1 shadow-lg">
        {loading ? (
          <p className="text-gray-400 text-center py-10 animate-pulse">Carregando histórico...</p>
        ) : !caixaAberto ? (
          <p className="text-rose-400 text-center py-10 font-medium">O caixa está fechado. Abra o caixa para ver o histórico do turno.</p>
        ) : itens.length === 0 ? (
          <p className="text-gray-400 text-center py-10">Nenhuma movimentação realizada neste turno ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {itens.map((item) => {
               
               // === RENDERIZAÇÃO DE VENDA ===
               if (item.tipo === 'venda') {
                 // @ts-ignore
                 const total = item.pagamentos?.reduce((acc, p) => acc + Number(p.valor), 0) || 0;
                 return (
                   <div key={item.id} className="bg-black/50 border border-[#172554] p-5 rounded-xl flex flex-col gap-4 shadow-sm hover:border-blue-500/50 transition-colors">
                     <div className="flex justify-between items-start">
                       <div>
                         <p className="text-white font-bold text-lg flex items-center gap-2"><Receipt size={16} className="text-emerald-500"/> Comanda #{item.numero}</p>
                         <p className="text-gray-400 text-xs mt-1">
                           {new Date(item.fechado_em || '').toLocaleTimeString('pt-BR')} - {item.cliente?.nome || 'Consumidor Final'}
                         </p>
                       </div>
                       <p className="text-emerald-400 font-black text-lg">+ R$ {total.toFixed(2)}</p>
                     </div>
                     
                     <div className="bg-[#050A15] border border-[#172554] rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar-dark text-sm">
                       {/* CORREÇÃO: Adicionado a tipagem (i: ItemComanda) */}
                       {item.itens?.map((i: ItemComanda) => (
                         <div key={i.id} className="flex justify-between text-gray-300 mb-1">
                           <span>{i.quantidade}x {i.produto?.nome}</span>
                         </div>
                       ))}
                     </div>
  
                     <button 
                       onClick={() => solicitarSenha(() => handleCancelarVenda(item.id))}
                       className="mt-auto w-full py-2.5 bg-rose-900/20 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-900/50 rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
                     >
                       <XCircle size={18} /> Estornar Venda
                     </button>
                   </div>
                 )
               }
               
               // === RENDERIZAÇÃO DE SANGRIA ===
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
                       className="mt-auto w-full py-2.5 text-gray-500 hover:text-rose-500 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
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

      {/* MODAL DE SENHA PARA ESTORNOS E EXCLUSÕES */}
      <ModalSenha 
        isOpen={modalSenhaAberta} 
        onClose={() => setModalSenhaAberta(false)} 
        onSuccess={() => { if (acaoProtegida) acaoProtegida(); }} 
        titulo="Ação Protegida"
        mensagem="Digite a senha gerencial para excluir este registro."
      />

      {/* MODAL PARA NOVA SANGRIA */}
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