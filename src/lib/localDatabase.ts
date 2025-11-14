// src/lib/localDatabase.ts
import Dexie, { Table } from 'dexie';
import { Comanda, ItemComanda, Produto, Cliente, Pagamento } from '../types';

// 1. DEFINIÇÃO DA "FILA DE SINCRONIZAÇÃO"
export type PendingAction = {
  id?: number; // O Dexie vai autoincrementar
  type: 
    | 'CRIAR_COMANDA' 
    | 'ADICIONAR_ITEM' 
    | 'FECHAR_COMANDA'
    | 'ATUALIZAR_QTD_ITEM'
    | 'REMOVER_ITEM'
    | 'CRIAR_CLIENTE'
    | 'ATUALIZAR_CLIENTE'
    | 'DELETAR_CLIENTE'
    | 'CRIAR_PRODUTO'
    | 'ATUALIZAR_PRODUTO'
    | 'DELETAR_PRODUTO';
  payload: any;
  criado_em: number;
};

// 2. DEFINIÇÃO DO BANCO DE DADOS LOCAL
// Usamos chaves primárias 'string' (id) para espelhar o Supabase (UUID)
// e IDs temporários (ex: 'local_12345') para dados criados offline.
export class LocalDatabase extends Dexie {
  comandas!: Table<Comanda, string>;
  itensComanda!: Table<ItemComanda, string>;
  produtos!: Table<Produto, string>;
  clientes!: Table<Cliente, string>;
  pagamentos!: Table<Pagamento, string>;
  pending_actions!: Table<PendingAction, number>; // Chave numérica autoincrementada

  constructor() {
    super('SystMixDatabase');
    this.version(1).stores({
      comandas: 'id, numero, status', // Chave primária 'id' (string)
      itensComanda: 'id, id_comanda, id_produto',
      produtos: 'id, nome, categoria, ativo',
      clientes: 'id, nome, telefone',
      pagamentos: 'id, id_comanda',
      pending_actions: '++id, criado_em' // Chave 'id' (number) autoincrementada
    });
  }
}

// 3. INSTÂNCIA GLOBAL DO BANCO LOCAL
export const db = new LocalDatabase();

// 4. HELPER PARA CRIAR ID LOCAL
const createLocalId = () => `local_${Date.now()}`;

// 5. O SERVIÇO QUE O RESTO DO APP VAI USAR
export const localDatabaseService = {
  
  // --- Funções de Comanda ---
  async listarAbertas(): Promise<Comanda[]> {
    console.log('OFFLINE: Buscando comandas do Dexie/SQLite');
    const comandasLocais = await db.comandas.where('status').equals('aberta').toArray();
    
    for (const comanda of comandasLocais) {
      comanda.itens = await db.itensComanda.where('id_comanda').equals(comanda.id).toArray();
      if (comanda.id_cliente) {
        comanda.cliente = await db.clientes.get(comanda.id_cliente);
      }
    }
    return comandasLocais;
  },

  async criarComanda(numero: number, idCliente?: string): Promise<Comanda> {
    console.log('OFFLINE: Criando comanda no Dexie/SQLite');
    const idLocal = createLocalId();
    const novaComanda: Comanda = {
      id: idLocal,
      numero,
      id_cliente: idCliente,
      status: 'aberta',
      criado_em: new Date().toISOString(),
      itens: [],
      pagamentos: []
    };
    await db.comandas.add(novaComanda); 
    return novaComanda;
  },

  async adicionarItem(idComanda: string, item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'>): Promise<ItemComanda> {
    console.log('OFFLINE: Adicionando item localmente');
    const idLocal = createLocalId();
    const novoItem: ItemComanda = {
      ...item,
      id: idLocal,
      id_comanda: idComanda,
      criado_em: new Date().toISOString()
    };
    await db.itensComanda.add(novoItem);
    return novoItem;
  },

  async fecharComanda(idComanda: string, pagamentos: Omit<Pagamento, 'id' | 'data' | 'id_comanda'>[]): Promise<void> {
    console.log('OFFLINE: Fechando comanda localmente');
    await db.comandas.update(idComanda, { status: 'fechada', fechado_em: new Date().toISOString() });
    for (const pag of pagamentos) {
      const idLocal = createLocalId();
      await db.pagamentos.add({
        ...pag,
        id: idLocal,
        id_comanda: idComanda,
        data: new Date().toISOString()
      });
    }
  },

  async atualizarQuantidadeItem(idItem: string, novaQuantidade: number): Promise<void> {
    await db.itensComanda.update(idItem, { quantidade: novaQuantidade });
  },

  async removerItem(idItem: string): Promise<void> {
    await db.itensComanda.delete(idItem);
  },

  // --- Funções de Produto ---
  async listarProdutos(): Promise<Produto[]> {
    return db.produtos.toArray();
  },
  async listarProdutosAtivos(): Promise<Produto[]> {
    return db.produtos.where('ativo').equals(1).toArray(); // 'true' é 1 no index do Dexie
  },
  async criarProduto(produto: Omit<Produto, 'id' | 'criado_em'>): Promise<Produto> {
    const idLocal = createLocalId();
    const novoProduto: Produto = {
      ...produto,
      id: idLocal,
      criado_em: new Date().toISOString()
    };
    await db.produtos.add(novoProduto);
    return novoProduto;
  },
  async atualizarProduto(id: string, produto: Partial<Produto>): Promise<void> {
    await db.produtos.update(id, produto);
  },
  async deletarProduto(id: string): Promise<void> {
    await db.produtos.delete(id);
  },

  // --- Funções de Cliente ---
  async listarClientes(): Promise<Cliente[]> {
    return db.clientes.toArray();
  },
  async criarCliente(cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente> {
    const idLocal = createLocalId();
    const novoCliente: Cliente = {
      ...cliente,
      id: idLocal,
      criado_em: new Date().toISOString()
    };
    await db.clientes.add(novoCliente);
    return novoCliente;
  },
  async atualizarCliente(id: string, cliente: Partial<Cliente>): Promise<void> {
    await db.clientes.update(id, cliente);
  },
  async deletarCliente(id: string): Promise<void> {
    await db.clientes.delete(id);
  },

  // --- FUNÇÕES DE SINCRONIZAÇÃO (Onde estava seu erro) ---

  async addPendingAction(type: PendingAction['type'], payload: any): Promise<void> {
    const newAction: Omit<PendingAction, 'id'> = { type, payload, criado_em: Date.now() };
    await db.pending_actions.add(newAction as PendingAction);
    console.log('OFFLINE: Ação pendente adicionada:', newAction);
  },

  async getPendingActions(): Promise<PendingAction[]> {
    console.log('SYNC: Buscando ações pendentes...');
    const actions = await db.pending_actions.toArray();
    
    // ✅ CORREÇÃO APLICADA (erro da imagem image_35eff1.png)
    // Adicionamos os tipos (a: PendingAction, b: PendingAction)
    return actions.sort((a: PendingAction, b: PendingAction) => a.criado_em - b.criado_em);
  },
  
  async removePendingAction(id: number): Promise<void> {
    if (!id) return;
    await db.pending_actions.delete(id);
    console.log('SYNC: Ação removida da fila:', id);
  }
};