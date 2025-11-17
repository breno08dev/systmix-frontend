// src/types/index.ts (VERSÃO COMPLETA E CORRIGIDA)
export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  ativo: boolean;
  criado_em: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  criado_em: string;
}

export interface Comanda {
  id: string;
  numero: number;
  id_cliente?: string;
  status: 'aberta' | 'fechada';
  criado_em: string;
  fechado_em?: string;
  cliente?: Cliente;
  itens?: ItemComanda[];
  pagamentos?: Pagamento[];
}

export interface ItemComanda {
  id: string;
  id_comanda: string;
  id_produto: string;
  quantidade: number;
  valor_unit: number;
  criado_em: string;
  produto?: Produto;
}

export interface Pagamento {
  id: string;
  id_comanda: string;
  metodo: string;
  valor: number;
  data: string;
}

// Tipo para o Dashboard e Busca Personalizada
export interface RelatorioVendas {
  total_vendas: number;
  total_comandas: number;
  ticket_medio: number;
  pagamentos_por_metodo: { metodo_agrupado: string; total: number }[]; // Corrigido
}

export interface Caixa {
  id: string;
  data_abertura: string;
  valor_inicial: number;
  data_fechamento?: string;
  valor_final?: number;
}

// Tipos para o Resumo Geral (Hoje, Ontem...)
export interface ResumoPeriodo {
  total_vendido: number;
  cartao: number;
  pix: number;
  dinheiro: number;
  total_pedidos: number;
}

export interface ResumoDashboard {
  hoje: ResumoPeriodo;
  ontem: ResumoPeriodo;
  ultimos_7_dias: ResumoPeriodo;
  ultimos_30_dias: ResumoPeriodo;
}