// src/services/relatorios.ts
import { supabase } from '../lib/supabaseClient';

export interface ResumoFinanceiro {
  totalGeral: number;
  totalDinheiro: number;
  totalPix: number;
  totalCartao: number;
  qtdVendas: number;
  ticketMedio: number;
  totalSangrias: number; // NOVO CAMPO ADICIONADO
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

// CORREÇÃO: Função agora respeita o horário exato caso receba um Timestamp ISO completo
const parseDataLocal = (dataStr: string, isFim: boolean = false) => {
    // Se a data já vier com hora (formato ISO 'T'), nós a utilizamos exatamente como está
    if (dataStr.includes('T')) {
        return new Date(dataStr);
    }
    
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    if (isFim) {
        return new Date(ano, mes - 1, dia, 23, 59, 59, 999);
    }
    return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
};

export const relatoriosService = {
  
  async buscarResumoFinanceiro(isOnline: boolean, dataInicio: string, dataFim: string): Promise<ResumoFinanceiro> {
    if (!isOnline) {
       return { totalGeral: 0, totalDinheiro: 0, totalPix: 0, totalCartao: 0, qtdVendas: 0, ticketMedio: 0, totalSangrias: 0 };
    }

    const start = parseDataLocal(dataInicio, false);
    const end = parseDataLocal(dataFim, true);

    // 1. Busca os pagamentos
    const { data: dataPagamentos, error: errPagamentos } = await supabase
      .from('pagamentos')
      .select('valor, metodo')
      .gte('data', start.toISOString())
      .lte('data', end.toISOString());

    if (errPagamentos) {
        console.error("Erro ao buscar pagamentos:", errPagamentos);
        throw errPagamentos;
    }

    // 2. Busca as sangrias do período
    const { data: dataSangrias, error: errSangrias } = await supabase
      .from('sangrias')
      .select('valor')
      .gte('data', start.toISOString())
      .lte('data', end.toISOString());
      
    if (errSangrias) {
        console.error("Erro ao buscar sangrias:", errSangrias);
        throw errSangrias;
    }

    const pagamentos = dataPagamentos || [];
    const sangrias = dataSangrias || [];

    // Calcula as retiradas (Sangrias)
    const totalSangrias = sangrias.reduce((acc, curr) => acc + Number(curr.valor), 0);

    // Calcula as entradas
    let totalDinheiro = pagamentos.filter(p => p.metodo === 'DINHEIRO').reduce((acc, curr) => acc + Number(curr.valor), 0);
    const totalPix = pagamentos.filter(p => p.metodo === 'PIX').reduce((acc, curr) => acc + Number(curr.valor), 0);
    const totalCartao = pagamentos.filter(p => p.metodo === 'CARTAO').reduce((acc, curr) => acc + Number(curr.valor), 0);
        
    // Desconta a sangria do total de dinheiro físico na gaveta
    totalDinheiro = totalDinheiro - totalSangrias;

    const totalGeral = totalDinheiro + totalPix + totalCartao;
    const qtdVendas = pagamentos.length;

    return {
      totalGeral,
      totalDinheiro,
      totalPix,
      totalCartao,
      qtdVendas,
      // Ticket médio usa valor bruto (recolocamos a sangria na soma para calcular o ticket das vendas)
      ticketMedio: qtdVendas > 0 ? (totalDinheiro + totalSangrias + totalPix + totalCartao) / qtdVendas : 0,
      totalSangrias
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

    const agrupamento: Record<string, ProdutoVendidoDetalhe> = {};

    itensData?.forEach(item => {
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

    const produtosVendidos = Object.values(agrupamento).sort((a, b) => b.quantidade - a.quantidade);

    return {
        resumo,
        produtosVendidos
    };
  }
};