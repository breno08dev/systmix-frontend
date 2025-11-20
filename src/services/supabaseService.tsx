// src/services/supabaseService.ts
// Contém APENAS a lógica que fala com o Supabase (Online).

import { supabase } from '../lib/supabaseClient';
import { Comanda, ItemComanda, Pagamento, Produto, Cliente, Caixa } from '../types';

// --- Mappers ---
function mapSupabaseComandaToComanda(data: any): Comanda {
  return {
    ...data,
    id_cliente: data.id_cliente || undefined,
    fechado_em: data.fechado_em || undefined,
    cliente: data.cliente || undefined,
    itens: data.itens?.map(mapSupabaseItemToItemComanda) || [],
    pagamentos: data.pagamentos || []
  };
}
function mapSupabaseItemToItemComanda(data: any): ItemComanda {
  return { ...data, produto: data.produto || undefined };
}
function mapSupabaseProdutoToProduto(data: any): Produto {
  return { ...data, criado_em: data.criado_em || new Date().toISOString() };
}
function mapSupabaseClienteToCliente(data: any): Cliente {
  return { ...data, telefone: data.telefone || undefined, criado_em: data.criado_em || new Date().toISOString() };
}
function mapSupabaseCaixaToCaixa(data: any): Caixa {
    return {
        id: data.id,
        data_abertura: data.data_abertura,
        valor_inicial: data.valor_inicial,
        data_fechamento: data.data_fechamento,
        valor_final: data.valor_final,
    };
}


function lancarErroSupabase(error: any): never {
  console.error('Erro no Supabase:', error);
  const mensagemErro = error.details || error.message || 'Ocorreu um erro na operação com o banco de dados.';
  throw new Error(mensagemErro);
}

// --- Serviço de Caixa ---
export const supabaseCaixaService = {
  // Chamada à função SQL: get_caixa_aberto()
  async obterCaixaAberto(): Promise<Caixa | null> {
    const { data, error } = await supabase.rpc('get_caixa_aberto').limit(1);
    
    if (error) lancarErroSupabase(error);
    if (!data || data.length === 0) return null;

    return mapSupabaseCaixaToCaixa(data[0]);
  },

  // Chamada à função SQL: abrir_caixa(p_valor_inicial)
  async abrirCaixa(valorInicial: number): Promise<void> {
    const { error } = await supabase.rpc('abrir_caixa', { p_valor_inicial: valorInicial.toFixed(2) });
    if (error) lancarErroSupabase(error);
  },

  // Chamada à função SQL: fechar_caixa(p_id_caixa, p_valor_final)
  async fecharCaixa(idCaixa: string, valorFinal: number): Promise<void> {
    const { error } = await supabase.rpc('fechar_caixa', { 
      p_id_caixa: idCaixa, 
      p_valor_final: valorFinal.toFixed(2) // Valor contado pelo usuário
    });
    if (error) lancarErroSupabase(error);
  },
};

// --- Serviço de Comandas ---
export const supabaseComandasService = {
  async listarAbertas(): Promise<Comanda[]> {
    const { data, error } = await supabase.from('comandas').select('*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*))').eq('status', 'aberta').order('numero', { ascending: true });
    if (error) lancarErroSupabase(error);
    return data?.map(mapSupabaseComandaToComanda) || [];
  },
  async criarComanda(numero: number, idCliente?: string): Promise<Comanda> {
    const { data, error } = await supabase.from('comandas').insert({ numero, id_cliente: idCliente }).select().single();
    if (error || !data) lancarErroSupabase(error || 'Erro ao criar comanda');
    return mapSupabaseComandaToComanda(data);
  },

  async adicionarItem(idComanda: string, item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'>): Promise<ItemComanda> {
    const { data: rpcData, error: rpcError } = await supabase.rpc('adicionar_item_comanda', { 
      p_id_comanda: idComanda, 
      p_id_produto: item.id_produto, 
      p_valor_unit: item.valor_unit 
    });
    
    if (rpcError) lancarErroSupabase(rpcError);
    if (!rpcData) lancarErroSupabase({ message: 'A função RPC não retornou dados.' });

    const { data: itemCompleto, error: itemError } = await supabase
      .from('itens_comanda')
      .select('*, produto:produtos(*)')
      .eq('id', rpcData.id) 
      .single();
    
    if (itemError || !itemCompleto) lancarErroSupabase(itemError || 'Erro ao buscar item pós-RPC');
    
    return mapSupabaseItemToItemComanda(itemCompleto);
  },

  async fecharComanda(idComanda: string, pagamentos: Omit<Pagamento, 'id' | 'data' | 'id_comanda'>[]): Promise<void> {
    const { error } = await supabase.rpc('fechar_comanda_com_pagamentos', { p_id_comanda: idComanda, p_pagamentos: pagamentos });
    if (error) lancarErroSupabase(error);
  },
  async atualizarQuantidadeItem(idComanda: string, idItem: string, quantidade: number): Promise<void> {
    const { error } = await supabase.from('itens_comanda').update({ quantidade }).eq('id', idItem).eq('id_comanda', idComanda);
    if (error) lancarErroSupabase(error);
  },
  async removerItem(idComanda: string, idItem: string): Promise<void> {
    const { error } = await supabase.from('itens_comanda').delete().eq('id', idItem).eq('id_comanda', idComanda);
    if (error) lancarErroSupabase(error);
  },
};

// --- Serviço de Produtos ---
export const supabaseProdutosService = {
  async listar(): Promise<Produto[]> {
    const { data, error } = await supabase.from('produtos').select('*').order('nome', { ascending: true });
    if (error) lancarErroSupabase(error);
    return data?.map(mapSupabaseProdutoToProduto) || [];
  },
  async listarAtivos(): Promise<Produto[]> {
    const { data, error } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome', { ascending: true });
    if (error) lancarErroSupabase(error);
    return data?.map(mapSupabaseProdutoToProduto) || [];
  },
  async criar(produto: Omit<Produto, 'id' | 'criado_em'>): Promise<Produto> {
    const { data, error } = await supabase.from('produtos').insert(produto).select().single();
    if (error || !data) lancarErroSupabase(error || 'Erro ao criar produto');
    return mapSupabaseProdutoToProduto(data);
  },
  async atualizar(id: string, produto: Partial<Produto>): Promise<Produto> {
    const { data, error } = await supabase.from('produtos').update(produto).eq('id', id).select().single();
    if (error || !data) lancarErroSupabase(error || 'Erro ao atualizar produto');
    return mapSupabaseProdutoToProduto(data);
  },
  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) lancarErroSupabase(error);
  },
  async verificarUsoProduto(id: string): Promise<boolean> {
    const { error, count } = await supabase.from('itens_comanda').select('id', { count: 'exact', head: true }).eq('id_produto', id);
    if (error) lancarErroSupabase(error);
    return (count || 0) > 0;
  },
};

// --- Serviço de Clientes ---
export const supabaseClientesService = {
  async listar(): Promise<Cliente[]> {
    const { data, error } = await supabase.from('clientes').select('*').order('nome', { ascending: true });
    if (error) lancarErroSupabase(error);
    return data?.map(mapSupabaseClienteToCliente) || [];
  },
  async criar(cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente> {
    const { data, error } = await supabase.from('clientes').insert(cliente).select().single();
    if (error || !data) lancarErroSupabase(error || 'Erro ao criar cliente');
    return mapSupabaseClienteToCliente(data);
  },
  async atualizar(id: string, cliente: Partial<Cliente>): Promise<Cliente> {
    const { data, error } = await supabase.from('clientes').update(cliente).eq('id', id).select().single();
    if (error || !data) lancarErroSupabase(error || 'Erro ao atualizar cliente');
    return mapSupabaseClienteToCliente(data);
  },
  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) lancarErroSupabase(error);
  },
};