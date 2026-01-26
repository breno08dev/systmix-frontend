// src/services/categorias.ts
import { supabase } from '../lib/supabaseClient';
import { Categoria } from '../types';

export const categoriasService = {
  async listar(isOnline: boolean): Promise<Categoria[]> {
    if (isOnline) {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('ativa', true) // Filtra apenas as ativas
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    } else {
       // Se tiver lógica offline, implementar aqui
       return [];
    }
  },

  async criar(isOnline: boolean, nome: string): Promise<Categoria> {
    if (isOnline) {
      const { data, error } = await supabase
        .from('categorias')
        .insert([{ nome, ativa: true }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      throw new Error('Criação de categorias indisponível offline.');
    }
  }
};