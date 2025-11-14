// src/electron.d.ts
import { Cliente, Produto, Comanda } from './types'; // Importe seus tipos

// Interface para as ações pendentes
export interface PendingAction {
  id?: number;
  action_type: string;
  payload: string; // O payload será um JSON stringificado
  criado_em?: string;
}

// Interface da API que expomos no preload.ts
export interface ILocalApi {
  // Clientes
  getClientes: () => Promise<Cliente[]>;
  createCliente: (cliente: Cliente) => Promise<void>;
  updateCliente: (id: string, cliente: Partial<Cliente>) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;

  // Produtos
  getProdutos: () => Promise<Produto[]>;
  createProduto: (produto: Produto) => Promise<void>;
  updateProduto: (id: string, produto: Partial<Produto>) => Promise<void>;
  deleteProduto: (id: string) => Promise<void>;
  
  // Comandas (Exemplo)
  getComandasAbertas: () => Promise<Comanda[]>;
  // ... (outros métodos de comanda) ...

  // Fila de Sincronização
  getPendingActions: () => Promise<PendingAction[]>;
  addPendingAction: (action: Omit<PendingAction, 'id' | 'criado_em'>) => Promise<void>;
  deletePendingAction: (id: number) => Promise<void>;
}

// Estende a interface global 'Window'
declare global {
  interface Window {
    localApi: ILocalApi;
  }
}