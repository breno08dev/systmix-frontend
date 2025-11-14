import { Cliente, Produto, Comanda, ItemComanda, Pagamento } from './types/index';

export interface PendingAction {
  id?: number;
  action_type: string;
  payload: string; 
  criado_em?: string;
}

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
  
  // Comandas
  getComandasAbertas: () => Promise<Comanda[]>;
  createComanda: (comanda: Comanda) => Promise<Comanda>; 
  addItemComanda: (item: ItemComanda) => Promise<ItemComanda>; 
  updateItemQuantidade: (idItem: string, quantidade: number) => Promise<void>;
  removeItemComanda: (idItem: string) => Promise<void>;
  fecharComanda: (idComanda: string, pagamentos: Omit<Pagamento, 'id' | 'data' | 'id_comanda'>[]) => Promise<void>;

  // Fila de Sincronização
  getPendingActions: () => Promise<PendingAction[]>;
  addPendingAction: (action: Omit<PendingAction, 'id' | 'criado_em'>) => Promise<void>;
  deletePendingAction: (id: number) => Promise<void>;
}

declare global {
  interface Window {
    localApi: ILocalApi;
  }
}