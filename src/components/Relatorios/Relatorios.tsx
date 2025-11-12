// src/components/Relatorios/Relatorios.tsx (VERSÃO FINAL COM EXPORTAR PDF)
import React, { useState } from 'react';
import { Calendar, Download, TrendingUp, Receipt, Star, DollarSign, Wallet } from 'lucide-react';
import { relatoriosService } from '../../services/relatorios';
import { RelatorioVendas } from '../../types';
import { useToast } from '../../contexts/ToastContext';

export const Relatorios: React.FC = () => {
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [relatorio, setRelatorio] = useState<RelatorioVendas | null>(null);
  const [carregando, setCarregando] = useState(false);
  const { addToast } = useToast();

  const formatarData = (dataString: string) => {
    try {
      const [ano, mes, dia] = dataString.split('-');
      return `${dia}/${mes}/${ano}`;
    } catch {
      return dataString;
    }
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
      addToast('Relatório gerado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao gerar relatório:', error);
      addToast(error.message || 'Não foi possível gerar o relatório.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  const handleExportarPDF = async () => {
    if (!relatorio) {
      addToast("Gere um relatório antes de exportar.", 'error');
      return;
    }
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/relatorios/pdf`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_vendas_${formatarData(dataInicio).replace(/\//g, '-')}_a_${formatarData(dataFim).replace(/\//g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast('Download do PDF iniciado.', 'success');

    } catch (error: any) {
      console.error('Erro ao exportar PDF:', error);
      addToast(error.message || 'Ocorreu um erro ao gerar o PDF.', 'error');
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
            {/* BOTÃO DE EXPORTAR REATIVADO */}
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
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total de Vendas" value={`R$ ${(relatorio.total_vendas || 0).toFixed(2)}`} icon={DollarSign} color="bg-green-500"/>
            <StatCard title="Total de Comandas" value={relatorio.total_comandas || 0} icon={Receipt} color="bg-blue-500"/>
            <StatCard title="Ticket Médio" value={`R$ ${(relatorio.ticket_medio || 0).toFixed(2)}`} icon={TrendingUp} color="bg-purple-500"/>
            <StatCard title="Item Mais Vendido" value={relatorio.item_mais_vendido || 'N/A'} icon={Star} color="bg-primary"/>
          </div>
          
          {(relatorio.pagamentos_por_metodo?.length || 0) > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <Wallet size={20} className="text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">Resumo de Pagamentos</h2>
              </div>
              <div className="space-y-2">
                {relatorio.pagamentos_por_metodo.map(pagamento => (
                  <div key={pagamento.metodo} className="flex justify-between items-center text-sm text-gray-600">
                    <span className='capitalize'>• {pagamento.metodo}</span>
                    <span className="font-medium">R$ {(pagamento.total || 0).toFixed(2)}</span>
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