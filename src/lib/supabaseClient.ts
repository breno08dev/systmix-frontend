// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Vamos criar este arquivo de tipos depois

// Obtém as variáveis de ambiente que você já tem
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são necessárias.');
}

// Cria e exporta o cliente Supabase
// Usaremos <Database> para ter a tipagem do seu banco (próximo passo)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);