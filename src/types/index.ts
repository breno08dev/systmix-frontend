// src/types/index.ts

export interface Categoria {
  id: string; 
  nome: string;
  ativa: boolean;
  criado_em?: string;
}

export interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  estoque: number;
  codigo_barras?: string;
  imagem_url?: string;
  ativo: boolean;
  categoria: string | Categoria; 
  id_categoria?: string | null; 
  criado_em?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  criado_em?: string;
}

export interface Pagamento {
  id?: string;
  id_comanda?: string;
  metodo: string;
  valor: number;
  data?: string;
}

export interface Comanda {
  id: string;
  numero: number;
  status: 'aberta' | 'fechada' | 'cancelada'; 
  id_cliente?: string;
  cliente?: Cliente;
  itens?: ItemComanda[];
  criado_em: string;
  fechado_em?: string;
  pagamentos?: Pagamento[]; 
}

export interface ItemComanda {
  id: string;
  id_comanda: string;
  id_produto: string;
  produto?: Produto;
  quantidade: number;
  valor_unit: number;
  criado_em?: string;
}

export interface PagamentoInput {
  metodo: string;
  valor: number;
}

export interface Caixa {
  id: string;
  aberto: boolean;
  valor_inicial: number;
  valor_final?: number | null; 
  data_abertura: string;
  data_fechamento?: string | null;
  operador?: string | null;
  saldo_atual_local?: number;
}

export interface Sangria {
  id: string;
  id_caixa?: string;
  valor: number;
  motivo: string;
  data: string;
}

