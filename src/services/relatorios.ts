// src/services/relatorios.ts (VERSÃO ATUALIZADA)
import { RelatorioVendas, ResumoDashboard } from '../types';
import { supabase } from '../lib/supabaseClient';

function lancarErroSupabase(error: any) {
  console.error('Erro no Supabase:', error);
  const mensagemErro = error.details || error.message || 'Ocorreu um erro na operação com o banco de dados.';
  throw new Error(mensagemErro);
}

// Mapeamento para a busca personalizada
function mapSupabaseRelatorioToRelatorio(data: any): RelatorioVendas {
  return {
    total_vendas: data.total_vendas || 0,
    total_comandas: data.total_comandas || 0,
    ticket_medio: data.ticket_medio || 0,
    pagamentos_por_metodo: data.pagamentos_por_metodo || []
  };
}

export const relatoriosService = {
  
  // Função para a BUSCA PERSONALIZADA
  async obterVendasPorPeriodo(dataInicio: string, dataFim: string): Promise<RelatorioVendas> {
    
    // Chama a função que criamos no Script 3
    const { data, error } = await supabase.rpc('obter_vendas_por_periodo', {
      p_data_inicio: dataInicio,
      p_data_fim: dataFim
    });

    if (error) {
      lancarErroSupabase(error);
    }
    if (!data) {
      throw new Error('Não foi possível gerar o relatório.');
    }

    return mapSupabaseRelatorioToRelatorio(data);
  },

  // Função para o RESUMO GERAL (Hoje, Ontem...)
  async obterResumoGeral(): Promise<ResumoDashboard> {
    
    // Chama a função que criamos no Script 2
    const { data, error } = await supabase.rpc('get_dashboard_summary');

    if (error) {
      lancarErroSupabase(error);
    }
    if (!data) {
      throw new Error('Não foi possível buscar o resumo geral.');
    }
    return data as ResumoDashboard;
  }
};