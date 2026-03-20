import Dexie, { Table } from 'dexie';
import { Comanda, ItemComanda, Produto, Cliente, PagamentoInput, Sangria } from '../types';

// Interfaces (Mantidas)
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

export class LocalDatabase extends Dexie {
  comandas!: Table<ComandaLocal, string>; 
  itensComanda!: Table<ItemComanda, string>;
  produtos!: Table<Produto, string>;
  clientes!: Table<Cliente, string>;
  pagamentos!: Table<Pagamento, string>;
  pending_actions!: Table<PendingAction, number>;
  sangrias!: Table<Sangria, string>; // <-- ADICIONADO AQUI

  constructor() {
    super('SystMixDatabase');
    
    // <-- VERSÃO ALTERADA PARA 4 E TABELA DE SANGRIAS ADICIONADA
    this.version(4).stores({
      comandas: 'id, numero, status', 
      itensComanda: 'id, id_comanda, id_produto',
      produtos: 'id, nome, ativo, codigo_barras, descricao', 
      clientes: 'id, nome, telefone, email',
      pagamentos: 'id, id_comanda',
      pending_actions: '++id, type, criado_em',
      sangrias: 'id, data' // <-- REGISTRO DA TABELA
    });

    // --- PROTEÇÃO DE CICLO DE VIDA ---
    // Se outra aba atualizar o banco, recarrega para evitar DatabaseClosedError
    this.on('versionchange', () => {
        console.warn('CRÍTICO: Banco atualizado em outra aba. Reiniciando...');
        window.location.reload();
        return false;
    });

    this.on('blocked', () => {
        console.error('CRÍTICO: Banco bloqueado. Tentando liberar conexões...');
    });
  }
}

// 1. SINGLETON (Única instância)
export const db = new LocalDatabase();

// --- LÓGICA DE RETRY E RESET (Self-Healing) ---

// Função para tentar recuperar o banco em caso de falha catastrófica
const resetDatabase = async () => {
    console.error("⚠️ INICIANDO RESET DE EMERGÊNCIA DO BANCO DE DADOS ⚠️");
    try {
        db.close();
        await Dexie.delete('SystMixDatabase');
        console.log("Banco deletado. Recriando...");
        await db.open();
    } catch (e) {
        console.error("FALHA FATAL AO RESETAR BANCO:", e);
        // Último recurso: recarregar a página para limpar locks do navegador
        window.location.reload();
    }
};

const ensureDbOpen = async (retryCount = 0): Promise<void> => {
    if (db.isOpen()) return;

    try {
        await db.open();
    } catch (err: any) {
        console.warn(`Tentativa de abertura ${retryCount + 1} falhou:`, err);
        
        if (retryCount < 2) {
            await new Promise(r => setTimeout(r, 200)); // Espera 200ms
            return ensureDbOpen(retryCount + 1);
        }

        // Se for erro de versão ou bloqueio persistente, reseta
        if (err.name === 'VersionError' || err.name === 'OpenFailedError') {
            await resetDatabase();
        } else {
            throw err;
        }
    }
};

// Wrapper genérico para transações seguras
async function executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
        await ensureDbOpen();
        return await operation();
    } catch (error: any) {
        // Se o erro for DatabaseClosed, tenta reabrir e executa uma vez mais
        if (error.name === 'DatabaseClosedError' || error.message?.includes('closed')) {
            console.warn("DatabaseClosedError detectado. Tentando reabrir e repetir...");
            try {
                await ensureDbOpen();
                return await operation();
            } catch (retryError) {
                console.error("Falha na repetição da operação:", retryError);
                throw retryError;
            }
        }
        throw error;
    }
}

const createLocalId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 2. SERVIÇO REFATORADO COM WRAPPER
export const localDatabaseService = {
  
  async addPendingAction(type: string, payload: any): Promise<void> {
    await executeWithRetry(async () => {
        await db.transaction('rw', db.pending_actions, async () => {
            // Lógica de deduplicação mantida
            const lastAction = await db.pending_actions.orderBy('criado_em').last();
            if (lastAction) {
                const isSameType = lastAction.type === type;
                const isRecent = (Date.now() - lastAction.criado_em) < 2000; 
                const payloadStr = JSON.stringify(payload);
                const lastPayloadStr = JSON.stringify(lastAction.payload);
                
                if (isSameType && isRecent && payloadStr === lastPayloadStr) return;
            }

            await db.pending_actions.add({ 
              type, 
              payload, 
              criado_em: Date.now(),
              tentativas: 0 
            });
        });
    });
  },

  async getPendingActions(): Promise<PendingAction[]> {
    return executeWithRetry(async () => {
        return await db.pending_actions.orderBy('criado_em').toArray();
    });
  },
  
  async removePendingAction(id: number): Promise<void> {
    if (!id) return;
    await executeWithRetry(async () => {
        await db.pending_actions.delete(id);
    });
  },

  async listarAbertas(): Promise<ComandaLocal[]> {
    return executeWithRetry(async () => {
        return await db.transaction('r', [db.comandas, db.itensComanda, db.produtos, db.clientes, db.pagamentos], async () => {
            const comandasLocais = await db.comandas.where('status').equals('aberta').toArray();
            
            await Promise.all(comandasLocais.map(async (comanda) => {
                 comanda.itens = await db.itensComanda.where('id_comanda').equals(comanda.id).toArray();
                 if (comanda.itens) {
                     for (const item of comanda.itens) {
                         const p = await db.produtos.get(item.id_produto);
                         if (p) item.produto = p;
                     }
                 }
                 if (comanda.id_cliente) {
                     comanda.cliente = await db.clientes.get(comanda.id_cliente);
                 }
                 comanda.pagamentos = await db.pagamentos.where('id_comanda').equals(comanda.id).toArray();
            }));
            return comandasLocais;
        });
    });
  },

 async criarComanda(numero: number, idCliente?: string): Promise<ComandaLocal> {
    const idLocal = createLocalId();
    return executeWithRetry(async () => {
        return await db.transaction('rw', [db.comandas, db.clientes, db.pending_actions], async () => {
            let clienteDados = undefined;
            if (idCliente) clienteDados = await db.clientes.get(idCliente);

            const novaComanda: ComandaLocal = {
                id: idLocal,
                numero,
                id_cliente: idCliente,
                status: 'aberta',
                criado_em: new Date().toISOString(),
                itens: [],
                pagamentos: [],
                cliente: clienteDados 
            };
            
            await db.comandas.add(novaComanda); 
            await db.pending_actions.add({
                type: 'CRIAR_COMANDA',
                payload: { numero, id_cliente: idCliente, idTemp: idLocal },
                criado_em: Date.now(),
                tentativas: 0
            });
            return novaComanda;
        });
    });
  },
  
  async adicionarItem(idComanda: string, item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'>): Promise<ItemComanda> {
    const idLocal = createLocalId();
    const novoItem: ItemComanda = { ...item, id: idLocal, id_comanda: idComanda, criado_em: new Date().toISOString() };
    
    return executeWithRetry(async () => {
        await db.transaction('rw', [db.itensComanda, db.pending_actions], async () => {
            await db.itensComanda.add(novoItem);
            await db.pending_actions.add({
                 type: 'ADICIONAR_ITEM',
                 payload: { ...novoItem, id_comanda: idComanda },
                 criado_em: Date.now(),
                 tentativas: 0
            });
        });
        return novoItem;
    });
  },

  async fecharComanda(idComanda: string, pagamentosInput: PagamentoInput[]): Promise<void> {
    await executeWithRetry(async () => {
        await db.transaction('rw', [db.comandas, db.pagamentos, db.pending_actions], async () => {
            const comanda = await db.comandas.get(idComanda);
            if (comanda && comanda.status === 'fechada') return;

            const dataFechamento = new Date().toISOString();
            await db.comandas.update(idComanda, { status: 'fechada', fechado_em: dataFechamento });
            
            for (const pag of pagamentosInput) {
                await db.pagamentos.add({
                    id: createLocalId(),
                    id_comanda: idComanda,
                    metodo: pag.metodo,
                    valor: pag.valor,
                    data: dataFechamento
                });
            }

            await db.pending_actions.add({
                type: 'FECHAR_COMANDA',
                payload: { idComanda, dataFechamento, pagamentos: pagamentosInput },
                criado_em: Date.now(),
                tentativas: 0
            });
        });
    });
  },

  async atualizarQuantidadeItem(idItem: string, novaQuantidade: number): Promise<void> {
    await executeWithRetry(async () => {
        const item = await db.itensComanda.get(idItem);
        if (!item) return;

        await db.transaction('rw', [db.itensComanda, db.pending_actions], async () => {
            await db.itensComanda.update(idItem, { quantidade: novaQuantidade });
            await db.pending_actions.add({
                type: 'ATUALIZAR_QTD_ITEM',
                payload: { id_comanda: item.id_comanda, id_item: idItem, quantidade: novaQuantidade },
                criado_em: Date.now(),
                tentativas: 0
            });
        });
    });
  },

  async removerItem(idItem: string): Promise<void> {
    await executeWithRetry(async () => {
        const item = await db.itensComanda.get(idItem);
        if (!item) return;
        
        await db.transaction('rw', [db.itensComanda, db.pending_actions], async () => {
            await db.itensComanda.delete(idItem);
            await db.pending_actions.add({
                type: 'REMOVER_ITEM',
                payload: { id_comanda: item.id_comanda, id_item: idItem },
                criado_em: Date.now(),
                tentativas: 0
            });
        });
    });
  },

  async deletarComanda(id: string): Promise<void> {
    await executeWithRetry(async () => {
        await db.transaction('rw', db.comandas, db.itensComanda, async () => {
            await db.itensComanda.where('id_comanda').equals(id).delete();
            await db.comandas.delete(id);
        });
    });
  },

  // Wrappers simples com retry
  async listarProdutos(): Promise<Produto[]> { return executeWithRetry(() => db.produtos.toArray()); },
  async listarProdutosAtivos(): Promise<Produto[]> { return executeWithRetry(() => db.produtos.filter(p => p.ativo === true).toArray()); },
  
  async criarProduto(produto: Omit<Produto, 'id' | 'criado_em'>): Promise<Produto> {
    const idLocal = createLocalId();
    const novo = { ...produto, id: idLocal, criado_em: new Date().toISOString() };
    return executeWithRetry(async () => {
        await db.transaction('rw', [db.produtos, db.pending_actions], async () => {
            await db.produtos.add(novo);
            await db.pending_actions.add({ type: 'CRIAR_PRODUTO', payload: { produto: novo }, criado_em: Date.now(), tentativas: 0 });
        });
        return novo;
    });
  },
  
  async atualizarProduto(id: string, dados: Partial<Produto>): Promise<void> { await executeWithRetry(() => db.produtos.update(id, dados)); },
  async deletarProduto(id: string): Promise<void> { await executeWithRetry(() => db.produtos.delete(id)); },
  
  async listarClientes(): Promise<Cliente[]> { return executeWithRetry(() => db.clientes.toArray()); },
  
  async criarCliente(cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente> {
    const idLocal = createLocalId();
    const novo = { ...cliente, id: idLocal, criado_em: new Date().toISOString() };
    return executeWithRetry(async () => {
        await db.transaction('rw', [db.clientes, db.pending_actions], async () => {
            await db.clientes.add(novo);
            await db.pending_actions.add({ type: 'CRIAR_CLIENTE', payload: { cliente: novo }, criado_em: Date.now(), tentativas: 0 });
        });
        return novo;
    });
  },
  
  async atualizarCliente(id: string, dados: Partial<Cliente>): Promise<void> { await executeWithRetry(() => db.clientes.update(id, dados)); },
  async deletarCliente(id: string): Promise<void> { await executeWithRetry(() => db.clientes.delete(id)); }
};