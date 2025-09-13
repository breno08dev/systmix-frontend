import { supabase } from '../lib/supabase';
import { Produto } from '../types';

export const produtosService = {
  async listar(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .order('nome');
    
    if (error) throw error;
    return data || [];
  },

  async listarAtivos(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('categoria, nome');
    
    if (error) throw error;
    return data || [];
  },

  // NOVA FUNÇÃO para verificar se o produto está em uso
  async verificarUsoProduto(id: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('itens_comanda')
      .select('*', { count: 'exact', head: true })
      .eq('id_produto', id);

    if (error) {
      console.error('Erro ao verificar uso do produto:', error);
      throw error;
    }

    return (count || 0) > 0;
  },

  async criar(produto: Omit<Produto, 'id' | 'criado_em'>): Promise<Produto> {
    const { data, error } = await supabase
      .from('produtos')
      .insert(produto)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async atualizar(id: string, produto: Partial<Produto>): Promise<Produto> {
    const { data, error } = await supabase
      .from('produtos')
      .update(produto)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};