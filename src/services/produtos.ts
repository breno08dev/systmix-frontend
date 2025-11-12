// src/services/produtos.ts
import { Produto } from '../types';
import { supabase } from '../lib/supabaseClient';

function lancarErroSupabase(error: any) {
  console.error('Erro no Supabase:', error);
  throw new Error(error.message || 'Ocorreu um erro na operação com o banco de dados.');
}

/**
 * Helper para converter a resposta do Supabase (com 'null')
 * para o tipo 'Produto' do front-end (com 'undefined').
 */
function mapSupabaseProdutoToProduto(data: any): Produto {
  return {
    ...data,
    // O tipo 'Produto' espera 'criado_em: string'
    // O Supabase (baseado no SQL) retorna 'criado_em: string | null'
    criado_em: data.criado_em || new Date().toISOString(), // Garante que não seja nulo
  };
}

export const produtosService = {
  async listar(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      lancarErroSupabase(error);
    }
    
    return data?.map(mapSupabaseProdutoToProduto) || []; // CORREÇÃO: Mapeia a lista
  },

  async listarAtivos(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) {
      lancarErroSupabase(error);
    }
    
    return data?.map(mapSupabaseProdutoToProduto) || []; // CORREÇÃO: Mapeia a lista
  },

  async criar(produto: Omit<Produto, 'id' | 'criado_em'>): Promise<Produto> {
    const { data, error } = await supabase
      .from('produtos')
      .insert(produto)
      .select()
      .single();

    if (error) {
      lancarErroSupabase(error);
    }
    if (!data) {
      throw new Error('Não foi possível criar o produto.');
    }

    return mapSupabaseProdutoToProduto(data); // CORREÇÃO: Mapeia o objeto
  },

  async atualizar(id: string, produto: Partial<Produto>): Promise<Produto> {
    const { data, error } = await supabase
      .from('produtos')
      .update(produto)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      lancarErroSupabase(error);
    }
    if (!data) {
      throw new Error('Não foi possível atualizar o produto.');
    }

    return mapSupabaseProdutoToProduto(data); // CORREÇÃO: Mapeia o objeto
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', id);

    if (error) {
      lancarErroSupabase(error);
    }
  },

  async verificarUsoProduto(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from('itens_comanda')
      .select('id', { count: 'exact', head: true })
      .eq('id_produto', id);

    if (error) {
      lancarErroSupabase(error);
    }

    return (count || 0) > 0;
  },
};