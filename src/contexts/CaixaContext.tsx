// src/contexts/CaixaContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAuth } from '../auth/AuthContext';
import { localDatabaseService } from '../lib/localDatabase';
import { Caixa } from '../types';

interface CaixaContextData {
  caixaAberto: Caixa | null;
  carregando: boolean;
  abrirCaixa: (valorInicial: number) => Promise<void>;
  fecharCaixa: (valorFinal: number) => Promise<void>;
  registrarVenda: (valor: number, metodo: string) => Promise<void>;
  verificarStatusCaixa: () => Promise<void>;
}

const CaixaContext = createContext<CaixaContextData>({} as CaixaContextData);

export const CaixaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null);
  const [carregando, setCarregando] = useState(true);
  
  const { isOnline } = useOnlineStatus();
  const { session } = useAuth();

  useEffect(() => {
    const cacheLocal = localStorage.getItem('caixa_ativo');
    if (cacheLocal) {
        try {
            setCaixaAberto(JSON.parse(cacheLocal));
        } catch (e) {
            console.error("Erro cache caixa:", e);
        }
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (session) {
      verificarStatusCaixa();
    } else {
      setCaixaAberto(null);
      localStorage.removeItem('caixa_ativo');
    }
  }, [isOnline, session]);

  async function verificarStatusCaixa() {
    if (!isOnline) return;
    
    try {
      const { data, error } = await supabase
        .from('caixa') 
        .select('*')
        .is('data_fechamento', null)
        .maybeSingle();

      if (error) {
        console.error('Erro caixa:', error);
      } else if (data) {
        // CONSTRUÇÃO EXPLÍCITA PARA EVITAR ERROS DE TIPO
        const caixaFormatado: Caixa = {
            id: data.id,
            aberto: true,
            valor_inicial: Number(data.valor_inicial),
            valor_final: data.valor_final,
            data_abertura: data.data_abertura,
            data_fechamento: data.data_fechamento,
            saldo_atual_local: Number(data.valor_inicial) // Reinicia visualmente
        };
        
        setCaixaAberto(caixaFormatado);
        localStorage.setItem('caixa_ativo', JSON.stringify(caixaFormatado));
      } else {
        setCaixaAberto(null);
        localStorage.removeItem('caixa_ativo');
      }
    } catch (error) {
      console.error('Erro geral no caixa:', error);
    }
  }

  async function abrirCaixa(valorInicial: number) {
    if (!isOnline) throw new Error('Necessário estar online para abrir o caixa.');
    
    // Inserção no banco
    const { data, error } = await supabase
        .from('caixa')
        .insert([{
          valor_inicial: valorInicial,
          data_abertura: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) throw error;

    // Adaptação segura para o estado local
    const novoCaixa: Caixa = {
        id: data.id,
        aberto: true,
        valor_inicial: Number(data.valor_inicial),
        valor_final: data.valor_final,
        data_abertura: data.data_abertura,
        data_fechamento: data.data_fechamento,
        saldo_atual_local: valorInicial
    };

    setCaixaAberto(novoCaixa);
    localStorage.setItem('caixa_ativo', JSON.stringify(novoCaixa)); 
  }

  async function fecharCaixa(valorFinal: number) {
    if (!caixaAberto) return;
    if (!isOnline) throw new Error('Necessário estar online para fechar o caixa.');

    const { error } = await supabase
        .from('caixa')
        .update({
            valor_final: valorFinal,
            data_fechamento: new Date().toISOString()
        })
        .eq('id', caixaAberto.id);

    if (error) throw error;

    setCaixaAberto(null);
    localStorage.removeItem('caixa_ativo'); 
  }

  async function registrarVenda(valor: number, metodo: string) {
    if (!caixaAberto) return; 

    if (metodo.toUpperCase().includes('DINHEIRO')) {
        const novoSaldo = (caixaAberto.saldo_atual_local || 0) + valor;
        const caixaAtualizado = { ...caixaAberto, saldo_atual_local: novoSaldo };
        
        setCaixaAberto(caixaAtualizado);
        localStorage.setItem('caixa_ativo', JSON.stringify(caixaAtualizado));

        if (!isOnline) {
             await localDatabaseService.addPendingAction('MOVIMENTACAO_CAIXA' as any, { 
                idCaixa: caixaAberto.id, 
                novoSaldo 
            });
        }
    }
  }

  return (
    <CaixaContext.Provider value={{ 
      caixaAberto, 
      carregando, 
      abrirCaixa, 
      fecharCaixa,
      registrarVenda,
      verificarStatusCaixa
    }}>
      {children}
    </CaixaContext.Provider>
  );
};

export const useCaixa = () => useContext(CaixaContext);