// src/types/index.ts

// Mantenha a interface Categoria se você usa ela em outros lugares (como filtros)
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
  
  // CORREÇÃO: Aceita string (do banco) OU Categoria (se vier populado de uma relação futura)
  // Isso resolve o erro "Type string is not comparable..."
  categoria: string | Categoria; 
  
  // Se você usa id_categoria para relações, mantenha:
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

export interface Comanda {
    id: string;
    numero: number;
    status: 'aberta' | 'fechada'; 
    id_cliente?: string;
    cliente?: Cliente;
    itens?: ItemComanda[];
    criado_em: string;
    fechado_em?: string;
    // Adicionado para satisfazer a interface local caso precise
    pagamentos?: any[]; 
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