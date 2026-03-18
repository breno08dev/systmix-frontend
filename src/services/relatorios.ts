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

export interface ProdutoVendidoDetalhe {
    nome: string;
    quantidade: number;
    valor_total: number;
}

export interface DetalhamentoRelatorio {
    resumo: ResumoFinanceiro;
    produtosVendidos: ProdutoVendidoDetalhe[];
}

// Funções de formatação de data isoladas para uso interno
const parseDataLocal = (dataStr: string, isFim: boolean = false) => {
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    // Cria a data no horário local. Se for fim, vai até o último milissegundo.
    if (isFim) {
        return new Date(ano, mes - 1, dia, 23, 59, 59, 999);
    }
    return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
};

export const relatoriosService = {
  
  async buscarResumoFinanceiro(isOnline: boolean, dataInicio: string, dataFim: string): Promise<ResumoFinanceiro> {
    if (!isOnline) {
       return { totalGeral: 0, totalDinheiro: 0, totalPix: 0, totalCartao: 0, qtdVendas: 0, ticketMedio: 0 };
    }

    const start = parseDataLocal(dataInicio, false);
    const end = parseDataLocal(dataFim, true);

    const { data, error } = await supabase
      .from('pagamentos')
      .select('valor, metodo')
      .gte('data', start.toISOString())
      .lte('data', end.toISOString());

    if (error) {
        console.error("Erro ao buscar pagamentos:", error);
        throw error;
    }

    const pagamentos = data || [];

    const totalDinheiro = pagamentos.filter(p => p.metodo === 'DINHEIRO').reduce((acc, curr) => acc + Number(curr.valor), 0);
    const totalPix = pagamentos.filter(p => p.metodo === 'PIX').reduce((acc, curr) => acc + Number(curr.valor), 0);
    const totalCartao = pagamentos.filter(p => p.metodo === 'CARTAO').reduce((acc, curr) => acc + Number(curr.valor), 0);
        
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
  },

  async buscarDetalhamentoRelatorio(isOnline: boolean, dataInicio: string, dataFim: string): Promise<DetalhamentoRelatorio> {
    const resumo = await this.buscarResumoFinanceiro(isOnline, dataInicio, dataFim);
    
    if (!isOnline) {
        return { resumo, produtosVendidos: [] };
    }

    const start = parseDataLocal(dataInicio, false);
    const end = parseDataLocal(dataFim, true);

    // Busca itens de comanda criados no período
    const { data: itensData, error: itensError } = await supabase
        .from('itens_comanda')
        .select(`
            quantidade,
            valor_unit,
            produto:id_produto (nome)
        `)
        .gte('criado_em', start.toISOString())
        .lte('criado_em', end.toISOString());

    if (itensError) {
        console.error("Erro ao buscar itens para relatório:", itensError);
        throw itensError;
    }

    // Agrupa e soma as quantidades por produto
    const agrupamento: Record<string, ProdutoVendidoDetalhe> = {};

    itensData?.forEach(item => {
        // Trata o retorno do join (pode ser array dependendo de como o Supabase resolve)
        const produtoObj = Array.isArray(item.produto) ? item.produto[0] : item.produto;
        const nomeProduto = produtoObj?.nome || 'Produto Desconhecido';
        
        const valorTotalItem = item.quantidade * Number(item.valor_unit);

        if (agrupamento[nomeProduto]) {
            agrupamento[nomeProduto].quantidade += item.quantidade;
            agrupamento[nomeProduto].valor_total += valorTotalItem;
        } else {
            agrupamento[nomeProduto] = {
                nome: nomeProduto,
                quantidade: item.quantidade,
                valor_total: valorTotalItem
            };
        }
    });

    // Converte o objeto agrupado em array e ordena por quantidade (mais vendidos primeiro)
    const produtosVendidos = Object.values(agrupamento).sort((a, b) => b.quantidade - a.quantidade);

    return {
        resumo,
        produtosVendidos
    };
  }
};