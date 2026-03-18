// src/auth/AuthContext.tsx
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; 
import { Session, User } from '@supabase/supabase-js'; 

interface AuthContextData {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Tenta pegar a sessão existente e TRATA O ERRO de token inválido
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        // Se o token for inválido, fazemos logout para limpar o localStorage
        console.error("Sessão inválida, limpando dados...", error);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // 2. Ouve por mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Tratamento extra para eventos de logout forçado
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message || 'Credenciais inválidas');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Limpar estados manualmente garante a UI atualizar rápido
    setSession(null);
    setUser(null);
  };

  const value = {
    user,
    session,
    signIn,
    signOut,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}