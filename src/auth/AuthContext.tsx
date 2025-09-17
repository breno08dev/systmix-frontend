import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface User {
  id: string;
  email?: string;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tenta carregar a sessão do localStorage ao iniciar a aplicação
    const storedToken = localStorage.getItem('@SystMix:token');
    const storedUser = localStorage.getItem('@SystMix:user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Credenciais inválidas');
    }

    const { user, session } = await response.json();

    setUser(user);
    setToken(session.access_token);

    // Armazena no localStorage para persistir a sessão
    localStorage.setItem('@SystMix:user', JSON.stringify(user));
    localStorage.setItem('@SystMix:token', session.access_token);
  };

  const signOut = () => {
    setUser(null);
    setToken(null);
    // Limpa o localStorage
    localStorage.removeItem('@SystMix:user');
    localStorage.removeItem('@SystMix:token');
  };

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut, loading }}>
      {children}
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