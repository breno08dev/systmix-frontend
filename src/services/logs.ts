// src/services/logs.ts
import { supabase } from '../lib/supabaseClient';
import { LogSistema } from '../types'; // Importando do arquivo central de tipos

export const logsService = {
  async registrar(usuario: { id: string; nome: string }, acao: string, detalhes: string) {
    try {
      // Usamos 'any' aqui apenas caso você ainda não tenha atualizado o database.types.ts
      const { error } = await (supabase as any).from('logs_sistema').insert([
        {
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          acao,
          detalhes,
        },
      ]);
      if (error) throw error;
    } catch (e) {
      console.error('Falha ao registrar log:', e);
    }
  },

  async listar(page: number = 1, pageSize: number = 20) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await (supabase as any)
      .from('logs_sistema')
      .select('*', { count: 'exact' })
      .order('criado_em', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data as LogSistema[], count: count || 0 };
  }
};