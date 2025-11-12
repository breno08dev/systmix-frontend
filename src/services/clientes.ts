// src/services/clientes.ts
import { Cliente } from '../types';
import { supabase } from '../lib/supabaseClient';

function lancarErroSupabase(error: any) {
  console.error('Erro no Supabase:', error);
  const mensagemErro = error.details || error.message || 'Ocorreu um erro na operação com o banco de dados.';
  throw new Error(mensagemErro);
}

/**
 * Helper para converter a resposta do Supabase (com 'null')
 * para o tipo 'Cliente' do front-end (com 'undefined').
 */
function mapSupabaseClienteToCliente(data: any): Cliente {
  return {
    ...data,
    // O tipo 'Cliente' espera 'telefone?: string' (undefined)
    // O Supabase retorna 'telefone: string | null'
    telefone: data.telefone || undefined,
    // Mesmo caso para 'criado_em'
    criado_em: data.criado_em || new Date().toISOString(),
  };
}


export const clientesService = {
  async listar(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      lancarErroSupabase(error);
    }
    
    return data?.map(mapSupabaseClienteToCliente) || []; // CORREÇÃO: Mapeia a lista
  },

  async criar(cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente> {
    const { data, error } = await supabase
      .from('clientes')
      .insert(cliente)
      .select()
      .single();

    if (error) {
      lancarErroSupabase(error);
    }
    if (!data) {
      throw new Error('Não foi possível criar o cliente.');
    }
    
    return mapSupabaseClienteToCliente(data); // CORREÇÃO: Mapeia o objeto
  },

  async atualizar(id: string, cliente: Partial<Cliente>): Promise<Cliente> {
    const { data, error } = await supabase
      .from('clientes')
      .update(cliente)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      lancarErroSupabase(error);
    }
    if (!data) {
      throw new Error('Não foi possível atualizar o cliente.');
    }
    
    return mapSupabaseClienteToCliente(data); // CORREÇÃO: Mapeia o objeto
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) {
      lancarErroSupabase(error);
    }
  },
};