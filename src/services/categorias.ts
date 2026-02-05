// src/services/categorias.ts
import { supabase } from '../lib/supabaseClient';
import { Categoria } from '../types';

const normalizarCategoria = (c: any): Categoria => ({
    ...c,
    nome: c.nome || 'Categoria',
    ativa: c.ativa ?? true
});

export const categoriasService = {
  
  async listar(isOnline: boolean): Promise<Categoria[]> {
    if (!isOnline) return []; 

    try {
        const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .eq('ativa', true)
            .order('nome');

        if (error) {
            if (error.code === '42P01') return []; 
            throw error;
        }

        return (data || []).map(normalizarCategoria);
    } catch (error) {
        console.error("Erro listar categorias:", error);
        return [];
    }
  },

  async criar(isOnline: boolean, nome: string): Promise<Categoria | null> {
      if (!isOnline) return null; 

      const { data, error } = await supabase
        .from('categorias')
        .insert([{ nome, ativa: true }])
        .select()
        .single();

      if (error) throw error;
      return normalizarCategoria(data);
  },

  async excluir(isOnline: boolean, id: string): Promise<void> {
      if (!isOnline) return;

      const { error } = await supabase
        .from('categorias')
        .update({ ativa: false }) 
        .eq('id', id);

      if (error) throw error;
  }
};