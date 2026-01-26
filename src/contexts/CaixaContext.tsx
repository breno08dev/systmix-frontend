// src/contexts/CaixaContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './ToastContext';
import { localDatabaseService } from '../lib/localDatabase';

export interface Caixa {
  id: string;
  aberto: boolean;
  saldo_inicial: number;
  saldo_atual: number;
  aberto_em: string;
  fechado_em?: string;
  operador?: string;
}

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
  const { addToast } = useToast();

  useEffect(() => {
    // Tenta recuperar do cache local imediatamente
    const cacheLocal = localStorage.getItem('caixa_ativo');
    if (cacheLocal) {
        try {
            setCaixaAberto(JSON.parse(cacheLocal));
        } catch (e) {
            console.error("Erro ao ler cache caixa:", e);
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
    if (!isOnline) {
      // Se offline, mantém o que carregou do cache e não faz nada
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('caixas')
        .select('*')
        .eq('aberto', true)
        .order('aberto_em', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') console.error('Erro caixa:', error);
        setCaixaAberto(null);
        localStorage.removeItem('caixa_ativo');
      } else {
        setCaixaAberto(data);
        localStorage.setItem('caixa_ativo', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Erro geral no caixa:', error);
    }
  }

  async function abrirCaixa(valorInicial: number) {
    if (!isOnline) throw new Error('Necessário estar online para abrir o caixa.');
    
    const operadorEmail = session?.user?.email || 'Sistema';

    const { data: novoCaixa, error } = await supabase
        .from('caixas')
        .insert([{
          aberto: true,
          saldo_inicial: valorInicial,
          saldo_atual: valorInicial,
          operador: operadorEmail,
          aberto_em: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) throw error;

    await supabase.from('movimentacoes_caixa').insert([{
        id_caixa: novoCaixa.id,
        tipo: 'abertura',
        valor: valorInicial,
        descricao: `Abertura por ${operadorEmail}`
    }]);

    setCaixaAberto(novoCaixa);
    localStorage.setItem('caixa_ativo', JSON.stringify(novoCaixa)); 
  }

  async function fecharCaixa(valorFinal: number) {
    if (!caixaAberto) return;
    if (!isOnline) throw new Error('Necessário estar online para fechar o caixa.');

    const { error } = await supabase.from('caixas').update({
        aberto: false,
        saldo_atual: valorFinal,
        fechado_em: new Date().toISOString()
    }).eq('id', caixaAberto.id);

    if (error) throw error;

    await supabase.from('movimentacoes_caixa').insert([{
        id_caixa: caixaAberto.id,
        tipo: 'fechamento',
        valor: valorFinal,
        descricao: 'Fechamento de Caixa'
    }]);

    setCaixaAberto(null);
    localStorage.removeItem('caixa_ativo'); 
  }

  async function registrarVenda(valor: number, metodo: string) {
    if (!caixaAberto) return; 

    if (metodo.toUpperCase().includes('DINHEIRO')) {
        const novoSaldo = (Number(caixaAberto.saldo_atual) || 0) + valor;
        const caixaAtualizado = { ...caixaAberto, saldo_atual: novoSaldo };
        
        setCaixaAberto(caixaAtualizado);
        localStorage.setItem('caixa_ativo', JSON.stringify(caixaAtualizado));

        if (isOnline) {
            await supabase.from('caixas')
                .update({ saldo_atual: novoSaldo })
                .eq('id', caixaAberto.id);
        } else {
            // Agenda sync
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