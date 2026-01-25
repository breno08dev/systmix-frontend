// src/types/index.ts

export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number; // Campo necessário para a lógica de estoque
  ativo: boolean;
  criado_em: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  cpf?: string;
  criado_em: string;
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

// Tipo completo do banco (para leitura)
export interface Pagamento {
  id: string;
  id_comanda: string;
  metodo: string;
  valor: number;
  data: string;
}

// NOVO: Tipo simplificado para envio (Corrige o erro de tipagem no Modal)
export interface PagamentoInput {
  metodo: string;
  valor: number;
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