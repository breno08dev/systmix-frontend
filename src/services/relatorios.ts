// src/services/relatorios.ts
import { supabase } from '../lib/supabaseClient';
import { db } from '../lib/localDatabase';

export interface ResumoFinanceiro {
  totalGeral: number;
  totalDinheiro: number;
  totalPix: number;
  totalCartao: number;
  qtdVendas: number;
  ticketMedio: number;
  totalSangrias: number;
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

const parseDataLocal = (dataStr: string, isFim: boolean = false) => {
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
    const start = parseDataLocal(dataInicio, false);
    const end = parseDataLocal(dataFim, true);

    let pagamentos: any[] = [];
    let sangrias: any[] = [];

    if (isOnline) {
      try {
          const { data: dataPagamentos, error: errPagamentos } = await supabase
            .from('pagamentos')
            .select('id_comanda, valor, metodo')
            .gte('data', start.toISOString())
            .lte('data', end.toISOString());

          if (errPagamentos) throw errPagamentos;
          
          const { data: dataSangrias, error: errSangrias } = await supabase
            .from('sangrias')
            .select('valor')
            .gte('data', start.toISOString())
            .lte('data', end.toISOString());
            
          if (errSangrias) throw errSangrias;

          pagamentos = dataPagamentos || [];
          sangrias = dataSangrias || [];
      } catch (error) {
          console.warn("Erro ao buscar relatórios online. Recorrendo ao banco local OFF.", error);
          isOnline = false; 
      }
    }
    
    if (!isOnline) {
        // CORREÇÃO: Resgate seguro utilizando TimeStamp para nunca perder a data
        const startTime = start.getTime();
        const endTime = end.getTime();

        const comandasLocais = await db.comandas
            .filter(c => c.status === 'fechada' && !!c.fechado_em && new Date(c.fechado_em).getTime() >= startTime && new Date(c.fechado_em).getTime() <= endTime)
            .toArray();
        
        for (const c of comandasLocais) {
            // CORREÇÃO VITAL: Buscando pagamentos da tabela separada offline
            const pagsLocal = await db.pagamentos.where('id_comanda').equals(c.id).toArray();
            const pagsToUse = pagsLocal.length > 0 ? pagsLocal : (c.pagamentos || []);
            pagsToUse.forEach(p => pagamentos.push({ id_comanda: c.id, valor: p.valor, metodo: p.metodo }));
        }

        sangrias = await db.sangrias
            .filter(s => new Date(s.data).getTime() >= startTime && new Date(s.data).getTime() <= endTime)
            .toArray();
    }

    const totalSangrias = sangrias.reduce((acc, curr) => acc + Number(curr.valor), 0);

    let totalDinheiro = pagamentos.filter(p => p.metodo.includes('DINHEIRO')).reduce((acc, curr) => acc + Number(curr.valor), 0);
    const totalPix = pagamentos.filter(p => p.metodo.includes('PIX')).reduce((acc, curr) => acc + Number(curr.valor), 0);
    const totalCartao = pagamentos.filter(p => p.metodo.includes('CARTAO')).reduce((acc, curr) => acc + Number(curr.valor), 0);
        
    totalDinheiro = totalDinheiro - totalSangrias;
    const totalGeral = totalDinheiro + totalPix + totalCartao;
    
    const comandasUnicas = new Set(pagamentos.map(p => p.id_comanda));
    const qtdVendas = comandasUnicas.size;

    return {
      totalGeral,
      totalDinheiro,
      totalPix,
      totalCartao,
      qtdVendas,
      ticketMedio: qtdVendas > 0 ? (totalDinheiro + totalSangrias + totalPix + totalCartao) / qtdVendas : 0,
      totalSangrias
    };
  },

  async buscarDetalhamentoRelatorio(isOnline: boolean, dataInicio: string, dataFim: string): Promise<DetalhamentoRelatorio> {
    const resumo = await this.buscarResumoFinanceiro(isOnline, dataInicio, dataFim);
    
    const start = parseDataLocal(dataInicio, false);
    const end = parseDataLocal(dataFim, true);

    let itensData: any[] = [];

    if (isOnline) {
      try {
          const { data, error } = await supabase
              .from('itens_comanda')
              .select(`
                  quantidade,
                  valor_unit,
                  produto:id_produto (nome)
              `)
              .gte('criado_em', start.toISOString())
              .lte('criado_em', end.toISOString());

          if (error) throw error;
          itensData = data || [];
      } catch (error) {
          console.warn("Erro ao buscar detalhes de itens online. Recorrendo ao banco local OFF.", error);
          isOnline = false;
      }
    }
    
    if (!isOnline) {
        const startTime = start.getTime();
        const endTime = end.getTime();

        const comandasLocais = await db.comandas
            .filter(c => c.status === 'fechada' && !!c.fechado_em && new Date(c.fechado_em).getTime() >= startTime && new Date(c.fechado_em).getTime() <= endTime)
            .toArray();
        
        for (const comanda of comandasLocais) {
            const itens = await db.itensComanda.where('id_comanda').equals(comanda.id).toArray();
            for (const item of itens) {
                const produto = await db.produtos.get(item.id_produto);
                itensData.push({
                    quantidade: item.quantidade,
                    valor_unit: item.valor_unit,
                    produto: produto ? { nome: produto.nome } : { nome: 'Desconhecido' }
                });
            }
        }
    }

    const agrupamento: Record<string, ProdutoVendidoDetalhe> = {};

    itensData.forEach(item => {
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