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
        // Removido 'error' aqui pois era unused
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .order('nome', { ascending: true })
          .throwOnError();

        const clientes = (data || []).map(normalizarCliente);

        if (clientes.length > 0) {
           await db.clientes.bulkPut(clientes).catch(err => console.warn('Erro cache clientes:', err));
        }

        try {
            const idsOnline = new Set(clientes.map(c => c.id));
            const idsLocais = await db.clientes.toCollection().primaryKeys();

            const paraDeletar = idsLocais.filter(id => {
                const idStr = String(id);
                return !idsOnline.has(idStr) && !idStr.startsWith('local_');
            });

            if (paraDeletar.length > 0) {
                console.log(`[Sync Clientes] Removendo ${paraDeletar.length} clientes obsoletos.`);
                await db.clientes.bulkDelete(paraDeletar);
            }
        } catch (cleanupError) {
            console.warn("Erro ao limpar cache de clientes:", cleanupError);
        }

        return clientes;

      } catch (error) {
        console.warn("Supabase indisponível, buscando local...", error);
      }
    }

    try {
        return await localDatabaseService.listarClientes();
    } catch (err) {
        console.error("Falha ao ler banco local", err);
        return [];
    }
  },

  async criar(isOnline: boolean, cliente: Omit<Cliente, 'id'>): Promise<Cliente> {
    if (isOnline) {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .insert([cliente])
                .select()
                .single();
            
            if (error) throw error;
            
            const novoCliente = normalizarCliente(data);
            await db.clientes.put(novoCliente);
            return novoCliente;
        } catch (error) {
            console.error("Erro ao criar online, salvando offline...", error);
        }
    }
    
    return await localDatabaseService.criarCliente(cliente);
  },

  async atualizar(isOnline: boolean, id: string, cliente: Partial<Cliente>): Promise<void> {
    if (isOnline) {
        try {
            const { error } = await supabase.from('clientes').update(cliente).eq('id', id);
            if (error) throw error;
            await db.clientes.update(id, cliente);
            return;
        } catch (error) { 
            console.error("Erro update online, agendando offline...", error);
        }
    }
    
    await localDatabaseService.atualizarCliente(id, cliente);
    await localDatabaseService.addPendingAction('ATUALIZAR_CLIENTE', { id, cliente });
  },

  async excluir(isOnline: boolean, id: string): Promise<void> {
    if (isOnline) {
        try {
            const { error } = await supabase.from('clientes').delete().eq('id', id);
            if (error) throw error;
            await db.clientes.delete(id);
            return;
        } catch (error) {
             console.error("Erro delete online, agendando offline...", error);
        }
    } 
    
    await localDatabaseService.deletarCliente(id);
    await localDatabaseService.addPendingAction('DELETAR_CLIENTE', { id });
  }
};