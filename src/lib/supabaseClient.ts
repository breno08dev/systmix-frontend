import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types'; // Importa do arquivo correto

// Verifica as variáveis de ambiente com segurança
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
}

// Cria o cliente tipado
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);