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
  CalendarRange,
  Printer
} from 'lucide-react';
import { relatoriosService, ResumoFinanceiro } from '../../services/relatorios';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useToast } from '../../contexts/ToastContext';

const resumoZerado: ResumoFinanceiro = {
  totalGeral: 0, totalDinheiro: 0, totalPix: 0, totalCartao: 0, qtdVendas: 0, ticketMedio: 0
};

export const Relatorios: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState(false);
  
  // Novos estados para filtro de período (De - Até)
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  
  const [resumoPeriodo, setResumoPeriodo] = useState<ResumoFinanceiro>(resumoZerado);
  const [resumoOntem, setResumoOntem] = useState<ResumoFinanceiro>(resumoZerado);
  const [resumoSemana, setResumoSemana] = useState<ResumoFinanceiro>(resumoZerado);
  const [resumo30Dias, setResumo30Dias] = useState<ResumoFinanceiro>(resumoZerado); 

  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim, isOnline]);

  const carregarDados = async () => {
    // Validação básica
    if (new Date(dataFim) < new Date(dataInicio)) {
        addToast('A data final não pode ser menor que a inicial.', 'error');
        return;
    }

    setLoading(true);
    try {
      const ontemObj = new Date(); 
      ontemObj.setDate(ontemObj.getDate() - 1);
      const ontem = ontemObj.toISOString().split('T')[0];

      const semanaObj = new Date(); 
      semanaObj.setDate(semanaObj.getDate() - 7);
      const semanaInicio = semanaObj.toISOString().split('T')[0];

      const trintaDiasObj = new Date();
      trintaDiasObj.setDate(trintaDiasObj.getDate() - 30);
      const trintaDiasInicio = trintaDiasObj.toISOString().split('T')[0];

      const hoje = new Date().toISOString().split('T')[0];

      // Busca os dados do período selecionado e os fixos (ontem, 7d, 30d) usando 'hoje' como fim
      const [dadosPeriodo, dadosOntem, dadosSemana, dados30Dias] = await Promise.all([
        relatoriosService.buscarResumoFinanceiro(isOnline, dataInicio, dataFim),
        relatoriosService.buscarResumoFinanceiro(isOnline, ontem, ontem),
        relatoriosService.buscarResumoFinanceiro(isOnline, semanaInicio, hoje),
        relatoriosService.buscarResumoFinanceiro(isOnline, trintaDiasInicio, hoje)
      ]);

      setResumoPeriodo(dadosPeriodo);
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

  const handleImprimirRelatorio = async () => {
      setLoadingPdf(true);
      try {
          // Busca o relatório completo (Financeiro + Detalhamento de Produtos)
          const dadosCompletos = await relatoriosService.buscarDetalhamentoRelatorio(isOnline, dataInicio, dataFim);
          
          const BRL_STR = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
          
          // Geração do HTML para o PDF
          const htmlImpressao = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Relatório de Vendas</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; padding: 20px; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                    h1 { margin: 0; font-size: 24px; }
                    .periodo { font-size: 14px; color: #666; }
                    .section-title { font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; }
                    
                    .resumo-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px; }
                    .resumo-item { background: #f8f9fa; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px; border: 1px solid #eee; }
                    .resumo-item strong { display: block; font-size: 12px; color: #666; text-transform: uppercase; }
                    .resumo-item span { display: block; font-size: 20px; font-weight: bold; margin-top: 5px; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f8f9fa; font-weight: bold; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    
                    .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
                    
                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                        @page { margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório Financeiro e de Produtos</h1>
                    <div class="periodo">Período: ${new Date(dataInicio).toLocaleDateString('pt-BR')} até ${new Date(dataFim).toLocaleDateString('pt-BR')}</div>
                </div>

                <div class="section-title">Resumo Financeiro</div>
                <div class="resumo-grid">
                    <div class="resumo-item"><strong>Faturamento Total</strong><span>${BRL_STR(dadosCompletos.resumo.totalGeral)}</span></div>
                    <div class="resumo-item"><strong>Qtd. Vendas</strong><span>${dadosCompletos.resumo.qtdVendas}</span></div>
                    <div class="resumo-item"><strong>Ticket Médio</strong><span>${BRL_STR(dadosCompletos.resumo.ticketMedio)}</span></div>
                </div>

                <div class="section-title">Detalhamento por Pagamento</div>
                <table>
                    <tr><th>Método</th><th class="text-right">Valor Arrecadado</th></tr>
                    <tr><td>Dinheiro</td><td class="text-right">${BRL_STR(dadosCompletos.resumo.totalDinheiro)}</td></tr>
                    <tr><td>PIX</td><td class="text-right">${BRL_STR(dadosCompletos.resumo.totalPix)}</td></tr>
                    <tr><td>Cartão</td><td class="text-right">${BRL_STR(dadosCompletos.resumo.totalCartao)}</td></tr>
                </table>

                <div class="section-title">Produtos Vendidos (Saída de Estoque)</div>
                ${dadosCompletos.produtosVendidos.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Produto</th>
                            <th class="text-center">Quantidade</th>
                            <th class="text-right">Valor Total Vendido</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dadosCompletos.produtosVendidos.map(prod => `
                            <tr>
                                <td>${prod.nome}</td>
                                <td class="text-center">${prod.quantidade}</td>
                                <td class="text-right">${BRL_STR(prod.valor_total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : '<p>Nenhum produto registrado neste período.</p>'}

                <div class="footer">Gerado pelo Sistema Systmix em ${new Date().toLocaleString('pt-BR')}</div>
                
                <script>
                    // Auto-imprime ao carregar
                    window.onload = () => {
                        window.print();
                        // Tenta fechar a janela após a impressão (se permitido pelo navegador)
                        setTimeout(() => { window.close(); }, 500);
                    };
                </script>
            </body>
            </html>
          `;

          // Abre uma nova janela invisível/popup para impressão
          const printWindow = window.open('', '_blank', 'width=800,height=600');
          if (printWindow) {
              printWindow.document.write(htmlImpressao);
              printWindow.document.close();
          } else {
              addToast('Bloqueador de pop-ups impediu a impressão.', 'error');
          }

      } catch (error) {
          console.error(error);
          addToast('Erro ao preparar relatório para impressão.', 'error');
      } finally {
          setLoadingPdf(false);
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

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Controle de Período */}
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 text-slate-500 border-r border-slate-200">
              <Calendar size={18} />
              <span className="text-sm font-semibold">Período:</span>
            </div>
            <input 
              type="date" 
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="outline-none text-slate-700 font-medium bg-transparent text-sm"
              title="Data Inicial"
            />
            <span className="text-slate-400">até</span>
            <input 
              type="date" 
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="outline-none text-slate-700 font-medium bg-transparent text-sm"
              title="Data Final"
            />
            <button 
              onClick={carregarDados}
              className="p-2 ml-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
              title="Atualizar dados do período"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Botão de Imprimir */}
          <button
            onClick={handleImprimirRelatorio}
            disabled={loading || loadingPdf}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
          >
             {loadingPdf ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
             Salvar / Imprimir PDF
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
          {/* 1. HERO CARD - FATURAMENTO DO PERÍODO SELECIONADO */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
             <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <p className="text-indigo-100 font-medium mb-1 flex items-center gap-2">
                        <TrendingUp size={20} /> Faturamento do Período
                    </p>
                    <h2 className="text-5xl font-black tracking-tight mb-2">
                        {BRL(resumoPeriodo.totalGeral)}
                    </h2>
                    <div className="flex gap-4 text-sm text-indigo-200">
                        <span className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                            {resumoPeriodo.qtdVendas} Vendas
                        </span>
                        <span className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                            Ticket Médio: {BRL(resumoPeriodo.ticketMedio)}
                        </span>
                    </div>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Wallet size={32} className="text-white" />
                </div>
             </div>
             
             <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
             <div className="absolute -left-10 -top-20 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          {/* 2. DETALHAMENTO POR MÉTODO (DO PERÍODO) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-lg shadow-emerald-500/5 hover:border-emerald-200 transition-all flex items-center justify-between">
                <div>
                    <p className="text-slate-500 font-medium text-sm mb-1">Dinheiro</p>
                    <h3 className="text-3xl font-bold text-slate-800">{BRL(resumoPeriodo.totalDinheiro)}</h3>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Banknote size={24} />
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-cyan-100 shadow-lg shadow-cyan-500/5 hover:border-cyan-200 transition-all flex items-center justify-between">
                <div>
                    <p className="text-slate-500 font-medium text-sm mb-1">PIX</p>
                    <h3 className="text-3xl font-bold text-slate-800">{BRL(resumoPeriodo.totalPix)}</h3>
                </div>
                <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-600">
                    <QrCode size={24} />
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-lg shadow-purple-500/5 hover:border-purple-200 transition-all flex items-center justify-between">
                <div>
                    <p className="text-slate-500 font-medium text-sm mb-1">Cartão</p>
                    <h3 className="text-3xl font-bold text-slate-800">{BRL(resumoPeriodo.totalCartao)}</h3>
                </div>
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                    <CreditCard size={24} />
                </div>
            </div>
          </div>

          {/* 3. HISTÓRICO E COMPARATIVOS FIXOS */}
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mt-4">
            <History className="text-indigo-600" />
            Histórico (Baseado em Hoje)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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