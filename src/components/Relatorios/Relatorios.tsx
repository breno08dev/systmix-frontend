// src/components/Relatorios/Relatorios.tsx (LAYOUT HÍBRIDO FINAL)
import React, { useEffect, useState } from 'react';
import { Loader, DollarSign, ShoppingCart, Users, X, } from 'lucide-react';
import { relatoriosService } from '../../services/relatorios';
import { ResumoDashboard, ResumoPeriodo, RelatorioVendas } from '../../types';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

// --- Card de Resumo (Para "Hoje", "Ontem", etc.) ---
interface ResumoCardProps {
  titulo: string;
  dados: ResumoPeriodo;
}
const ResumoCard: React.FC<ResumoCardProps> = ({ titulo, dados }) => (
  <div className="bg-white rounded-lg shadow-md p-5">
    <h2 className="text-lg font-bold text-gray-800 mb-4">{titulo}</h2>
    <div className="space-y-3">
      <div className="flex justify-between items-center pb-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-primary">Total Vendido</span>
        <span className="text-lg font-bold text-primary">
          R$ {dados.total_vendido.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">Cartão</span>
        <span className="text-sm font-medium text-gray-700">
          R$ {dados.cartao.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">PIX</span>
        <span className="text-sm font-medium text-gray-700">
          R$ {dados.pix.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">Dinheiro</span>
        <span className="text-sm font-medium text-gray-700">
          R$ {dados.dinheiro.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
        <span className="text-sm font-semibold text-gray-800">Total de Pedidos</span>
        <span className="text-lg font-bold text-gray-800">
          {dados.total_pedidos}
        </span>
      </div>
    </div>
  </div>
);

// --- Card de Stats (Para a busca customizada) ---
interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}
const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon }) => (
  <div className="bg-white rounded-lg shadow-md p-5 flex items-start space-x-4">
    <div className="bg-primary text-white rounded-full p-3">{icon}</div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);


export const Relatorios: React.FC = () => {
  const { isOnline } = useOnlineStatus();
  
  // Estados dos relatórios
  const [resumo, setResumo] = useState<ResumoDashboard | null>(null); // Para "Hoje", "Ontem"...
  const [relatorioCustom, setRelatorioCustom] = useState<RelatorioVendas | null>(null); // Para a busca

  // Estados de controle
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados dos filtros de data
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

  // Carrega o resumo ("Hoje", "Ontem"...) na primeira vez
  useEffect(() => {
    if (isOnline) {
      setLoadingResumo(true);
      setError(null);
      relatoriosService.obterResumoGeral()
        .then(setResumo)
        .catch(err => {
          console.error(err);
          setError(err.message || 'Erro ao buscar resumos.');
        })
        .finally(() => setLoadingResumo(false));
    } else {
      setLoadingResumo(false);
      setError("Relatórios indisponíveis offline.");
    }
  }, [isOnline]);

  // Função para a busca por data específica
  const handleGerarRelatorioCustom = () => {
    if (!isOnline) {
      setError("Busca indisponível offline.");
      return;
    }
    setLoadingCustom(true);
    setError(null);
    setRelatorioCustom(null); // Limpa o anterior
    
    // Chama o serviço que busca por período
    relatoriosService.obterVendasPorPeriodo(dataInicio, dataFim)
      .then(setRelatorioCustom) // Salva no estado 'relatorioCustom'
      .catch(err => {
        console.error(err);
        setError(err.message || "Erro ao gerar relatório customizado.");
      })
      .finally(() => setLoadingCustom(false));
  };
  
  // Função para limpar a busca e voltar ao resumo padrão
  const handleLimparBusca = () => {
    setRelatorioCustom(null);
    setError(null);
  };

  // Define qual view mostrar: o resumo ou a busca customizada
  const mostrarResumoPadrao = !relatorioCustom;
  
  const formatarData = (dataStr: string) => {
    try {
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    } catch (e) { return dataStr; }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Relatórios</h1>

      {/* SELETOR DE DATAS (Sempre visível) */}
      <div className="bg-white rounded-lg shadow-md p-5 mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Buscar por Período Específico</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="dataInicio" className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <input
              type="date"
              id="dataInicio"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="dataFim" className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <input
              type="date"
              id="dataFim"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary"
            />
          </div>
          <button
            onClick={handleGerarRelatorioCustom}
            disabled={loadingCustom || !isOnline}
            className="flex-shrink-0 self-end px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400"
          >
            {loadingCustom ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </div>

      {/* ÁREA DE RESULTADO */}
      <div id="relatorio-conteudo">
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6" role="alert">
            <strong className="font-bold">Erro: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* --- MODO: BUSCA CUSTOMIZADA --- */}
        {loadingCustom && (
           <div className="flex justify-center items-center h-64">
             <Loader className="animate-spin text-primary" size={48} />
           </div>
        )}
        
        {relatorioCustom && !loadingCustom && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Resultado da Busca</h2>
                <p className="text-gray-600">
                  Período de {formatarData(dataInicio)} a {formatarData(dataFim)}
                </p>
              </div>
              <button 
                onClick={handleLimparBusca}
                className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
              >
                <X size={16} /> Limpar Busca
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8 mt-8">
              <StatsCard title="Total de Vendas" value={`R$ ${relatorioCustom.total_vendas.toFixed(2)}`} icon={<DollarSign />} />
              <StatsCard title="Total de Comandas" value={relatorioCustom.total_comandas.toString()} icon={<ShoppingCart />} />
              <StatsCard title="Ticket Médio" value={`R$ ${relatorioCustom.ticket_medio.toFixed(2)}`} icon={<Users />} />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Detalhes por Método de Pagamento
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {relatorioCustom.pagamentos_por_metodo.map((metodo) => (
                    <tr key={metodo.metodo_agrupado}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{metodo.metodo_agrupado}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">R$ {metodo.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  {relatorioCustom.pagamentos_por_metodo.length === 0 && (
                    <tr><td colSpan={2} className="px-6 py-4 text-center text-gray-500">Nenhum pagamento neste período.</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-6 py-3 text-left text-sm font-bold text-gray-900 uppercase">Total Geral</td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">R$ {relatorioCustom.total_vendas.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* --- MODO: RESUMO PADRÃO --- */}
        {mostrarResumoPadrao && !loadingCustom && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Resumo Geral</h2>
            {loadingResumo && (
              <div className="flex justify-center items-center h-64">
                <Loader className="animate-spin text-primary" size={48} />
              </div>
            )}
            
            {/* Cards empilhados (layout de 1 coluna) */}
            {!loadingResumo && resumo && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-5">
                <ResumoCard titulo="Vendas Hoje" dados={resumo.hoje} />
                <ResumoCard titulo="Vendas Ontem" dados={resumo.ontem} />
                <ResumoCard titulo="Vendas nos Últimos 7 Dias" dados={resumo.ultimos_7_dias} />
                <ResumoCard titulo="Vendas nos Últimos 30 Dias" dados={resumo.ultimos_30_dias} />
              </div>
            )}
          </div>
        )}
        
      </div>
    </div>
  );
};