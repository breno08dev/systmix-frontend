// src/contexts/CaixaContext.tsx (NOVO ARQUIVO)
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Caixa } from '../types';
import { useToast } from './ToastContext';

interface CaixaContextData {
  caixaAberto: boolean;
  caixaSession: Caixa | null;
  abrirCaixa: (valorInicial: number) => void;
  fecharCaixa: (valorFinal: number) => void;
}

const CAIXA_STORAGE_KEY = '@SystMix:Caixa';

const CaixaContext = createContext<CaixaContextData>({} as CaixaContextData);

export const CaixaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [caixaSession, setCaixaSession] = useState<Caixa | null>(null);
  const [caixaAberto, setCaixaAberto] = useState(false);
  const { addToast } = useToast();

  // Carrega o estado do caixa do localStorage na montagem
  useEffect(() => {
    const storedCaixa = localStorage.getItem(CAIXA_STORAGE_KEY);
    if (storedCaixa) {
      const session: Caixa = JSON.parse(storedCaixa);
      if (!session.data_fechamento) {
        setCaixaSession(session);
        setCaixaAberto(true);
      }
    }
  }, []);

  const abrirCaixa = (valorInicial: number) => {
    const newSession: Caixa = {
      id: `caixa_${Date.now()}`,
      data_abertura: new Date().toISOString(),
      valor_inicial: valorInicial,
    };
    localStorage.setItem(CAIXA_STORAGE_KEY, JSON.stringify(newSession));
    setCaixaSession(newSession);
    setCaixaAberto(true);
    addToast('Caixa aberto com sucesso!', 'success');
  };

  const fecharCaixa = (valorFinal: number) => {
    if (!caixaSession) {
      addToast('Erro: Não há caixa aberto para fechar.', 'error');
      return;
    }

    const closedSession: Caixa = {
      ...caixaSession,
      data_fechamento: new Date().toISOString(),
      valor_final: valorFinal,
    };

    // Aqui você enviaria 'closedSession' para o Supabase (Relatórios)
    // Por enquanto, salvamos localmente e limpamos para o próximo ciclo
    console.log('CAIXA FECHADO. Dados a serem enviados ao Supabase:', closedSession);
    
    // Simula a limpeza após o envio para o Supabase
    localStorage.removeItem(CAIXA_STORAGE_KEY);
    setCaixaSession(null);
    setCaixaAberto(false);
    addToast('Caixa fechado com sucesso!', 'success');
  };

  const value = {
    caixaAberto,
    caixaSession,
    abrirCaixa,
    fecharCaixa,
  };

  return (
    <CaixaContext.Provider value={value}>
      {children}
    </CaixaContext.Provider>
  );
};

export function useCaixa(): CaixaContextData {
  const context = useContext(CaixaContext);
  if (!context) {
    throw new Error('useCaixa must be used within a CaixaProvider');
  }
  return context;
}