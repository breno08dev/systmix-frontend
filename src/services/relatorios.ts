import { supabase } from '../lib/supabase';
import { RelatorioVendas } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Remove a declaração de módulo pois não é mais necessária

// Função auxiliar para buscar os dados detalhados para o PDF
const obterDadosDetalhadosParaPDF = async (dataInicio: string, dataFim: string) => {
  const { data, error } = await supabase
    .from('comandas')
    .select(`
      numero, fechado_em,
      cliente:clientes(nome),
      itens:itens_comanda(quantidade, valor_unit, produto:produtos(nome))
    `)
    .eq('status', 'fechada')
    .gte('fechado_em', dataInicio)
    .lte('fechado_em', dataFim)
    .order('fechado_em', { ascending: true });

  if (error) {
    console.error("Erro ao buscar dados detalhados para PDF:", error);
    throw error;
  }
  return data || [];
};

export const relatoriosService = {
  async obterFaturamentoHoje(): Promise<number> {
    const hoje = new Date();
    const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
    const dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString();

    const { data, error } = await supabase.from('pagamentos').select('valor').gte('data', dataInicio).lte('data', dataFim);
    if (error) throw error;
    
    return data?.reduce((sum, venda) => sum + venda.valor, 0) || 0;
  },

  async obterVendasPorPeriodo(dataInicio: string, dataFim: string): Promise<RelatorioVendas> {
    const { data: vendas, error: vendasError } = await supabase.from('pagamentos').select('valor').gte('data', dataInicio).lte('data', dataFim);
    if (vendasError) throw vendasError;

    const { count: totalComandas, error: comandasError } = await supabase.from('comandas').select('*', { count: 'exact', head: true }).eq('status', 'fechada').gte('fechado_em', dataInicio).lte('fechado_em', dataFim);
    if (comandasError) throw comandasError;

    const { data: itens, error: itensError } = await supabase.from('itens_comanda').select(`quantidade, produto:produtos(nome), comanda:comandas!inner(fechado_em)`).gte('comanda.fechado_em', dataInicio).lte('comanda.fechado_em', dataFim);
    if (itensError) throw itensError;

    const totalVendas = vendas?.reduce((sum, v) => sum + v.valor, 0) || 0;
    const totalItensVendidos = itens?.reduce((sum, i) => sum + i.quantidade, 0) || 0;
    const ticketMedio = totalComandas && totalComandas > 0 ? totalVendas / totalComandas : 0;
    const mediaItensComanda = totalComandas && totalComandas > 0 ? totalItensVendidos / totalComandas : 0;

    const itemCount: Record<string, number> = {};
    itens?.forEach(item => {
      const produto = Array.isArray(item.produto) ? item.produto[0] : item.produto;
      const nome = produto?.nome || 'Desconhecido';
      itemCount[nome] = (itemCount[nome] || 0) + item.quantidade;
    });

    const itemMaisVendido = Object.entries(itemCount).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Nenhum';

    return {
      total_vendas: totalVendas,
      total_comandas: totalComandas || 0,
      item_mais_vendido: itemMaisVendido,
      ticket_medio: ticketMedio,
      media_itens_comanda: mediaItensComanda,
    };
  },

  async exportarVendasPDF(relatorio: RelatorioVendas, dataInicio: string, dataFim: string): Promise<void> {
    const dadosDetalhados = await obterDadosDetalhadosParaPDF(dataInicio, dataFim);
    
    const doc = new jsPDF();
    const dataInicioFormatada = new Date(`${dataInicio}T12:00:00`).toLocaleDateString('pt-BR');
    const dataFimFormatada = new Date(`${dataFim}T12:00:00`).toLocaleDateString('pt-BR');

    doc.setFontSize(18);
    doc.text('Relatório de Vendas', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Período de ${dataInicioFormatada} a ${dataFimFormatada}`, 14, 29);

    autoTable(doc, {
      startY: 40,
      head: [['Resumo do Período']],
      body: [
        [`Total de Vendas: R$ ${relatorio.total_vendas.toFixed(2)}`],
        [`Total de Comandas: ${relatorio.total_comandas}`],
        [`Ticket Médio: R$ ${relatorio.ticket_medio.toFixed(2)}`],
        [`Item Mais Vendido: ${relatorio.item_mais_vendido}`],
      ],
      theme: 'grid'
    });

    const corpoTabela = dadosDetalhados.flatMap(comanda => 
      (comanda.itens || []).map(item => {
        const cliente = Array.isArray(comanda.cliente) ? comanda.cliente[0] : comanda.cliente;
        const produto = Array.isArray(item.produto) ? item.produto[0] : item.produto;
        return [
          comanda.numero,
          cliente?.nome || 'N/A',
          new Date(comanda.fechado_em!).toLocaleDateString('pt-BR'),
          produto?.nome || 'N/A',
          item.quantidade,
          `R$ ${item.valor_unit.toFixed(2)}`,
          `R$ ${(item.quantidade * item.valor_unit).toFixed(2)}`
        ];
      })
    );

    autoTable(doc, {
      startY: (doc as any).autoTable.previous.finalY + 10,
      head: [['Comanda', 'Cliente', 'Data', 'Item', 'Qtd', 'Vlr. Unit.', 'Total Item']],
      body: corpoTabela,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
    });

    doc.save(`relatorio_vendas_${dataInicioFormatada}_a_${dataFimFormatada}.pdf`);
  }
};