// src/services/clientes.ts
import { Cliente } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';
import { supabaseClientesService } from './supabaseService';

export const clientesService = {
  async listar(isOnline: boolean): Promise<Cliente[]> {
    if (isOnline) {
      try {
        const clientes = await supabaseClientesService.listar();
        
        // CACHE: Salva clientes no banco local
        if (clientes && clientes.length > 0) {
            await db.clientes.bulkPut(clientes);
        }
        return clientes;
      } catch (err) {
        console.warn("Falha ao buscar clientes online, usando cache.");
        return await localDatabaseService.listarClientes();
      }
    } else {
      return await localDatabaseService.listarClientes();
    }
  },

  async criar(isOnline: boolean, cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente | void> {
    if (isOnline) {
      const novoCliente = await supabaseClientesService.criar(cliente);
      if (novoCliente) await db.clientes.put(novoCliente);
      return novoCliente;
    } else {
      const localCliente = await localDatabaseService.criarCliente(cliente);
      
      // CORREÇÃO: Envia 'tempId' para o cliente também
      await localDatabaseService.addPendingAction('CRIAR_CLIENTE', { 
        cliente,
        tempId: localCliente.id // <--- IMPORTANTE
      });
      
      return localCliente;
    }
  },

  async atualizar(isOnline: boolean, id: string, cliente: Partial<Cliente>): Promise<Cliente | void> {
    if (isOnline) {
      const atualizado = await supabaseClientesService.atualizar(id, cliente);
      if (atualizado) await db.clientes.update(id, cliente);
      return atualizado;
    } else {
      await localDatabaseService.atualizarCliente(id, cliente);
      await localDatabaseService.addPendingAction('ATUALIZAR_CLIENTE', { id, cliente });
    }
  },

  async deletar(isOnline: boolean, id: string): Promise<void> {
    if (isOnline) {
      await supabaseClientesService.deletar(id);
      await db.clientes.delete(id);
    } else {
      await localDatabaseService.deletarCliente(id);
      await localDatabaseService.addPendingAction('DELETAR_CLIENTE', { id });
    }
  },
};