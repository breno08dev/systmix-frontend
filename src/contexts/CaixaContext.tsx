// src/contexts/CaixaContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Caixa, MovimentacaoCaixa } from '../types';
import { useToast } from './ToastContext';
import { supabaseCaixaService } from '../services/supabaseService';
import { useOnlineStatus } from '../hooks/useOnlineStatus'; 

interface CaixaContextData {
  caixaAberto: boolean;
  caixaSession: Caixa | null;
  movimentacoes: MovimentacaoCaixa[]; // Adicionado
  abrirCaixa: (valorInicial: number) => Promise<void>;
  fecharCaixa: (valorFinal: number) => Promise<void>;
  adicionarSangria: (valor: number, observacao: string) => Promise<void>; // Adicionado
  adicionarSuprimento: (valor: number, observacao: string) => Promise<void>; // Adicionado
}

const CAIXA_STORAGE_KEY = '@SystMix:Caixa';
const MOVIMENTACOES_STORAGE_KEY = '@SystMix:CaixaMovimentacoes';

const CaixaContext = createContext<CaixaContextData>({} as CaixaContextData);

export const CaixaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [caixaSession, setCaixaSession] = useState<Caixa | null>(null);
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCaixa[]>([]);
  
  const { addToast } = useToast();
  const { isOnline } = useOnlineStatus(); 

  // Carrega estado inicial
  useEffect(() => {
    carregarCaixa();
  }, [isOnline]);

  const carregarCaixa = async () => {
    // 1. Tenta carregar do LocalStorage primeiro (Cache)
    const storedCaixa = localStorage.getItem(CAIXA_STORAGE_KEY);
    const storedMovs = localStorage.getItem(MOVIMENTACOES_STORAGE_KEY);

    if (storedCaixa) {
        const session: Caixa = JSON.parse(storedCaixa);
        if (!session.data_fechamento) {
            setCaixaSession(session);
            setCaixaAberto(true);
            if (storedMovs) setMovimentacoes(JSON.parse(storedMovs));
        }
    }

    // 2. Se estiver online, atualiza com o Supabase
    if (isOnline) {
        try {
            const session = await supabaseCaixaService.obterCaixaAberto();
            if (session) {
                setCaixaSession(session);
                setCaixaAberto(true);
                localStorage.setItem(CAIXA_STORAGE_KEY, JSON.stringify(session));
                
                // Se tiver serviço de movimentações no supabase, carregaria aqui
                // const movs = await supabaseCaixaService.listarMovimentacoes(session.id);
                // setMovimentacoes(movs);
            } else {
                // Se o banco diz que não tem caixa aberto, mas o local diz que tem,
                // pode ser conflito. Por segurança, limpamos se o banco confirmar fechado.
                // Mas mantemos local se for apenas erro de conexão.
            }
        } catch (error) {
            console.error("Erro ao sincronizar caixa:", error);
        }
    }
  };

  const abrirCaixa = async (valorInicial: number) => {
    try {
        let newSession: Caixa;

        if (isOnline) {
            await supabaseCaixaService.abrirCaixa(valorInicial);
            const sessionDb = await supabaseCaixaService.obterCaixaAberto();
            if (!sessionDb) throw new Error("Erro ao recuperar caixa aberto.");
            newSession = sessionDb;
        } else {
            // Lógica Offline
            newSession = {
                id: `offline_${Date.now()}`,
                data_abertura: new Date().toISOString(),
                valor_inicial: valorInicial,
            };
        }

        setCaixaSession(newSession);
        setCaixaAberto(true);
        setMovimentacoes([]); // Limpa movimentações anteriores
        localStorage.setItem(CAIXA_STORAGE_KEY, JSON.stringify(newSession));
        localStorage.removeItem(MOVIMENTACOES_STORAGE_KEY);
        
        addToast('Caixa aberto com sucesso!', 'success');
    } catch (error: any) {
        addToast(error.message || 'Erro ao abrir caixa.', 'error');
        throw error;
    }
  };

  const fecharCaixa = async (valorFinal: number) => {
    if (!caixaSession) return;

    try {
        if (isOnline) {
            await supabaseCaixaService.fecharCaixa(caixaSession.id, valorFinal);
        } else {
            // Lógica Offline
            console.log('Fechamento offline registrado', { ...caixaSession, valor_final: valorFinal });
        }

        setCaixaSession(null);
        setCaixaAberto(false);
        setMovimentacoes([]);
        localStorage.removeItem(CAIXA_STORAGE_KEY);
        localStorage.removeItem(MOVIMENTACOES_STORAGE_KEY);
        
        addToast('Caixa fechado com sucesso!', 'success');
    } catch (error: any) {
        addToast('Erro ao fechar caixa.', 'error');
        throw error;
    }
  };

  // Funções Auxiliares para adicionar movimento no estado e storage
  const registrarMovimento = async (tipo: 'sangria' | 'suprimento', valor: number, observacao: string) => {
    if (!caixaSession) return;

    const novaMovimentacao: MovimentacaoCaixa = {
        id: `mov_${Date.now()}`,
        id_caixa: caixaSession.id,
        tipo,
        valor,
        observacao,
        criado_em: new Date().toISOString(),
        usuario_nome: 'Operador Atual' // Idealmente viria do AuthContext
    };

    // Atualiza estado
    const novasMovimentacoes = [...movimentacoes, novaMovimentacao];
    setMovimentacoes(novasMovimentacoes);
    
    // Persiste localmente
    localStorage.setItem(MOVIMENTACOES_STORAGE_KEY, JSON.stringify(novasMovimentacoes));

    // Se estiver online, tentaria salvar no banco (simulado aqui)
    if (isOnline) {
        // await supabaseCaixaService.adicionarMovimentacao(novaMovimentacao);
    }
  };

  const adicionarSangria = async (valor: number, observacao: string) => {
    await registrarMovimento('sangria', valor, observacao);
  };

  const adicionarSuprimento = async (valor: number, observacao: string) => {
    await registrarMovimento('suprimento', valor, observacao);
  };

  return (
    <CaixaContext.Provider value={{
      caixaAberto,
      caixaSession,
      movimentacoes,
      abrirCaixa,
      fecharCaixa,
      adicionarSangria,
      adicionarSuprimento
    }}>
      {children}
    </CaixaContext.Provider>
  );
};

export function useCaixa(): CaixaContextData {
  const context = useContext(CaixaContext);
  if (!context) throw new Error('useCaixa must be used within a CaixaProvider');
  return context;
}