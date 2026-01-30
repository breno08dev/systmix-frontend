// src/services/clientes.ts
import { supabase } from '../lib/supabaseClient';
import { Cliente } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

export const clientesService = {
  
  async listar(isOnline: boolean): Promise<Cliente[]> {
    if (isOnline) {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('nome', { ascending: true });

        if (error) throw error;
        
        const clientes = data || [];

        // CACHE: Salva clientes no banco local para uso offline
        if (clientes.length > 0) {
            await db.clientes.bulkPut(clientes);
        }
        
        return clientes;
      } catch (err) {
        console.error("Erro ao buscar clientes online, tentando local...", err);
        return await localDatabaseService.listarClientes();
      }
    } else {
      return await localDatabaseService.listarClientes();
    }
  },

  async criar(isOnline: boolean, cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente> {
    // CORREÇÃO: Tipagem explícita e uso de 'undefined' em vez de 'null'
    const payload: Omit<Cliente, 'id' | 'criado_em'> = {
        nome: cliente.nome.trim(),
        telefone: cliente.telefone?.trim() || undefined,
        email: cliente.email?.trim() || undefined
    };

    if (isOnline) {
      const { data, error } = await supabase
        .from('clientes')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      
      // Atualiza cache local com o cliente oficial
      await db.clientes.put(data);
      return data;
    } else {
      // Cria localmente
      const novoCliente = await localDatabaseService.criarCliente(payload);
      
      await localDatabaseService.addPendingAction('CRIAR_CLIENTE', { 
          cliente: payload,
          tempId: novoCliente.id 
      });
      
      return novoCliente;
    }
  },

  async atualizar(isOnline: boolean, id: string, dados: Partial<Cliente>): Promise<void> {
    // CORREÇÃO: Tratamento para campos opcionais na atualização
    const payload: any = { ...dados };
    
    // Removemos campos que não devem ser enviados ou que causam conflito
    delete payload.id;
    delete payload.criado_em;

    // Se telefone vier vazio ou null, garantimos undefined ou null compatível com Supabase
    if (payload.telefone === null) payload.telefone = null; 
    // Nota: Supabase aceita null, mas o banco local espera undefined se o campo for opcional no TS.
    // No entanto, para 'Partial<Cliente>', as propriedades já são opcionais.
    
    if (isOnline) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', id);
      if (error) throw error;
      
      await db.clientes.update(id, payload);
    } else {
      await localDatabaseService.atualizarCliente(id, payload);
      await localDatabaseService.addPendingAction('ATUALIZAR_CLIENTE', { id, cliente: payload });
    }
  },

  async deletar(isOnline: boolean, id: string): Promise<void> {
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