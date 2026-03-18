// src/contexts/CaixaContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useToast } from './ToastContext';
import { Caixa } from '../types';

interface CaixaContextData {
  caixaAberto: Caixa | null;
  abrirCaixa: (saldoInicial: number) => Promise<void>;
  fecharCaixa: (saldoFinal: number, quebra: number) => Promise<void>;
  registrarVenda: (valor: number, metodo: string) => Promise<void>;
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

    // 2. OUVINTE DE SESSÃO: Garante que a checagem só ocorra quando 
    // o Supabase terminar de processar o usuário após o reload
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

      // CORREÇÃO AQUI: Removemos o .maybeSingle() e usamos order() + limit(1)
      // Assim, se houver 9 caixas "presos" como abertos, ele pega apenas o mais recente em formato de Array
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

      // Como limit(1) retorna um Array, verificamos se tem algo dentro dele
      if (data && data.length > 0) {
        const caixaData = data[0]; // Pega o primeiro (e mais recente) caixa retornado

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
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    
    if (!user || !user.email) throw new Error("Usuário não autenticado");

    const novoCaixaApp: Caixa = {
      id: isOnline ? 'temp_pending' : `local_caixa_${Date.now()}`,
      data_abertura: new Date().toISOString(),
      operador: user.email,
      valor_inicial: saldoInicial,
      aberto: true,
      saldo_atual_local: saldoInicial
    };

    if (isOnline) {
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
    } else {
      setCaixaAberto(novoCaixaApp);
      localStorage.setItem('systmix_caixa_aberto', JSON.stringify(novoCaixaApp));
      addToast('Caixa aberto em modo OFFLINE.', 'error');
    }
  };

  const fecharCaixa = async (saldoFinal: number, quebra: number) => {
    if (!caixaAberto) return;
    
    console.log(`Fechando caixa ${caixaAberto.id}. Saldo Final: ${saldoFinal}, Quebra: ${quebra}`);

    if (isOnline) {
       if (String(caixaAberto.id).startsWith('local_')) {
          addToast('Caixa offline não pode ser fechado online ainda. Sincronize primeiro.', 'error');
          return;
       }

       const { error } = await supabase.from('caixas').update({
         aberto: false,
         fechado_em: new Date().toISOString(),
         saldo_atual: saldoFinal,
       }).eq('id', caixaAberto.id);

       if (error) throw error;
    }

    setCaixaAberto(null);
    localStorage.removeItem('systmix_caixa_aberto');
    addToast('Caixa fechado com sucesso.', 'success');
  };

  const registrarVenda = async (valor: number, metodo: string) => {
    if (isOnline && caixaAberto && !String(caixaAberto.id).startsWith('local_')) {
        // Lógica opcional de log online
    }
    console.log(`[Caixa] Venda registrada: R$ ${valor} (${metodo})`);
  };

  return (
    <CaixaContext.Provider value={{ caixaAberto, abrirCaixa, fecharCaixa, registrarVenda, loading }}>
      {children}
    </CaixaContext.Provider>
  );
};

export const useCaixa = () => useContext(CaixaContext);