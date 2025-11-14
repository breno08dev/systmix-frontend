// src/services/produtos.ts (HÍBRIDO)
import { Produto } from '../types';
import { localDatabaseService } from '../lib/localDatabase';
import { supabaseProdutosService } from './supabaseService';

export const produtosService = {
  async listar(isOnline: boolean): Promise<Produto[]> {
    if (isOnline) {
      // TODO: Salvar no Dexie
      return await supabaseProdutosService.listar();
    } else {
      // TODO: Implementar localDatabaseService.listar()
      return []; 
    }
  },

  async listarAtivos(isOnline: boolean): Promise<Produto[]> {
    if (isOnline) {
      // TODO: Salvar no Dexie
      return await supabaseProdutosService.listarAtivos();
    } else {
      // TODO: Implementar localDatabaseService.listarAtivos()
      return [];
    }
  },

  async criar(isOnline: boolean, produto: Omit<Produto, 'id' | 'criado_em'>): Promise<Produto | void> {
    if (isOnline) {
      return await supabaseProdutosService.criar(produto);
    } else {
      // TODO: Implementar local
      await localDatabaseService.addPendingAction('CRIAR_PRODUTO', { produto });
    }
  },

  async atualizar(isOnline: boolean, id: string, produto: Partial<Produto>): Promise<Produto | void> {
    if (isOnline) {
      return await supabaseProdutosService.atualizar(id, produto);
    } else {
      // TODO: Implementar local
      await localDatabaseService.addPendingAction('ATUALIZAR_PRODUTO', { id, produto });
    }
  },
  
  async deletar(isOnline: boolean, id: string): Promise<void> {
    if (isOnline) {
      return await supabaseProdutosService.deletar(id);
    } else {
      // TODO: Implementar local
      await localDatabaseService.addPendingAction('DELETAR_PRODUTO', { id });
    }
  },

  async verificarUsoProduto(isOnline: boolean, id: string): Promise<boolean> {
    if (isOnline) {
      return await supabaseProdutosService.verificarUsoProduto(id);
    } else {
      // TODO: Implementar local
      return false;
    }
  }
};