import React, { useState, useEffect } from 'react';
import { BookUser, Search, Calendar, ChevronDown, ChevronUp, CheckCircle, RefreshCcw, Loader2, Trash2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useToast } from '../contexts/ToastContext';
import { useCaixa } from '../contexts/CaixaContext';
import { crediarioService } from '../services/crediario';
import { logsService } from '../services/logs'; // <-- IMPORTAÇÃO DOS LOGS
import { Comanda, Cliente, ItemComanda } from '../types/index';
import { ModalPagamentoFiado } from './ModalPagamentoFiado';

import { ModalSenha } from '../components/Common/ModalSenha';
import { comandasService } from '../services/comandas';

interface GrupoCliente {
  cliente: Cliente;
  comandas: Comanda[];
  totalPendente: number;
}

export const Crediario: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [comandasFiadas, setComandasFiadas] = useState<Comanda[]>([]);
  const [busca, setBusca] = useState('');
  const [expandedClients, setExpandedClients] = useState<string[]>([]);
  
  const [comandaSelecionada, setComandaSelecionada] = useState<Comanda | null>(null);
  
  const [modalSenhaAberta, setModalSenhaAberta] = useState(false);
  const [comandaParaExcluir, setComandaParaExcluir] = useState<string | null>(null);

  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();
  const { caixaAberto } = useCaixa();

  useEffect(() => {
    carregarFiados();

    const handleUpdate = () => carregarFiados();
    window.addEventListener('focus', handleUpdate);
    window.addEventListener('sync_completed', handleUpdate);

    return () => {
      window.removeEventListener('focus', handleUpdate);
      window.removeEventListener('sync_completed', handleUpdate);
    };
  }, [isOnline]);

  const carregarFiados = async () => {
    setLoading(true);
    try {
      const dados = await crediarioService.listarFiados(isOnline);
      setComandasFiadas(dados || []);
    } catch (error) {
      console.error(error);
      addToast('Erro ao carregar crediários pendentes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const gruposClientes: Record<string, GrupoCliente> = comandasFiadas.reduce((acc: Record<string, GrupoCliente>, comanda: Comanda) => {
    if (!comanda.cliente) return acc;
    
    const clienteId = comanda.cliente.id;
    const totalComanda = comanda.itens?.reduce((sum: number, item: ItemComanda) => sum + (item.quantidade * item.valor_unit), 0) || 0;

    if (!acc[clienteId]) {
      acc[clienteId] = {
        cliente: comanda.cliente,
        comandas: [],
        totalPendente: 0
      };
    }
    
    acc[clienteId].comandas.push(comanda);
    acc[clienteId].totalPendente += totalComanda;
    
    return acc;
  }, {});

  const gruposArray: GrupoCliente[] = Object.values(gruposClientes);
  const gruposFiltrados: GrupoCliente[] = gruposArray.filter((grupo: GrupoCliente) => 
    grupo.cliente.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const BRL = (valor: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

  const handleFinalizarPagamento = async () => {
    await carregarFiados();
    addToast('Pagamento do fiado realizado com sucesso! Registro enviado para os relatórios.', 'success');
  };

  // <-- ATUALIZADO PARA RECEBER O USUÁRIO E GRAVAR O LOG -->
  const handleExcluirConfirmado = async (usuarioAutorizado: {id: string, nome: string}) => {
    if (!comandaParaExcluir) return;
    
    // Localiza a comanda antes de apagar para poder registrar os dados no Log
    const comandaCancelada = comandasFiadas.find(c => c.id === comandaParaExcluir);
    const totalDaComanda = comandaCancelada?.itens?.reduce((sum: number, item: ItemComanda) => sum + (item.quantidade * item.valor_unit), 0) || 0;

    try {
      await comandasService.cancelarComandaFechada(isOnline, comandaParaExcluir);
      
      // REGISTRO NO LOG DE AUDITORIA
      await logsService.registrar(
        usuarioAutorizado,
        'EXCLUIR_FIADO',
        `A conta pendente (Fiado) #${comandaCancelada?.numero || 'N/A'} do cliente "${comandaCancelada?.cliente?.nome || 'Desconhecido'}" no valor de R$ ${totalDaComanda.toFixed(2)} foi excluída e perdoada.`
      );

      addToast('Conta excluída e cancelada com sucesso.', 'success');
      await carregarFiados();
    } catch (error) {
      console.error(error);
      addToast('Erro ao tentar excluir a conta.', 'error');
    } finally {
      setComandaParaExcluir(null);
      setModalSenhaAberta(false);
    }
  };

  return (
    <div className="p-6 max-w-[1920px] mx-auto min-h-screen flex flex-col gap-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <BookUser className="text-rose-600" size={32} />
            Crediário e Fiados
          </h1>
          <p className="text-slate-500 mt-1">Gerencie as contas pendentes agrupadas por clientes.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all"
            />
          </div>
          <button 
            onClick={carregarFiados}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            title="Atualizar lista"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 size={48} className="text-rose-600 animate-spin mb-4" />
          <p className="text-slate-400 font-medium">Carregando contas pendentes...</p>
        </div>
      ) : gruposFiltrados.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl border border-slate-200 border-dashed">
          <CheckCircle size={64} className="text-emerald-500 mb-4 opacity-50" />
          <p className="text-xl font-medium text-slate-500">Nenhum fiado pendente!</p>
          <p className="text-slate-400">Todas as contas estão em dia.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {gruposFiltrados.map((grupo: GrupoCliente) => {
            const isExpanded = expandedClients.includes(grupo.cliente.id);

            return (
              <div key={grupo.cliente.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div 
                  className={`p-5 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : ''}`}
                  onClick={() => toggleClientExpand(grupo.cliente.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 font-bold text-xl">
                      {grupo.cliente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{grupo.cliente.nome}</h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                         {grupo.comandas.length} {grupo.comandas.length > 1 ? 'contas pendentes' : 'conta pendente'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 md:mt-0 flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-500 uppercase">Dívida Total</p>
                      <p className="text-2xl font-black text-rose-600">{BRL(grupo.totalPendente)}</p>
                    </div>
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 bg-slate-50/50">
                    <div className="space-y-4">
                      {grupo.comandas.map((comanda: Comanda) => {
                         const totalComanda = comanda.itens?.reduce((sum: number, item: ItemComanda) => sum + (item.quantidade * item.valor_unit), 0) || 0;
                         const dataAbertura = new Date(comanda.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

                         return (
                           <div key={comanda.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                             <div className="flex-1">
                               <div className="flex items-center gap-2 mb-2">
                                  <Calendar size={16} className="text-slate-400" />
                                  <span className="text-sm font-semibold text-slate-600">{dataAbertura}</span>
                                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">Pedido #{comanda.numero}</span>
                               </div>
                               <ul className="text-sm text-slate-600 space-y-1 ml-6 list-disc">
                                 {comanda.itens?.map((item: ItemComanda) => (
                                   <li key={item.id}>
                                      {item.quantidade}x {item.produto?.nome} - {BRL(item.valor_unit)}
                                   </li>
                                 ))}
                               </ul>
                             </div>
                             
                             <div className="flex flex-col items-end justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4 min-w-[150px]">
                                <p className="text-lg font-bold text-slate-800 mb-3">{BRL(totalComanda)}</p>
                                
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setComandaParaExcluir(comanda.id);
                                        setModalSenhaAberta(true);
                                      }}
                                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-all"
                                      title="Cancelar/Excluir Conta"
                                    >
                                      <Trash2 size={20} />
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!caixaAberto) {
                                          addToast('Abra o caixa antes de receber um pagamento!', 'error');
                                          return;
                                        }
                                        setComandaSelecionada(comanda);
                                      }}
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium transition-colors shadow-sm"
                                    >
                                      Receber
                                    </button>
                                </div>
                             </div>
                           </div>
                         );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {comandaSelecionada && (
        <ModalPagamentoFiado
          comanda={comandaSelecionada}
          isOpen={!!comandaSelecionada}
          onClose={() => setComandaSelecionada(null)}
          onConfirm={handleFinalizarPagamento}
        />
      )}

      <ModalSenha
        isOpen={modalSenhaAberta}
        onClose={() => {
            setModalSenhaAberta(false);
            setComandaParaExcluir(null);
        }}
        onSuccess={(usuario) => handleExcluirConfirmado(usuario)} // <-- PASSA O USUÁRIO PARA A FUNÇÃO
        titulo="Excluir Conta Fiado"
        mensagem="Selecione o usuário e digite a senha gerencial para apagar e perdoar esta conta do sistema permanentemente."
      />

    </div>
  );
};