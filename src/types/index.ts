// src/types/index.ts

export interface Categoria {
  id: string; // ou number, dependendo do banco (Supabase usa UUID ou int)
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
  
  // Novos campos para vincular Categoria
  id_categoria?: string | null; 
  categoria?: Categoria; 
  
  criado_em?: string;
}

export interface Cliente {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
    criado_em?: string;
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
  saldo_inicial: number; // Espera "saldo_inicial"
  saldo_atual: number;   // Espera "saldo_atual"
  aberto_em: string;     // Espera "aberto_em"
  fechado_em?: string;   // Espera "fechado_em"
  operador?: string;
}