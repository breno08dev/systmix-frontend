import React, { useState, useEffect } from 'react';
import { Receipt, Package, Users, TrendingUp, Eye, EyeOff, Clock } from 'lucide-react';
import { comandasService } from '../../services/comandas';
import { produtosService } from '../../services/produtos';
import { clientesService } from '../../services/clientes';
import { relatoriosService } from '../../services/relatorios'; 
import { Comanda } from '../../types';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useSync } from '../../contexts/SyncContext';
import { useToast } from '../../contexts/ToastContext';
import { useCaixa } from '../../contexts/CaixaContext';

// CORREÇÃO: Aceita 'any' para evitar erro de tipo se vier null/Date/string
const formatTimeSafe = (dateValue: any) => {
  if (!dateValue) return '--:--';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    comandasAbertas: 0,
    totalProdutos: 0,
    totalClientes: 0,
    faturamentoDia: 0
  });
  const [comandasRecentes, setComandasRecentes] = useState<Comanda[]>([]);
  const [faturamentoVisivel, setFaturamentoVisivel] = useState(false);
  
  const { isOnline } = useOnlineStatus();
  const { isSyncing } = useSync();
  const { addToast } = useToast();
  const { caixaAberto, caixaSession } = useCaixa(); 

  useEffect(() => {
    carregarDados();
  }, [isOnline, isSyncing, caixaAberto]); 

  const carregarDados = async () => {
    if (!caixaAberto || !caixaSession) {
      setStats({ comandasAbertas: 0, totalProdutos: 0, totalClientes: 0, faturamentoDia: 0 });
      setComandasRecentes([]);
      return; 
    }

    try {
      // MANTIDA LÓGICA ORIGINAL EXATA
      const dataInicio = caixaSession.data_abertura;
      const dataFim = new Date().toISOString(); 

      const [comandas, produtos, clientes, relatorioHoje] = await Promise.all([
        comandasService.listarAbertas(isOnline),
        produtosService.listar(isOnline),
        clientesService.listar(isOnline),
        isOnline ? relatoriosService.obterVendasPorPeriodo(dataInicio, dataFim) : Promise.resolve(null)
      ]);
      
      setStats({
        comandasAbertas: comandas.length,
        totalProdutos: produtos.filter(p => p.ativo).length,
        totalClientes: clientes.length,
        faturamentoDia: relatorioHoje?.total_vendas || 0
      });

      // Ordenação mantendo a lógica de data
      const comandasOrdenadas = comandas.sort((a, b) => 
        new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
      );
      setComandasRecentes(comandasOrdenadas.slice(0, 5));

    } catch (error: any) {
      console.error('Erro ao carregar dados do dashboard:', error);
      addToast(error.message || 'Erro ao carregar dashboard', 'error');
    }
  };

  // Componente de Card Atualizado
  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    bg: string;
    onToggleVisibility?: () => void;
    isVisibilityToggleable?: boolean;
  }> = ({ title, value, icon: Icon, color, bg, onToggleVisibility, isVisibilityToggleable }) => (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${bg} transition-colors group-hover:scale-110 duration-300`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        {isVisibilityToggleable && (
          <button onClick={onToggleVisibility} className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-50">
            {faturamentoVisivel ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-full">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Visão Geral</h1>
          <p className="text-slate-500">Acompanhe o desempenho do seu estabelecimento em tempo real.</p>
        </div>
        
        {caixaAberto && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Caixa Aberto
          </div>
        )}
      </div>

      {!caixaAberto && (
        <div className="bg-white border-l-4 border-amber-500 shadow-sm rounded-r-xl p-6 mb-8 flex items-start gap-4">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Receipt size={24} />
            </div>
            <div>
                <h3 className="font-bold text-gray-900 text-lg">O caixa está fechado</h3>
                <p className="text-gray-600 mt-1">Abra o caixa para começar a registrar vendas e visualizar métricas.</p>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
            title="Comandas Abertas" 
            value={stats.comandasAbertas} 
            icon={Receipt} 
            color="text-blue-600" 
            bg="bg-blue-50"
        />
        <StatCard 
            title="Produtos Ativos" 
            value={stats.totalProdutos} 
            icon={Package} 
            color="text-emerald-600" 
            bg="bg-emerald-50"
        />
        <StatCard 
            title="Total Clientes" 
            value={stats.totalClientes} 
            icon={Users} 
            color="text-violet-600" 
            bg="bg-violet-50"
        />
        <StatCard 
          title="Faturamento Hoje" 
          value={faturamentoVisivel ? `R$ ${(stats.faturamentoDia || 0).toFixed(2)}` : 'R$ ••••'} 
          icon={TrendingUp} 
          color="text-indigo-600" 
          bg="bg-indigo-50" 
          isVisibilityToggleable={isOnline && caixaAberto}
          onToggleVisibility={() => setFaturamentoVisivel(!faturamentoVisivel)}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                <Clock size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Últimas Comandas Abertas</h2>
          </div>
        </div>
        
        <div className="p-2">
          {comandasRecentes.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                <Receipt size={32} />
              </div>
              <p className="text-slate-500 font-medium">Nenhuma comanda ativa no momento</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {comandasRecentes.map(comanda => (
                <div key={comanda.id} className="group flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-default">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200 flex items-center justify-center text-lg font-bold">
                      {comanda.numero}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-base group-hover:text-indigo-600 transition-colors">
                        {comanda.cliente?.nome || 'Consumidor Final'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatTimeSafe(comanda.criado_em)}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>
                            {comanda.itens?.length || 0} {comanda.itens?.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right pl-4">
                    <p className="text-sm text-slate-400 mb-0.5">Total</p>
                    <p className="text-lg font-black text-emerald-600">
                      R$ {(comanda.itens?.reduce((total, item) => total + (item.quantidade * item.valor_unit), 0) || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};