// src/services/assinatura.ts
import { supabase } from '../lib/supabaseClient';

export interface StatusAssinatura {
  pago: boolean;
  mensagem_bloqueio: string;
  chave_pix: string;
}

export const assinaturaService = {
  async verificarStatus(): Promise<StatusAssinatura | null> {
    try {
      const { data, error } = await supabase
        .from('controle_assinatura')
        .select('pago, mensagem_bloqueio, chave_pix')
        .single();

      if (error) throw error;
      
      // ✅ SE TEM INTERNET: Salva o status mais recente no computador (cache local)
      localStorage.setItem('cache_assinatura_pdv', JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('Sem conexão com Supabase. Buscando status da assinatura offline...', error);
      
      // ⚠️ SE ESTIVER OFFLINE: Puxa a última memória salva
      const cacheLocal = localStorage.getItem('cache_assinatura_pdv');
      
      if (cacheLocal) {
        // Retorna o que estava salvo (se estava bloqueado, continua bloqueado offline)
        return JSON.parse(cacheLocal) as StatusAssinatura;
      }

      // Se for a primeira vez que abre o sistema na vida e estiver sem internet, libera por padrão
      return { pago: true, mensagem_bloqueio: '', chave_pix: '' };
    }
  }
};