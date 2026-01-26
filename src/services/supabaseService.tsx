// src/services/supabaseService.tsx
import { supabase } from '../lib/supabaseClient';
import { Comanda, ItemComanda, PagamentoInput, Produto, Cliente, Caixa } from '../types';

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

// 🔥 CORREÇÃO DO CONFLITO DE TIPOS AQUI 🔥
function mapSupabaseCaixaToCaixa(data: any): Caixa {
    return {
        id: data.id,
        aberto: data.aberto,
        // Correção: Mapear para os nomes exatos da Interface Caixa
        saldo_inicial: Number(data.saldo_inicial), 
        saldo_atual: Number(data.saldo_atual),
        aberto_em: data.aberto_em,
        fechado_em: data.fechado_em || undefined,
        operador: data.operador || undefined
    };
}

function lancarErroSupabase(error: any): never {
  console.error('Erro no Supabase:', error);
  const mensagemErro = error.details || error.message || 'Ocorreu um erro na operação com o banco de dados.';
  throw new Error(mensagemErro);
}

// --- Serviço de Comandas ---
export const supabaseComandasService = {
  async listarAbertas(): Promise<Comanda[]> {
    const { data, error } = await supabase.from('comandas').select('*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*))').eq('status', 'aberta').order('numero', { ascending: true });
    if (error) lancarErroSupabase(error);
    return data?.map(mapSupabaseComandaToComanda) || [];
  },
  async criarComanda(numero: number, idCliente?: string): Promise<Comanda> {
    const { data, error } = await supabase.from('comandas').insert({ numero, id_cliente: idCliente, status: 'aberta' }).select().single();
    if (error || !data) lancarErroSupabase(error || 'Erro ao criar comanda');
    return mapSupabaseComandaToComanda(data);
  },
  async adicionarItem(idComanda: string, item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'>): Promise<ItemComanda> {
    const { data: rpcData, error: rpcError } = await supabase.rpc('adicionar_item_comanda', { 
      p_id_comanda: idComanda, 
      p_id_produto: item.id_produto, 
      p_valor_unit: item.valor_unit 
    });
    
    // Fallback se RPC falhar ou não retornar dados, tenta insert direto se possível, ou lança erro
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
  async fecharComanda(idComanda: string, pagamentos: Omit<PagamentoInput, 'id' | 'data' | 'id_comanda'>[]): Promise<void> {
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

// --- Serviço de Caixa ---
export const supabaseCaixaService = {
  async obterCaixaAberto(): Promise<Caixa | null> {
    const { data, error } = await supabase
      .from('caixas')
      .select('*')
      .eq('aberto', true)
      .order('aberto_em', { ascending: false })
      .limit(1)
      .single();

    if (error) {
       // Código PGRST116 significa "Nenhum resultado encontrado", o que é normal se não tiver caixa aberto
       if (error.code !== 'PGRST116') {
          console.error("Erro ao buscar caixa aberto:", error);
       }
       return null;
    }

    if (!data) return null;
    return mapSupabaseCaixaToCaixa(data);
  },

  async abrirCaixa(valorInicial: number, operador: string): Promise<Caixa> {
    const { data, error } = await supabase
      .from('caixas')
      .insert([{
        aberto: true,
        saldo_inicial: valorInicial,
        saldo_atual: valorInicial,
        operador: operador,
        aberto_em: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
        console.error("Erro ao abrir caixa:", error);
        throw new Error(error.message);
    }

    // Registra a movimentação inicial
    await supabase.from('movimentacoes_caixa').insert([{
        id_caixa: data.id,
        tipo: 'abertura',
        valor: valorInicial,
        descricao: `Abertura de Caixa por ${operador}`
    }]);

    return mapSupabaseCaixaToCaixa(data);
  },

  async fecharCaixa(idCaixa: string, valorFinal: number): Promise<void> {
    const { error } = await supabase
      .from('caixas')
      .update({
        aberto: false,
        saldo_atual: valorFinal,
        fechado_em: new Date().toISOString()
      })
      .eq('id', idCaixa);

    if (error) {
        console.error("Erro ao fechar caixa:", error);
        throw new Error(error.message);
    }
    
    // Registra movimentação de fechamento
    await supabase.from('movimentacoes_caixa').insert([{
        id_caixa: idCaixa,
        tipo: 'fechamento',
        valor: valorFinal,
        descricao: 'Fechamento de Caixa'
    }]);
  },
  
  // Atualiza saldo (usado em vendas)
  async atualizarSaldo(idCaixa: string, novoSaldo: number): Promise<void> {
      const { error } = await supabase
        .from('caixas')
        .update({ saldo_atual: novoSaldo })
        .eq('id', idCaixa);
        
      if (error) throw error;
  }
};