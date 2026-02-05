// src/components/Relatorios/Relatorios.tsx
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Wallet, 
  CreditCard, 
  QrCode, 
  Banknote, 
  TrendingUp, 
  Loader2,
  RefreshCcw,
  History,
  CalendarDays,
  CalendarRange
} from 'lucide-react';
import { relatoriosService, ResumoFinanceiro } from '../../services/relatorios';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useToast } from '../../contexts/ToastContext';

// Estado inicial zerado para reuso
const resumoZerado: ResumoFinanceiro = {
  totalGeral: 0, totalDinheiro: 0, totalPix: 0, totalCartao: 0, qtdVendas: 0, ticketMedio: 0
};

export const Relatorios: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]); // Hoje YYYY-MM-DD
  
  // Estados para os diferentes períodos
  const [resumoDia, setResumoDia] = useState<ResumoFinanceiro>(resumoZerado);
  const [resumoOntem, setResumoOntem] = useState<ResumoFinanceiro>(resumoZerado);
  const [resumoSemana, setResumoSemana] = useState<ResumoFinanceiro>(resumoZerado);
  const [resumo30Dias, setResumo30Dias] = useState<ResumoFinanceiro>(resumoZerado); // Renomeado para clareza

  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();

  useEffect(() => {
    carregarDados();
  }, [dataFiltro, isOnline]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Definição das datas
      const hoje = dataFiltro; // Data selecionada no input (padrão é hoje)
      
      const ontemObj = new Date(); 
      ontemObj.setDate(ontemObj.getDate() - 1);
      const ontem = ontemObj.toISOString().split('T')[0];

      const semanaObj = new Date(); 
      semanaObj.setDate(semanaObj.getDate() - 7);
      const semanaInicio = semanaObj.toISOString().split('T')[0];

      // CORREÇÃO: Últimos 30 dias em vez de "Mês Atual" (que reseta dia 1)
      const trintaDiasObj = new Date();
      trintaDiasObj.setDate(trintaDiasObj.getDate() - 30);
      const trintaDiasInicio = trintaDiasObj.toISOString().split('T')[0];

      // 2. Busca tudo em paralelo para ser rápido
      // Nota: Usamos 'hoje' como data final para todos os períodos acumulativos
      const [dadosHoje, dadosOntem, dadosSemana, dados30Dias] = await Promise.all([
        relatoriosService.buscarResumoFinanceiro(isOnline, hoje, hoje),
        relatoriosService.buscarResumoFinanceiro(isOnline, ontem, ontem),
        relatoriosService.buscarResumoFinanceiro(isOnline, semanaInicio, hoje),
        relatoriosService.buscarResumoFinanceiro(isOnline, trintaDiasInicio, hoje)
      ]);

      setResumoDia(dadosHoje);
      setResumoOntem(dadosOntem);
      setResumoSemana(dadosSemana);
      setResumo30Dias(dados30Dias);

    } catch (error) {
      console.error(error);
      addToast('Erro ao calcular relatórios.', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const BRL = (valor: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

  return (
    <div className="p-6 max-w-[1920px] mx-auto min-h-screen flex flex-col gap-8">
      
      {/* CABEÇALHO E FILTROS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <BarChart3 className="text-indigo-600" size={32} />
            Relatório Financeiro
          </h1>
          <p className="text-slate-500 mt-1">Visão completa do faturamento e métricas.</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-3 text-slate-500 border-r border-slate-200">
             <Calendar size={18} />
             <span className="text-sm font-semibold">Data Base:</span>
          </div>
          <input 
            type="date" 
            value={dataFiltro}
            onChange={(e) => setDataFiltro(e.target.value)}
            className="outline-none text-slate-700 font-medium bg-transparent"
          />
          <button 
            onClick={carregarDados}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            title="Atualizar agora"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 size={48} className="text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-400 font-medium">Consolidando vendas...</p>
        </div>
      ) : (
        <>
          {/* 1. HERO CARD - FATURAMENTO DO DIA SELECIONADO */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
             <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <p className="text-indigo-100 font-medium mb-1 flex items-center gap-2">
                        <TrendingUp size={20} /> Faturamento Selecionado
                    </p>
                    <h2 className="text-5xl font-black tracking-tight mb-2">
                        {BRL(resumoDia.totalGeral)}
                    </h2>
                    <div className="flex gap-4 text-sm text-indigo-200">
                        <span className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                            {resumoDia.qtdVendas} Vendas
                        </span>
                        <span className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                            Ticket Médio: {BRL(resumoDia.ticketMedio)}
                        </span>
                    </div>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Wallet size={32} className="text-white" />
                </div>
             </div>
             
             {/* Decoração Fundo */}
             <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
             <div className="absolute -left-10 -top-20 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          {/* 2. DETALHAMENTO POR MÉTODO (DO DIA SELECIONADO) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Dinheiro */}
            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-lg shadow-emerald-500/5 hover:border-emerald-200 transition-all flex items-center justify-between">
                <div>
                    <p className="text-slate-500 font-medium text-sm mb-1">Dinheiro</p>
                    <h3 className="text-3xl font-bold text-slate-800">{BRL(resumoDia.totalDinheiro)}</h3>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Banknote size={24} />
                </div>
            </div>

            {/* PIX */}
            <div className="bg-white p-6 rounded-2xl border border-cyan-100 shadow-lg shadow-cyan-500/5 hover:border-cyan-200 transition-all flex items-center justify-between">
                <div>
                    <p className="text-slate-500 font-medium text-sm mb-1">PIX</p>
                    <h3 className="text-3xl font-bold text-slate-800">{BRL(resumoDia.totalPix)}</h3>
                </div>
                <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-600">
                    <QrCode size={24} />
                </div>
            </div>

            {/* Cartão */}
            <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-lg shadow-purple-500/5 hover:border-purple-200 transition-all flex items-center justify-between">
                <div>
                    <p className="text-slate-500 font-medium text-sm mb-1">Cartão</p>
                    <h3 className="text-3xl font-bold text-slate-800">{BRL(resumoDia.totalCartao)}</h3>
                </div>
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                    <CreditCard size={24} />
                </div>
            </div>
          </div>

          {/* 3. HISTÓRICO E COMPARATIVOS */}
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mt-4">
            <History className="text-indigo-600" />
            Histórico de Vendas
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            {/* Ontem */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm text-slate-600">
                        <CalendarDays size={20} />
                    </div>
                    <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded">24h</span>
                </div>
                <div>
                    <p className="text-slate-500 font-medium text-sm">Vendas de Ontem</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{BRL(resumoOntem.totalGeral)}</h3>
                    <p className="text-xs text-slate-400 mt-2">{resumoOntem.qtdVendas} vendas realizadas</p>
                </div>
            </div>

            {/* Últimos 7 Dias */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm text-indigo-600">
                        <CalendarRange size={20} />
                    </div>
                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">7 Dias</span>
                </div>
                <div>
                    <p className="text-slate-500 font-medium text-sm">Últimos 7 Dias</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{BRL(resumoSemana.totalGeral)}</h3>
                    <p className="text-xs text-slate-400 mt-2">Média diária: {BRL(resumoSemana.totalGeral / 7)}</p>
                </div>
            </div>

            {/* Últimos 30 Dias (Corrigido para não mostrar menos que 7 dias) */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm text-emerald-600">
                        <Calendar size={20} />
                    </div>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">30 Dias</span>
                </div>
                <div>
                    <p className="text-slate-500 font-medium text-sm">Últimos 30 Dias</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{BRL(resumo30Dias.totalGeral)}</h3>
                    <p className="text-xs text-slate-400 mt-2">{resumo30Dias.qtdVendas} vendas realizadas</p>
                </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
};