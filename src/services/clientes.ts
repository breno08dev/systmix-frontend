// src/services/clientes.ts (HÍBRIDO)
import { Cliente } from '../types';
import { localDatabaseService } from '../lib/localDatabase';
import { supabaseClientesService } from './supabaseService';

export const clientesService = {
  async listar(isOnline: boolean): Promise<Cliente[]> {
    if (isOnline) {
      // TODO: Salvar no Dexie
      return await supabaseClientesService.listar();
    } else {
      // TODO: Implementar localDatabaseService.listarClientes()
      return [];
    }
  },

  async criar(isOnline: boolean, cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente | void> {
    if (isOnline) {
      return await supabaseClientesService.criar(cliente);
    } else {
      // TODO: Implementar local
      await localDatabaseService.addPendingAction('CRIAR_CLIENTE', { cliente });
    }
  },

  async atualizar(isOnline: boolean, id: string, cliente: Partial<Cliente>): Promise<Cliente | void> {
    if (isOnline) {
      return await supabaseClientesService.atualizar(id, cliente);
    } else {
      // TODO: Implementar local
      await localDatabaseService.addPendingAction('ATUALIZAR_CLIENTE', { id, cliente });
    }
  },

  async deletar(isOnline: boolean, id: string): Promise<void> {
    if (isOnline) {
      return await supabaseClientesService.deletar(id);
    } else {
      // TODO: Implementar local
      await localDatabaseService.addPendingAction('DELETAR_CLIENTE', { id });
    }
  },
};