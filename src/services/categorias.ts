// src/services/categorias.ts
import { supabase } from '../lib/supabaseClient';
import { Categoria } from '../types';
// Se você não tiver tabela 'categorias' no Dexie ainda, pode remover a parte do db local ou adicionar no localDatabase.ts
// Vou assumir que por enquanto categorias são apenas online ou cacheadas na memória, 
// mas se quiser salvar no Dexie, precisa adicionar 'categorias' no localDatabase.ts
import { db } from '../lib/localDatabase'; 

const normalizarCategoria = (c: any): Categoria => ({
    ...c,
    nome: c.nome || 'Categoria',
    ativa: c.ativa ?? true
});

export const categoriasService = {
  
  async listar(isOnline: boolean): Promise<Categoria[]> {
    if (!isOnline) return []; // Se não tem tabela local de categorias, retorna vazio offline

    try {
        const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .eq('ativa', true)
            .order('nome');

        if (error) {
            // Silencia erro se a tabela não existir ainda (fallback para quem usa banco antigo)
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
      if (!isOnline) return null; // Criação apenas online por enquanto

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
        .update({ ativa: false }) // Soft delete
        .eq('id', id);

      if (error) throw error;
  }
};