// src/lib/localDatabase.ts
import Dexie, { Table } from 'dexie';
// Mantendo suas importações originais
import { Comanda, ItemComanda, Produto, Cliente, PagamentoInput } from '../types';

// -------------------------------------------------------------------------
// 1. TIPOS LOCAIS
// -------------------------------------------------------------------------

export interface Pagamento extends PagamentoInput {
  id: string;
  id_comanda: string;
  data: string;
}

export interface ComandaLocal extends Comanda {
  pagamentos: Pagamento[];
}

// ATUALIZADO: Adicionado campo 'tentativas' para controle do Sync
export type PendingAction = {
  id?: number; 
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
    | 'DELETAR_PRODUTO'
    | 'MOVIMENTACAO_CAIXA';

  payload: any;
  criado_em: number;
  tentativas?: number; // <--- NOVO: Evita loop infinito no Sync
};

// -------------------------------------------------------------------------
// 2. BANCO DE DADOS LOCAL (DEXIE)
// -------------------------------------------------------------------------

export class LocalDatabase extends Dexie {
  comandas!: Table<ComandaLocal, string>; 
  itensComanda!: Table<ItemComanda, string>;
  produtos!: Table<Produto, string>;
  clientes!: Table<Cliente, string>;
  pagamentos!: Table<Pagamento, string>;
  pending_actions!: Table<PendingAction, number>;

  constructor() {
    super('SystMixDatabase');
    // Mantendo seu schema original. O campo 'tentativas' não precisa estar aqui para ser salvo.
    this.version(1).stores({
      comandas: 'id, numero, status', 
      itensComanda: 'id, id_comanda, id_produto',
      produtos: 'id, nome, ativo', 
      clientes: 'id, nome, telefone',
      pagamentos: 'id, id_comanda',
      pending_actions: '++id, criado_em' 
    });
  }
}

export const db = new LocalDatabase();

const createLocalId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// -------------------------------------------------------------------------
// 3. SERVIÇO (Lógica de Negócio Offline)
// -------------------------------------------------------------------------

export const localDatabaseService = {
  
  // --- GERENCIAMENTO DA FILA (ATUALIZADO) ---
  
  async addPendingAction(type: PendingAction['type'], payload: any): Promise<void> {
    const newAction: Omit<PendingAction, 'id'> = { 
      type, 
      payload, 
      criado_em: Date.now(),
      tentativas: 0 // <--- NOVO: Inicializa contador
    };
    await db.pending_actions.add(newAction as PendingAction);
    console.log(`OFFLINE: Ação agendada [${type}]`, payload);
  },

  async getPendingActions(): Promise<PendingAction[]> {
    const actions = await db.pending_actions.toArray();
    return actions.sort((a, b) => a.criado_em - b.criado_em);
  },
  
  async removePendingAction(id: number): Promise<void> {
    if (!id) return;
    await db.pending_actions.delete(id);
  },

  // --- COMANDAS (MANTIDO ORIGINAL) ---

  async listarAbertas(): Promise<ComandaLocal[]> {
    const comandasLocais = await db.comandas.where('status').equals('aberta').toArray();
    
    for (const comanda of comandasLocais) {
      comanda.itens = await db.itensComanda.where('id_comanda').equals(comanda.id).toArray();
      
      if (comanda.itens) {
        for (const item of comanda.itens) {
            const produtoRel = await db.produtos.get(item.id_produto);
            if (produtoRel) item.produto = produtoRel;
        }
      }

      if (comanda.id_cliente) {
        comanda.cliente = await db.clientes.get(comanda.id_cliente);
      }
      
      comanda.pagamentos = await db.pagamentos.where('id_comanda').equals(comanda.id).toArray();
    }
    return comandasLocais;
  },

  async criarComanda(numero: number, idCliente?: string): Promise<ComandaLocal> {
    const idLocal = createLocalId();
    const novaComanda: ComandaLocal = {
      id: idLocal,
      numero,
      id_cliente: idCliente,
      status: 'aberta',
      criado_em: new Date().toISOString(),
      itens: [],
      pagamentos: []
    };
    
    await db.comandas.add(novaComanda); 

    await this.addPendingAction('CRIAR_COMANDA', { 
      numero, 
      id_cliente: idCliente, 
      idTemp: idLocal 
    });

    return novaComanda;
  },

  async adicionarItem(idComanda: string, item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'>): Promise<ItemComanda> {
    const idLocal = createLocalId();
    const novoItem: ItemComanda = {
      ...item,
      id: idLocal,
      id_comanda: idComanda,
      criado_em: new Date().toISOString()
    };
    
    await db.itensComanda.add(novoItem);

    await this.addPendingAction('ADICIONAR_ITEM', { 
        ...novoItem,
        id_comanda: idComanda 
    });

    return novoItem;
  },

  async fecharComanda(idComanda: string, pagamentosInput: PagamentoInput[]): Promise<void> {
    await db.comandas.update(idComanda, { status: 'fechada', fechado_em: new Date().toISOString() });
    
    const pagamentosCompletos: Pagamento[] = [];
    
    for (const pag of pagamentosInput) {
      const idLocal = createLocalId();
      const novoPagamento: Pagamento = {
        id: idLocal,
        id_comanda: idComanda,
        metodo: pag.metodo,
        valor: pag.valor,
        data: new Date().toISOString()
      };
      
      await db.pagamentos.add(novoPagamento);
      pagamentosCompletos.push(novoPagamento);
    }

    await this.addPendingAction('FECHAR_COMANDA', { 
      id_comanda: idComanda, 
      pagamentos: pagamentosInput
    });
  },

  async atualizarQuantidadeItem(idItem: string, novaQuantidade: number): Promise<void> {
    const item = await db.itensComanda.get(idItem);
    if (!item) return;

    await db.itensComanda.update(idItem, { quantidade: novaQuantidade });

    await this.addPendingAction('ATUALIZAR_QTD_ITEM', {
      id_comanda: item.id_comanda,
      id_item: idItem,
      quantidade: novaQuantidade
    });
  },

  async removerItem(idItem: string): Promise<void> {
    const item = await db.itensComanda.get(idItem);
    if (!item) return;

    await db.itensComanda.delete(idItem);

    await this.addPendingAction('REMOVER_ITEM', {
      id_comanda: item.id_comanda,
      id_item: idItem
    });
  },

  // --- PRODUTOS (MANTIDO ORIGINAL) ---

  async listarProdutos(): Promise<Produto[]> {
    return db.produtos.toArray();
  },
  
  async listarProdutosAtivos(): Promise<Produto[]> {
    return db.produtos.filter(p => p.ativo === true).toArray();
  },

  async criarProduto(produto: Omit<Produto, 'id' | 'criado_em'>): Promise<Produto> {
    const idLocal = createLocalId();
    const novoProduto: Produto = {
      ...produto,
      id: idLocal,
      criado_em: new Date().toISOString()
    };
    
    await db.produtos.add(novoProduto);
    await this.addPendingAction('CRIAR_PRODUTO', { produto: novoProduto });

    return novoProduto;
  },

  async atualizarProduto(id: string, dados: Partial<Produto>): Promise<void> {
    await db.produtos.update(id, dados);
  },

  async deletarProduto(id: string): Promise<void> {
    await db.produtos.delete(id);
  },

  // --- CLIENTES (MANTIDO ORIGINAL) ---

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
    await this.addPendingAction('CRIAR_CLIENTE', { cliente: novoCliente });

    return novoCliente;
  },

  async atualizarCliente(id: string, dados: Partial<Cliente>): Promise<void> {
    await db.clientes.update(id, dados);
  },

  async deletarCliente(id: string): Promise<void> {
    await db.clientes.delete(id);
  }
};