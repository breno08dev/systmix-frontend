// src/services/clientes.ts
import { supabase } from '../lib/supabaseClient';
import { Cliente } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

const normalizarCliente = (c: any): Cliente => ({
    ...c,
    nome: c.nome || 'Cliente Sem Nome',
    telefone: c.telefone || '',
    email: c.email || ''
});

export const clientesService = {
  
  async listar(isOnline: boolean): Promise<Cliente[]> {
    if (isOnline) {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('nome', { ascending: true });

        if (error) throw error;
        
        const clientes = (data || []).map(normalizarCliente);

        if (clientes.length > 0) {
            await db.clientes.bulkPut(clientes);
        }
        return clientes;
      } catch (error) {
        console.error("Erro clientes online:", error);
        return await localDatabaseService.listarClientes();
      }
    } else {
      return await localDatabaseService.listarClientes();
    }
  },

  async criar(isOnline: boolean, cliente: Omit<Cliente, 'id'>): Promise<Cliente> {
    if (isOnline) {
        const { data, error } = await supabase
            .from('clientes')
            .insert([cliente])
            .select()
            .single();
        
        if (error) throw error;
        
        const novoCliente = normalizarCliente(data);
        await db.clientes.put(novoCliente);
        return novoCliente;
    } else {
        // CORREÇÃO: O localDatabaseService já adiciona a pendência.
        const novo = await localDatabaseService.criarCliente(cliente);
        return novo;
    }
  },

  async atualizar(isOnline: boolean, id: string, cliente: Partial<Cliente>): Promise<void> {
    if (isOnline) {
        const { error } = await supabase.from('clientes').update(cliente).eq('id', id);
        if (error) throw error;
        await db.clientes.update(id, cliente);
    } else {
        await localDatabaseService.atualizarCliente(id, cliente);
        await localDatabaseService.addPendingAction('ATUALIZAR_CLIENTE', { id, cliente });
    }
  },

  async excluir(isOnline: boolean, id: string): Promise<void> {
    if (isOnline) {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) throw error;
        await db.clientes.delete(id);
    } else {
        await localDatabaseService.deletarCliente(id);
        await localDatabaseService.addPendingAction('DELETAR_CLIENTE', { id });
    }
  }
};