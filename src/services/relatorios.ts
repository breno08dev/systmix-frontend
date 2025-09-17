import { RelatorioVendas } from '../types';
import { apiFetch } from '../lib/api'; // Importa a nossa função de fetch centralizada

export const relatoriosService = {
  /**
   * Busca os dados de vendas consolidados da API para um período específico.
   * @param dataInicio A data e hora de início do período.
   * @param dataFim A data e hora de fim do período.
   */
  async obterVendasPorPeriodo(dataInicio: string, dataFim: string): Promise<RelatorioVendas> {
    // Constrói a URL com os parâmetros de busca para a requisição GET
    const params = new URLSearchParams({ dataInicio, dataFim });
    
    return apiFetch(`/relatorios?${params.toString()}`);
  },

  /**
   * A função para obter o faturamento de hoje foi removida pois a nova implementação
   * da API de relatórios já cobre essa funcionalidade ao passar a data do dia.
   * O Dashboard no front-end fará essa chamada com as datas apropriadas.
   */

  /**
   * A função para exportar PDF foi removida do front-end.
   * Esta é agora uma responsabilidade que pode ser implementada
   * diretamente no back-end.
   */
};