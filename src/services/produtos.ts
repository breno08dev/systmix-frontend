// src/services/produtos.ts
import { supabase } from '../lib/supabaseClient';
import { Produto } from '../types';

export const produtosService = {
  
  async listarAtivos(isOnline: boolean): Promise<Produto[]> {
    if (!isOnline) return [];
    try {
      // Removemos 'descricao' da busca se ela não existe, ou deixamos * que pega tudo que tem
      const { data, error } = await supabase
        .from('produtos')
        .select('*, categoria:categorias(*)')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn("Erro ao buscar com categorias, tentando busca simples...");
      const { data } = await supabase.from('produtos').select('*').eq('ativo', true);
      return data || [];
    }
  },

  async criar(isOnline: boolean, produto: any): Promise<Produto> {
    if (!isOnline) throw new Error("Offline");

    // PAYLOAD LIMPO: Sem o campo 'descricao'
    const payload = {
        nome: produto.nome.trim(),
        preco: typeof produto.preco === 'string' 
          ? parseFloat(produto.preco.replace(',', '.')) 
          : produto.preco,
        estoque: Number(produto.estoque),
        // Envia NULL se estiver vazio ou string vazia
        id_categoria: (produto.id_categoria && produto.id_categoria !== "") ? produto.id_categoria : null,
        ativo: true
    };

    const { data, error } = await supabase.from('produtos').insert([payload]).select().single();

    if (error) {
        console.error("Erro Supabase:", error);
        throw new Error(error.message);
    }
    return data;
  },

  async atualizar(isOnline: boolean, id: string, produto: any): Promise<void> {
    if (!isOnline) throw new Error("Offline");

    // PAYLOAD LIMPO: Sem o campo 'descricao'
    const payload = {
        nome: produto.nome.trim(),
        preco: typeof produto.preco === 'string' 
          ? parseFloat(produto.preco.replace(',', '.')) 
          : produto.preco,
        estoque: Number(produto.estoque),
        id_categoria: (produto.id_categoria && produto.id_categoria !== "") ? produto.id_categoria : null,
        ativo: true
    };

    const { error } = await supabase.from('produtos').update(payload).eq('id', id);

    if (error) {
        console.error("Erro Supabase Update:", error);
        throw new Error(error.message);
    }
  }
};