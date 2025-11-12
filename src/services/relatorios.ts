// src/services/relatorios.ts
import { RelatorioVendas } from '../types';
import { supabase } from '../lib/supabaseClient';

function lancarErroSupabase(error: any) {
  console.error('Erro no Supabase:', error);
  const mensagemErro = error.details || error.message || 'Ocorreu um erro na operação com o banco de dados.';
  throw new Error(mensagemErro);
}


function mapSupabaseRelatorioToRelatorio(data: any): RelatorioVendas {
  return {
    total_vendas: data.total_vendas || 0,
    total_comandas: data.total_comandas || 0,
    item_mais_vendido: data.item_mais_vendido || 'Nenhum',
    ticket_medio: data.ticket_medio || 0,
    pagamentos_por_metodo: data.pagamentos_por_metodo || []
  };
}

export const relatoriosService = {
  async obterVendasPorPeriodo(dataInicio: string, dataFim: string): Promise<RelatorioVendas> {
    
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
};