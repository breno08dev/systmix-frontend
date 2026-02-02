// src/lib/localDatabase.ts
import Dexie, { Table } from 'dexie';
import { Comanda, ItemComanda, Produto, Cliente, PagamentoInput } from '../types';

// 1. TIPOS LOCAIS
export interface Pagamento extends PagamentoInput {
  id: string;
  id_comanda: string;
  data: string;
}

export interface ComandaLocal extends Comanda {
  pagamentos: Pagamento[];
}

export type PendingAction = {
  id?: number; 
  type: string;
  payload: any;
  criado_em: number;
  tentativas?: number;
};

// 2. BANCO DE DADOS LOCAL (DEXIE)
export class LocalDatabase extends Dexie {
  comandas!: Table<ComandaLocal, string>; 
  itensComanda!: Table<ItemComanda, string>;
  produtos!: Table<Produto, string>;
  clientes!: Table<Cliente, string>;
  pagamentos!: Table<Pagamento, string>;
  pending_actions!: Table<PendingAction, number>;

  constructor() {
    super('SystMixDatabase');
    this.version(2).stores({
      comandas: 'id, numero, status', 
      itensComanda: 'id, id_comanda, id_produto',
      produtos: 'id, nome, ativo, codigo_barras,descricao', 
      clientes: 'id, nome, telefone, email',
      pagamentos: 'id, id_comanda',
      pending_actions: '++id, criado_em' 
    });
  }
}

export const db = new LocalDatabase();

const createLocalId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 3. SERVIÇO
export const localDatabaseService = {
  
  // --- PREVENÇÃO DE DUPLICIDADE (NOVO) ---
  async addPendingAction(type: string, payload: any): Promise<void> {
    // Verifica a última ação adicionada para evitar "clique duplo"
    const lastAction = await db.pending_actions.orderBy('criado_em').last();
    
    // Se a última ação for igualzinha e ocorreu a menos de 2 segundos, ignoramos.
    if (lastAction) {
        const isSameType = lastAction.type === type;
        const isRecent = (Date.now() - lastAction.criado_em) < 2000; // 2 segundos de tolerância
        
        // Comparação profunda simplificada para payload
        const payloadStr = JSON.stringify(payload);
        const lastPayloadStr = JSON.stringify(lastAction.payload);
        
        if (isSameType && isRecent && payloadStr === lastPayloadStr) {
            console.warn(`OFFLINE: Ação duplicada [${type}] ignorada.`);
            return;
        }

        // Prevenção extra para Fechar Comanda (mesmo ID)
        if (type === 'FECHAR_COMANDA' && isSameType && payload.idComanda === lastAction.payload.idComanda) {
             console.warn(`OFFLINE: Fechamento duplicado para comanda ${payload.idComanda} ignorado.`);
             return;
        }
    }

    const newAction: Omit<PendingAction, 'id'> = { 
      type, 
      payload, 
      criado_em: Date.now(),
      tentativas: 0 
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

  // --- COMANDAS ---

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
    
    // 1. Busca os dados do cliente para exibir o nome na tela IMEDIATAMENTE
    let clienteDados = undefined;
    if (idCliente) {
        clienteDados = await db.clientes.get(idCliente);
    }

    const novaComanda: ComandaLocal = {
      id: idLocal,
      numero,
      id_cliente: idCliente,
      status: 'aberta',
      criado_em: new Date().toISOString(),
      itens: [],
      pagamentos: [],
      // 2. Anexa o objeto cliente completo aqui
      cliente: clienteDados 
    };
    
    // Salva no banco (o Dexie salva o objeto 'cliente' junto se ele estiver na estrutura)
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
    // Verifica se JÁ está fechada localmente para nem iniciar o processo
    const comanda = await db.comandas.get(idComanda);
    if (comanda && comanda.status === 'fechada') {
        console.warn("OFFLINE: Comanda já fechada localmente.");
        return;
    }

    const dataFechamento = new Date().toISOString();

    await db.comandas.update(idComanda, { status: 'fechada', fechado_em: dataFechamento });
    
    const pagamentosCompletos: Pagamento[] = [];
    
    for (const pag of pagamentosInput) {
      const idLocal = createLocalId();
      const novoPagamento: Pagamento = {
        id: idLocal,
        id_comanda: idComanda,
        metodo: pag.metodo,
        valor: pag.valor,
        data: dataFechamento
      };
      
      await db.pagamentos.add(novoPagamento);
      pagamentosCompletos.push(novoPagamento);
    }

    await this.addPendingAction('FECHAR_COMANDA', { 
      idComanda, 
      dataFechamento: dataFechamento, 
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

  // --- PRODUTOS, CLIENTES (Sem Alterações) ---
  async listarProdutos(): Promise<Produto[]> { return db.produtos.toArray(); },
  async listarProdutosAtivos(): Promise<Produto[]> { return db.produtos.filter(p => p.ativo === true).toArray(); },
  async criarProduto(produto: Omit<Produto, 'id' | 'criado_em'>): Promise<Produto> {
    const idLocal = createLocalId();
    const novoProduto = { ...produto, id: idLocal, criado_em: new Date().toISOString() };
    await db.produtos.add(novoProduto);
    await this.addPendingAction('CRIAR_PRODUTO', { produto: novoProduto });
    return novoProduto;
  },
  async atualizarProduto(id: string, dados: Partial<Produto>): Promise<void> { await db.produtos.update(id, dados); },
  async deletarProduto(id: string): Promise<void> { await db.produtos.delete(id); },
  async listarClientes(): Promise<Cliente[]> { return db.clientes.toArray(); },
  async criarCliente(cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente> {
    const idLocal = createLocalId();
    const novoCliente = { ...cliente, id: idLocal, criado_em: new Date().toISOString() };
    await db.clientes.add(novoCliente);
    await this.addPendingAction('CRIAR_CLIENTE', { cliente: novoCliente });
    return novoCliente;
  },
  async atualizarCliente(id: string, dados: Partial<Cliente>): Promise<void> { await db.clientes.update(id, dados); },
  async deletarCliente(id: string): Promise<void> { await db.clientes.delete(id); }
};