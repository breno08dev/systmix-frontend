// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Importante: evita conflitos agressivos de lock no navegador
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Se o erro de LockManager persistir, você pode forçar o storageKey
    // storageKey: 'systmix-auth-token',
  },
  // Otimização de queries globais
  db: {
    schema: 'public',
  }
});