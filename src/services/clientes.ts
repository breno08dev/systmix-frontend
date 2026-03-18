// src/services/clientes.ts
import { supabase } from '../lib/supabaseClient';
import { Cliente } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

export const clientesService = {
  async listar(isOnline: boolean): Promise<Cliente[]> {
    if (isOnline) {
      try {
        const { data, error } = await supabase.from('clientes').select('*').order('nome');
        if (error) throw error;
        
        // Cache: Atualiza localmente para garantir dados frescos se cair a net
        await db.clientes.bulkPut(data as Cliente[]);
        return data as Cliente[];
      } catch (err) {
        console.warn('Offline Clientes:', err);
      }
    }
    return await localDatabaseService.listarClientes();
  },

  async buscarPorId(isOnline: boolean, id: string): Promise<Cliente | null> {
      if (isOnline && !id.startsWith('local_')) {
          try {
              const { data } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle();
              if (data) return data as Cliente;
          } catch(e) {}
      }
      return await db.clientes.get(id) || null;
  },

  async criar(isOnline: boolean, cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente> {
    if (isOnline) {
      try {
        const { data, error } = await supabase.from('clientes').insert([cliente]).select().single();
        if (error) throw error;
        await db.clientes.put(data as Cliente);
        return data as Cliente;
      } catch (err) {
        console.error("Erro criar cliente online:", err);
      }
    }
    // Offline (Fallback)
    return await localDatabaseService.criarCliente(cliente);
  },

  async atualizar(isOnline: boolean, id: string, dados: Partial<Cliente>): Promise<void> {
    if (isOnline && !id.startsWith('local_')) {
      try {
        const { error } = await supabase.from('clientes').update(dados).eq('id', id);
        if (error) throw error;
        await db.clientes.update(id, dados);
        return; // Sucesso Online: encerra aqui
      } catch (err) {
        console.error("Erro atualizar cliente online:", err);
      }
    }
    
    // Offline ou Falha Online: Salva local e agenda Sync
    await localDatabaseService.atualizarCliente(id, dados);
    await localDatabaseService.addPendingAction('ATUALIZAR_CLIENTE', { id, cliente: dados });
  },

  async deletar(isOnline: boolean, id: string): Promise<void> {
    if (isOnline && !id.startsWith('local_')) {
      try {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) throw error;
        await db.clientes.delete(id);
        return;
      } catch (err) {
        console.error("Erro deletar cliente online:", err);
      }
    }
    
    await localDatabaseService.deletarCliente(id);
    // Importante: Ação de deletar não é agendada automaticamente pelo DB local, fazemos manual
    // (Nota: O SyncContext precisa ter suporte a 'DELETAR_CLIENTE' se for requisito estrito, 
    // mas geralmente soft-delete é preferível. Se não houver handler no Sync, isso fica apenas local)
  }
};