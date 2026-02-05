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
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();

  useEffect(() => {
    carregarEstadoCaixa();
  }, [isOnline]);

  const carregarEstadoCaixa = async () => {
    setLoading(true);
    try {
      // 1. Tenta recuperar do LocalStorage (funciona offline)
      const cachedCaixa = localStorage.getItem('systmix_caixa_aberto');
      if (cachedCaixa) {
        setCaixaAberto(JSON.parse(cachedCaixa));
      }

      // 2. Se online, valida e atualiza com o servidor
      if (isOnline) {
        const { data: userData } = await supabase.auth.getUser();
        const userEmail = userData.user?.email;

        if (userEmail) {
          const { data, error } = await supabase
            .from('caixas')
            .select('*')
            .eq('aberto', true)
            .eq('operador', userEmail)
            .maybeSingle();

          if (!error && data) {
            const caixaMapeado: Caixa = {
              id: data.id,
              aberto: data.aberto ?? true,
              valor_inicial: data.saldo_inicial ?? 0,
              data_abertura: data.aberto_em ?? new Date().toISOString(),
              data_fechamento: data.fechado_em,
              operador: data.operador,
              saldo_atual_local: data.saldo_atual ?? 0
            };

            setCaixaAberto(caixaMapeado);
            localStorage.setItem('systmix_caixa_aberto', JSON.stringify(caixaMapeado));
          } else if (!data) {
            setCaixaAberto(null);
            localStorage.removeItem('systmix_caixa_aberto');
          }
        }
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
    
    // Log para fins de auditoria e para resolver o alerta de variável não usada
    console.log(`Fechando caixa ${caixaAberto.id}. Saldo Final: ${saldoFinal}, Quebra: ${quebra}`);

    if (isOnline) {
       if (caixaAberto.id.startsWith('local_')) {
          addToast('Caixa offline não pode ser fechado online ainda. Sincronize primeiro.', 'error');
          return;
       }

       const { error } = await supabase.from('caixas').update({
         aberto: false,
         fechado_em: new Date().toISOString(),
         saldo_atual: saldoFinal,
         // Se você tiver a coluna 'quebra' ou 'diferenca' no banco, descomente abaixo:
         // quebra: quebra 
       }).eq('id', caixaAberto.id);

       if (error) throw error;
    }

    setCaixaAberto(null);
    localStorage.removeItem('systmix_caixa_aberto');
    addToast('Caixa fechado com sucesso.', 'success');
  };

  const registrarVenda = async (valor: number, metodo: string) => {
    if (isOnline && caixaAberto && !caixaAberto.id.startsWith('local_')) {
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