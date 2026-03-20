// src/services/sangrias.ts
import { supabase } from '../lib/supabaseClient';
import { db } from '../lib/localDatabase';
import { Sangria } from '../types';

export const sangriasService = {
  
  async criar(isOnline: boolean, valor: number, motivo: string): Promise<void> {
    const dataIso = new Date().toISOString();
    const idLocal = `local_sangria_${Date.now()}`;

    if (isOnline) {
      try {
        const { data, error } = await supabase.from('sangrias').insert([{ 
          valor, 
          motivo, 
          data: dataIso 
        }]).select().single();

        if (error) throw error;
        
        // Salva no IndexedDB (Front-end) com o ID real para renderizar na hora
        await db.sangrias.put(data as Sangria);
        return;
      } catch (e) {
        console.error("Erro ao criar sangria online:", e);
      }
    }

    // Se a internet falhar ou estiver offline, salva direto no front-end
    await db.sangrias.put({ id: idLocal, valor, motivo, data: dataIso });
  },

  async listarPorTurno(isOnline: boolean, dataAbertura: string): Promise<Sangria[]> {
    if (isOnline) {
      try {
        const { data } = await supabase
          .from('sangrias')
          .select('*')
          .gte('data', dataAbertura)
          .order('data', { ascending: false });

        if (data && data.length > 0) {
            // Sincroniza o banco local com a nuvem
            await db.sangrias.bulkPut(data as Sangria[]);
            return data as Sangria[];
        }
      } catch (e) {
        console.error("Erro ao buscar sangrias:", e);
      }
    }

    // Fallback: Puxa instantaneamente do IndexedDB (Front-end)
    const sangriasLocais = await db.sangrias
        .filter(s => s.data >= dataAbertura)
        .toArray();

    return sangriasLocais.sort((a, b) => b.data.localeCompare(a.data));
  },

  async excluir(isOnline: boolean, id: string): Promise<void> {
    if (isOnline && !id.startsWith('local_')) {
      try {
          await supabase.from('sangrias').delete().eq('id', id);
      } catch (e) {
          console.error("Erro ao excluir sangria remota:", e);
      }
    }
    // Exclui direto no Front-end para sumir na hora
    await db.sangrias.delete(id);
  }
};