// src/contexts/CaixaContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAuth } from '../auth/AuthContext'; // Importar Auth para pegar o usuário
import { useToast } from './ToastContext';

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
  const { session } = useAuth(); // Pega a sessão do usuário
  const { addToast } = useToast();

  useEffect(() => {
    if (session) {
      verificarStatusCaixa();
    } else {
      setCaixaAberto(null);
      setCarregando(false);
    }
  }, [isOnline, session]);

  async function verificarStatusCaixa() {
    if (!isOnline) {
      setCarregando(false);
      return;
    }
    
    try {
      // Busca o último caixa que esteja aberto
      const { data, error } = await supabase
        .from('caixas')
        .select('*')
        .eq('aberto', true)
        .order('aberto_em', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Ignora erro "nenhum resultado encontrado"
          console.error('Erro ao verificar caixa:', error);
        }
        setCaixaAberto(null);
      } else {
        setCaixaAberto(data);
      }
    } catch (error) {
      console.error('Erro geral no caixa:', error);
    } finally {
      setCarregando(false);
    }
  }

  async function abrirCaixa(valorInicial: number) {
    if (!isOnline) throw new Error('Necessário estar online para abrir o caixa.');
    
    const operadorEmail = session?.user?.email || 'Sistema';

    try {
      // 1. Cria o registro do caixa
      const { data: novoCaixa, error: erroCaixa } = await supabase
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

      if (erroCaixa) throw erroCaixa;

      // 2. Registra a movimentação de abertura
      const { error: erroMov } = await supabase.from('movimentacoes_caixa').insert([{
          id_caixa: novoCaixa.id,
          tipo: 'abertura',
          valor: valorInicial,
          descricao: `Abertura por ${operadorEmail}`
      }]);

      if (erroMov) {
        console.error("Erro ao criar movimentação (não crítico):", erroMov);
      }

      setCaixaAberto(novoCaixa);
      
    } catch (error: any) {
      console.error("Falha ao abrir caixa:", error);
      throw new Error(error.message || "Erro ao criar registro no banco.");
    }
  }

  async function fecharCaixa(valorFinal: number) {
    if (!caixaAberto || !isOnline) return;

    try {
      // 1. Atualiza o caixa para fechado
      const { error } = await supabase
        .from('caixas')
        .update({
          aberto: false,
          saldo_atual: valorFinal, // Atualiza com o valor final de conferência
          fechado_em: new Date().toISOString()
        })
        .eq('id', caixaAberto.id);

      if (error) throw error;

      // 2. Registra movimentação de fechamento
      await supabase.from('movimentacoes_caixa').insert([{
          id_caixa: caixaAberto.id,
          tipo: 'fechamento',
          valor: valorFinal,
          descricao: 'Fechamento de Caixa'
      }]);

      setCaixaAberto(null);
      
    } catch (error: any) {
      console.error("Erro ao fechar caixa:", error);
      throw new Error("Não foi possível fechar o caixa no banco de dados.");
    }
  }

  async function registrarVenda(valor: number, metodo: string) {
    if (!caixaAberto || !isOnline) return;

    // Aumenta o saldo APENAS se for dinheiro (regra padrão)
    if (metodo.toUpperCase().includes('DINHEIRO')) {
        const novoSaldo = (Number(caixaAberto.saldo_atual) || 0) + valor;
        
        const { error } = await supabase.from('caixas')
            .update({ saldo_atual: novoSaldo })
            .eq('id', caixaAberto.id);
        
        if (!error) {
            setCaixaAberto(prev => prev ? { ...prev, saldo_atual: novoSaldo } : null);
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