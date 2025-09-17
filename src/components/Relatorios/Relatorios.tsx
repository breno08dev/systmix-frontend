import React, { useState } from 'react';
import { Calendar, Download, TrendingUp, Receipt, Star, DollarSign, Wallet } from 'lucide-react';
import { relatoriosService } from '../../services/relatorios';
import { RelatorioVendas } from '../../types';

export const Relatorios: React.FC = () => {
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [relatorio, setRelatorio] = useState<RelatorioVendas | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Função para formatar a data que será usada tanto na tela quanto no nome do arquivo PDF
  const formatarData = (dataString: string) => {
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const gerarRelatorio = async () => {
    setCarregando(true);
    setRelatorio(null);
    try {
      const data = await relatoriosService.obterVendasPorPeriodo(
        `${dataInicio}T00:00:00`,
        `${dataFim}T23:59:59`
      );
      setRelatorio(data);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Não foi possível gerar o relatório.');
    } finally {
      setCarregando(false);
    }
  };

  const handleExportarPDF = async () => {
    if (!relatorio) {
      alert("Gere um relatório primeiro antes de exportar.");
      return;
    }
    
    try {
      // Chama a nova rota da API de PDF
      const response = await fetch(`${import.meta.env.VITE_API_URL}/relatorios/pdf`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Pega o token do localStorage para autenticação
            'Authorization': `Bearer ${localStorage.getItem('@SystMix:token')}` 
        },
        body: JSON.stringify({
            relatorio,
            dataInicio: `${dataInicio}T00:00:00`,
            dataFim: `${dataFim}T23:59:59`,
        })
      });

      if (!response.ok) {
          throw new Error('Falha ao gerar o PDF no servidor.');
      }

      // Converte a resposta num blob (ficheiro em memória)
      const blob = await response.blob();

      // Cria uma URL temporária para o ficheiro e simula um clique para fazer o download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_vendas_${formatarData(dataInicio)}_a_${formatarData(dataFim)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove(); // Limpa o elemento 'a' da página
      window.URL.revokeObjectURL(url); // Libera a memória

    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF.');
    }
  };

  const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; color: string; }> = 
  ({ title, value, icon: Icon, color }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}><Icon className="w-6 h-6 text-white" /></div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Relatórios</h1>
        <p className="text-gray-600">Análise de vendas e desempenho</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Calendar size={20} className="text-gray-500" />
          <span className="font-medium text-gray-700">Período</span>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"/>
          </div>
          <div className="flex gap-2">
            <button onClick={gerarRelatorio} disabled={carregando} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-300">
              {carregando ? 'Gerando...' : 'Gerar Relatório'}
            </button>
            {relatorio && (
              <button onClick={handleExportarPDF} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                <Download size={16} />
                Exportar PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {relatorio && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total de Vendas" value={`R$ ${relatorio.total_vendas.toFixed(2)}`} icon={DollarSign} color="bg-green-500"/>
            <StatCard title="Total de Comandas" value={relatorio.total_comandas} icon={Receipt} color="bg-blue-500"/>
            <StatCard title="Ticket Médio" value={`R$ ${relatorio.ticket_medio.toFixed(2)}`} icon={TrendingUp} color="bg-purple-500"/>
            <StatCard title="Item Mais Vendido" value={relatorio.item_mais_vendido} icon={Star} color="bg-primary"/>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Resumo do Período</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Desempenho</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Período: {formatarData(dataInicio)} a {formatarData(dataFim)}</li>
                  <li>• Total arrecadado: R$ {relatorio.total_vendas.toFixed(2)}</li>
                  <li>• Comandas fechadas: {relatorio.total_comandas}</li>
                  <li>• Valor médio por comanda: R$ {relatorio.ticket_medio.toFixed(2)}</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Destaques</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Item mais vendido: {relatorio.item_mais_vendido}</li>
                  {/* A média de itens por comanda não está no objeto de relatório da API, então removemos por enquanto */}
                  <li>• Status geral: {relatorio.total_vendas > 0 ? 'Positivo' : 'Sem vendas'}</li>
                </ul>
              </div>
            </div>
          </div>
          
          {relatorio.pagamentos_por_metodo.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <Wallet size={20} className="text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">Resumo de Pagamentos</h2>
              </div>
              <div className="space-y-2">
                {relatorio.pagamentos_por_metodo.map(pagamento => (
                  <div key={pagamento.metodo} className="flex justify-between items-center text-sm text-gray-600">
                    <span>• {pagamento.metodo}</span>
                    <span className="font-medium">R$ {pagamento.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
      {!relatorio && !carregando && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Gerar Relatório</h3>
          <p className="text-gray-500">
            Selecione o período desejado para visualizar as estatísticas de vendas.
          </p>
        </div>
      )}
    </div>
  );
};