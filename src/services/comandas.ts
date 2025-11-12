// src/services/comandas.ts
import { Comanda, ItemComanda, Pagamento } from '../types';
import { supabase } from '../lib/supabaseClient';

function lancarErroSupabase(error: any) {
  console.error('Erro no Supabase:', error);
  const mensagemErro = error.details || error.message || 'Ocorreu um erro na operação com o banco de dados.';
  throw new Error(mensagemErro);
}

/**
 * CORREÇÃO: Mapeia a resposta da tabela 'comandas' (com nulos)
 * para o tipo 'Comanda' do front-end (com undefined).
 */
function mapSupabaseComandaToComanda(data: any): Comanda {
  return {
    ...data,
    id_cliente: data.id_cliente || undefined,
    fechado_em: data.fechado_em || undefined,
    cliente: data.cliente || undefined,
    itens: data.itens?.map(mapSupabaseItemToItemComanda) || [], // Usa o helper de item
    pagamentos: data.pagamentos || []
  };
}

/**
 * CORREÇÃO: Mapeia a resposta da tabela 'itens_comanda' (com nulos)
 * para o tipo 'ItemComanda' do front-end.
 */
function mapSupabaseItemToItemComanda(data: any): ItemComanda {
  return {
    ...data,
    produto: data.produto || undefined
  };
}

export const comandasService = {
  async listarAbertas(): Promise<Comanda[]> {
    const { data, error } = await supabase
      .from('comandas')
      .select(`
        *,
        cliente:clientes(*),
        itens:itens_comanda(*, produto:produtos(*))
      `)
      .eq('status', 'aberta')
      .order('numero', { ascending: true });

    if (error) {
      lancarErroSupabase(error);
    }
    
    return data?.map(mapSupabaseComandaToComanda) || []; // CORREÇÃO: Usa o helper
  },

  async buscarPorNumero(numero: number): Promise<Comanda | null> {
    const { data, error } = await supabase
      .from('comandas')
      .select(`
        *,
        cliente:clientes(*),
        itens:itens_comanda(*, produto:produtos(*))
      `)
      .eq('status', 'aberta')
      .eq('numero', numero)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      lancarErroSupabase(error);
    }
    
    if (!data) {
      return null;
    }

    return mapSupabaseComandaToComanda(data); // CORREÇÃO: Usa o helper
  },

  async criarComanda(numero: number, idCliente?: string): Promise<Comanda> {
    const { data, error } = await supabase
      .from('comandas')
      .insert({
        numero: numero,
        id_cliente: idCliente
      })
      .select()
      .single();

    if (error) {
      lancarErroSupabase(error);
    }
    if (!data) {
      throw new Error('Não foi possível criar a comanda.');
    }

    return mapSupabaseComandaToComanda(data); // CORREÇÃO: Usa o helper
  },

  async adicionarItem(idComanda: string, item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'>): Promise<ItemComanda> {
    const { data: rpcData, error: rpcError } = await supabase.rpc('adicionar_item_comanda', {
      p_id_comanda: idComanda,
      p_id_produto: item.id_produto,
      p_valor_unit: item.valor_unit
    });

    if (rpcError) {
      lancarErroSupabase(rpcError);
    }
    if (!rpcData) {
      throw new Error('A função adicionar_item_comanda não retornou dados.');
    }

    const { data: itemCompleto, error: itemError } = await supabase
      .from('itens_comanda')
      .select('*, produto:produtos(*)')
      .eq('id', rpcData.id)
      .single();
    
    if (itemError) {
      lancarErroSupabase(itemError);
    }
    if (!itemCompleto) {
      throw new Error('Não foi possível encontrar o item recém-criado.');
    }
    
    return mapSupabaseItemToItemComanda(itemCompleto); // CORREÇÃO: Usa o helper
  },

  // As funções abaixo (atualizar/remover/fechar) não retornam 'data',
  // então não precisam de mapeamento.
  
  async atualizarQuantidadeItem(idComanda: string, idItem: string, quantidade: number): Promise<void> {
    const { error } = await supabase
      .from('itens_comanda')
      .update({ quantidade: quantidade })
      .eq('id', idItem)
      .eq('id_comanda', idComanda);

    if (error) {
      lancarErroSupabase(error);
    }
  },

  async removerItem(idComanda: string, idItem: string): Promise<void> {
    const { error } = await supabase
      .from('itens_comanda')
      .delete()
      .eq('id', idItem)
      .eq('id_comanda', idComanda);

    if (error) {
      lancarErroSupabase(error);
    }
  },

  async fecharComanda(idComanda: string, pagamentos: Omit<Pagamento, 'id' | 'data' | 'id_comanda'>[]): Promise<void> {
    const { error } = await supabase.rpc('fechar_comanda_com_pagamentos', {
      p_id_comanda: idComanda,
      p_pagamentos: pagamentos
    });

    if (error) {
      lancarErroSupabase(error);
    }
  },
};