// src/contexts/CaixaContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useToast } from './ToastContext';
import { Caixa } from '../types';
import { localDatabaseService } from '../lib/localDatabase';

interface CaixaContextData {
  caixaAberto: Caixa | null;
  abrirCaixa: (saldoInicial: number) => Promise<void>;
  fecharCaixa: (saldoFinal: number, quebra: number) => Promise<void>;
  registrarVenda: (valor: number, metodo: string) => Promise<void>;
  realizarSangria: (valor: number, motivo: string) => Promise<void>;
  loading: boolean;
}

const CaixaContext = createContext<CaixaContextData>({} as CaixaContextData);

export const CaixaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(() => {
    try {
      const cached = localStorage.getItem('systmix_caixa_aberto');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();

  useEffect(() => {
    let mounted = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (mounted) carregarEstadoCaixa(session);
      } else if (event === 'SIGNED_OUT') {
        setCaixaAberto(null);
        localStorage.removeItem('systmix_caixa_aberto');
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [isOnline]);

  const carregarEstadoCaixa = async (sessionParam?: any) => {
    setLoading(true);
    try {
      if (!isOnline) {
        setLoading(false);
        return;
      }

      const currentSession = sessionParam || (await supabase.auth.getSession()).data.session;
      const userEmail = currentSession?.user?.email;

      if (!userEmail) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('caixas')
        .select('*')
        .eq('aberto', true)
        .eq('operador', userEmail)
        .order('aberto_em', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Erro ao validar caixa no Supabase. Mantendo estado visual.", error);
        setLoading(false);
        return; 
      }

      if (data && data.length > 0) {
        const caixaData = data[0];

        const caixaMapeado: Caixa = {
          id: caixaData.id,
          aberto: caixaData.aberto ?? true,
          valor_inicial: caixaData.saldo_inicial ?? 0,
          data_abertura: caixaData.aberto_em ?? new Date().toISOString(),
          data_fechamento: caixaData.fechado_em,
          operador: caixaData.operador,
          saldo_atual_local: caixaData.saldo_atual ?? caixaData.saldo_inicial ?? 0 
        };

        setCaixaAberto(caixaMapeado);
        localStorage.setItem('systmix_caixa_aberto', JSON.stringify(caixaMapeado));
      } else {
        setCaixaAberto((prev) => {
          if (prev && (String(prev.id).startsWith('local_') || String(prev.id).startsWith('temp_'))) {
            return prev;
          }
          localStorage.removeItem('systmix_caixa_aberto');
          return null;
        });
      }
    } catch (error) {
      console.error("Erro ao carregar caixa:", error);
    } finally {
      setLoading(false);
    }
  };

  const abrirCaixa = async (saldoInicial: number) => {
    // CORREÇÃO INFALÍVEL: Usar getSession() no lugar de getUser()
    // Isso permite pegar o usuário que já fez login antes, mesmo sem internet
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    
    if (!user || !user.email) {
        throw new Error("Usuário não encontrado na sessão local. Por favor, faça login novamente com internet.");
    }

    const novoCaixaApp: Caixa = {
      id: `local_caixa_${Date.now()}`, 
      data_abertura: new Date().toISOString(),
      operador: user.email,
      valor_inicial: saldoInicial,
      aberto: true,
      saldo_atual_local: saldoInicial
    };

    if (isOnline) {
      try {
        const { data, error } = await supabase.from('caixas').insert([{
          operador: user.email,
          saldo_inicial: saldoInicial,
          aberto: true,
          aberto_em: novoCaixaApp.data_abertura
        }]).select().single();

        if (error) throw error;
        
        const caixaFinal: Caixa = {
          ...novoCaixaApp,
          id: data.id,
          valor_inicial: data.saldo_inicial ?? saldoInicial,
          data_abertura: data.aberto_em ?? novoCaixaApp.data_abertura
        };
        
        setCaixaAberto(caixaFinal);
        localStorage.setItem('systmix_caixa_aberto', JSON.stringify(caixaFinal));
      } catch (error) {
        await localDatabaseService.addPendingAction('ABRIR_CAIXA', { caixa: novoCaixaApp });
        setCaixaAberto(novoCaixaApp);
        localStorage.setItem('systmix_caixa_aberto', JSON.stringify(novoCaixaApp));
        addToast('Conexão instável. Caixa salvo offline na fila de sincronização.', 'error');
      }
    } else {
      await localDatabaseService.addPendingAction('ABRIR_CAIXA', { caixa: novoCaixaApp });
      setCaixaAberto(novoCaixaApp);
      localStorage.setItem('systmix_caixa_aberto', JSON.stringify(novoCaixaApp));
      addToast('Caixa aberto em modo OFFLINE. Sincronizará quando houver internet.', 'error');
    }
  };

  const fecharCaixa = async (saldoFinal: number, quebra: number) => {
    if (!caixaAberto) return;
    
    const fechado_em = new Date().toISOString();
    let sucessoOnline = false;

    if (isOnline && !String(caixaAberto.id).startsWith('local_')) {
       try {
         const { error } = await supabase.from('caixas').update({
           aberto: false,
           fechado_em: fechado_em,
           saldo_atual: saldoFinal,
         }).eq('id', caixaAberto.id);

         if (error) throw error;
         sucessoOnline = true;
       } catch (error) {
         console.warn("Falha ao fechar online, enviando para fila...", error);
       }
    }

    if (!sucessoOnline) {
       await localDatabaseService.addPendingAction('FECHAR_CAIXA', { 
         id: caixaAberto.id, 
         saldoFinal, 
         fechado_em,
         quebra 
       });
       if (isOnline) {
          addToast('Salvo na fila de sincronização devido a erro de rede.', 'error');
       } else {
          addToast('Caixa fechado offline. Será sincronizado automaticamente.', 'error');
       }
    } else {
       addToast('Caixa fechado com sucesso.', 'success');
    }

    setCaixaAberto(null);
    localStorage.removeItem('systmix_caixa_aberto');
  };

  const registrarVenda = async (valor: number, metodo: string) => {
    console.log(`[Caixa] Venda registrada: R$ ${valor} (${metodo})`);
  };

  const realizarSangria = async (valor: number, motivo: string) => {
    if (!caixaAberto) {
      addToast('Nenhum caixa aberto para realizar sangria.', 'error');
      return;
    }

    try {
      if (isOnline && !String(caixaAberto.id).startsWith('local_')) {
        const { error } = await supabase.from('movimentacoes_caixa').insert([{
          id_caixa: caixaAberto.id,
          tipo: 'sangria',
          valor: valor,
          motivo: motivo,
          data: new Date().toISOString()
        }]);

        if (error) throw error;
        addToast('Sangria registrada com sucesso.', 'success');
      } else {
        throw new Error('Offline ou Caixa Local'); 
      }
    } catch (error) {
      await localDatabaseService.registrarSangria({
        id_caixa: caixaAberto.id,
        valor,
        motivo
      });
      addToast('Sangria salva offline. Sincronizará em breve.', 'error');
    }

    setCaixaAberto(prev => prev ? { ...prev, saldo_atual_local: (prev.saldo_atual_local || 0) - valor } : prev);
  };

  return (
    <CaixaContext.Provider value={{ caixaAberto, abrirCaixa, fecharCaixa, registrarVenda, realizarSangria, loading }}>
      {children}
    </CaixaContext.Provider>
  );
};

export const useCaixa = () => useContext(CaixaContext);