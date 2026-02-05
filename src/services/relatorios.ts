// src/services/relatorios.ts
import { supabase } from '../lib/supabaseClient';

export interface ResumoFinanceiro {
  totalGeral: number;
  totalDinheiro: number;
  totalPix: number;
  totalCartao: number;
  qtdVendas: number;
  ticketMedio: number;
}

export const relatoriosService = {
  
  async buscarResumoFinanceiro(isOnline: boolean, dataInicio: string, dataFim: string): Promise<ResumoFinanceiro> {
    if (!isOnline) {
       return { totalGeral: 0, totalDinheiro: 0, totalPix: 0, totalCartao: 0, qtdVendas: 0, ticketMedio: 0 };
    }

    // CORREÇÃO DE FUSO HORÁRIO
    // Cria datas considerando o horário LOCAL do navegador (00:00 até 23:59:59)
    // Adicionar 'T00:00:00' força o JS a entender como horário local, não UTC.
    const start = new Date(`${dataInicio}T00:00:00`);
    const end = new Date(`${dataFim}T23:59:59.999`);

    const { data, error } = await supabase
      .from('pagamentos')
      .select('valor, metodo')
      // Converte para ISO (UTC) apenas na hora de enviar para o banco
      .gte('data', start.toISOString())
      .lte('data', end.toISOString());

    if (error) {
        console.error("Erro ao buscar pagamentos:", error);
        throw error;
    }

    const pagamentos = data || [];

    // Cálculos dos Totais
    const totalDinheiro = pagamentos
        .filter(p => p.metodo === 'DINHEIRO')
        .reduce((acc, curr) => acc + Number(curr.valor), 0);

    const totalPix = pagamentos
        .filter(p => p.metodo === 'PIX')
        .reduce((acc, curr) => acc + Number(curr.valor), 0);

    const totalCartao = pagamentos
        .filter(p => p.metodo === 'CARTAO')
        .reduce((acc, curr) => acc + Number(curr.valor), 0);

        
    
    const totalGeral = totalDinheiro + totalPix + totalCartao;
    const qtdVendas = pagamentos.length;

    return {
      totalGeral,
      totalDinheiro,
      totalPix,
      totalCartao,
      qtdVendas,
      ticketMedio: qtdVendas > 0 ? totalGeral / qtdVendas : 0
    };
  }
};