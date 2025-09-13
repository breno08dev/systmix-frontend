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

export interface RelatorioVendas {
  total_vendas: number;
  total_comandas: number;
  item_mais_vendido: string;
  ticket_medio: number;
  media_itens_comanda: number;
  // NOVO CAMPO ADICIONADO
  pagamentos_por_metodo: { metodo: string; total: number }[];
}