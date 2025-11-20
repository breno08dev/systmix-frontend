// src/contexts/CaixaContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Caixa } from '../types';
import { useToast } from './ToastContext';
import { supabaseCaixaService } from '../services/supabaseService';
import { useOnlineStatus } from '../hooks/useOnlineStatus'; 

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
  const { isOnline } = useOnlineStatus(); 

  // Carrega o estado do caixa (Prioriza Supabase se online)
  useEffect(() => {
    const carregarCaixa = async () => {
        if (isOnline) {
            try {
                // Tenta obter o caixa aberto do banco de dados
                const session = await supabaseCaixaService.obterCaixaAberto();
                if (session) {
                    setCaixaSession(session);
                    setCaixaAberto(true);
                    // Atualiza o local storage para o modo offline
                    localStorage.setItem(CAIXA_STORAGE_KEY, JSON.stringify(session)); 
                } else {
                    setCaixaSession(null);
                    setCaixaAberto(false);
                }
            } catch (error) {
                console.error("Falha ao carregar caixa do Supabase, usando local.", error);
                carregarCaixaLocal();
            }
        } else {
            carregarCaixaLocal();
        }
    };

    const carregarCaixaLocal = () => {
        const storedCaixa = localStorage.getItem(CAIXA_STORAGE_KEY);
        if (storedCaixa) {
            const session: Caixa = JSON.parse(storedCaixa);
            // Verifica se a sessão local já não foi marcada como fechada
            if (!session.data_fechamento) { 
                setCaixaSession(session);
                setCaixaAberto(true);
            }
        }
    }

    carregarCaixa();
  }, [isOnline]);


  const abrirCaixa = async (valorInicial: number) => {
    try {
        if (isOnline) {
            await supabaseCaixaService.abrirCaixa(valorInicial);
            // Recarrega o estado do DB para obter a ID e data_abertura corretas
            const newSession = await supabaseCaixaService.obterCaixaAberto();
            if (newSession) {
                localStorage.setItem(CAIXA_STORAGE_KEY, JSON.stringify(newSession));
                setCaixaSession(newSession);
                setCaixaAberto(true);
                addToast('Caixa aberto com sucesso!', 'success');
            }
        } else {
            // Lógica offline (mantida, mas não persistida no DB)
            const newSession: Caixa = {
                id: `caixa_${Date.now()}`,
                data_abertura: new Date().toISOString(),
                valor_inicial: valorInicial,
            };
            localStorage.setItem(CAIXA_STORAGE_KEY, JSON.stringify(newSession));
            setCaixaSession(newSession);
            setCaixaAberto(true);
            addToast('Caixa aberto (Offline)! Será sincronizado.', 'success');
        }
    } catch (error: any) {
        addToast(error.message || 'Erro ao abrir caixa.', 'error');
    }
  };

  const fecharCaixa = async (valorFinal: number) => {
    if (!caixaSession) {
      addToast('Erro: Não há caixa aberto para fechar.', 'error');
      return;
    }

    try {
        if (isOnline) {
            // CORREÇÃO: Chama o Supabase para fechar, passando o ID da sessão e o valor contado.
            await supabaseCaixaService.fecharCaixa(caixaSession.id, valorFinal);
        } else {
            // Lógica offline: Marca a sessão local como fechada para a sincronização
            const closedSession: Caixa = {
                ...caixaSession,
                data_fechamento: new Date().toISOString(),
                valor_final: valorFinal,
            };
            // Isso deve ser salvo em uma fila de sincronização real. Aqui, apenas simulamos.
            console.log('CAIXA FECHADO OFFLINE. Adicionar à fila de sincronização:', closedSession);
        }

        // Atualiza o estado local e limpa o storage após o sucesso
        localStorage.removeItem(CAIXA_STORAGE_KEY);
        setCaixaSession(null);
        setCaixaAberto(false);
        addToast('Caixa fechado com sucesso!', 'success');

    } catch (error: any) {
        addToast(error.message || 'Erro ao fechar caixa no banco de dados.', 'error');
    }
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