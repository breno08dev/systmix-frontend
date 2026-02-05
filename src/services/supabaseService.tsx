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

// 🔥 CORREÇÃO 1: Mapeamento correto para a Interface Caixa 🔥
function mapSupabaseCaixaToCaixa(data: any): Caixa {
    return {
        id: data.id,
        aberto: data.aberto,
        // Banco (saldo_inicial) -> Interface (valor_inicial)
        valor_inicial: Number(data.saldo_inicial), 
        // Banco (saldo_atual) -> Interface (saldo_atual_local) e valor_final se fechado
        valor_final: !data.aberto ? Number(data.saldo_atual) : null,
        saldo_atual_local: Number(data.saldo_atual),
        // Banco (aberto_em) -> Interface (data_abertura)
        data_abertura: data.aberto_em,
        // Banco (fechado_em) -> Interface (data_fechamento)
        data_fechamento: data.fechado_em || null,
        operador: data.operador || null
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
    // 🔥 CORREÇÃO 2: Tipagem do retorno da RPC para acessar .id sem erro 🔥
    const { data: rpcData, error: rpcError } = await supabase.rpc('adicionar_item_comanda', { 
      p_id_comanda: idComanda, 
      p_id_produto: item.id_produto, 
      p_valor_unit: item.valor_unit 
    });
    
    if (rpcError) lancarErroSupabase(rpcError);
    if (!rpcData) lancarErroSupabase({ message: 'A função RPC não retornou dados.' });

    // Cast seguro para acessar o ID
    const rpcResult = rpcData as any;

    const { data: itemCompleto, error: itemError } = await supabase
      .from('itens_comanda')
      .select('*, produto:produtos(*)')
      .eq('id', rpcResult.id) 
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
    // CORREÇÃO: Prepara o objeto para o formato estrito do banco
    const payloadBanco = {
        ...produto,
        // Se categoria for objeto (Categoria), pega o nome. Se for string, usa ela mesma.
        categoria: typeof produto.categoria === 'object' ? produto.categoria?.nome || 'Geral' : produto.categoria,
        // Garante que o id_categoria seja string ou null (não undefined)
        id_categoria: produto.id_categoria || null
    };

    const { data, error } = await supabase.from('produtos').insert(payloadBanco).select().single();
    if (error || !data) lancarErroSupabase(error || 'Erro ao criar produto');
    return mapSupabaseProdutoToProduto(data);
  },

  async obterTotalVendasCaixaAtual(dataAbertura: string): Promise<number> {
    // Busca todos os pagamentos feitos DEPOIS que o caixa abriu
    const { data, error } = await supabase
      .from('pagamentos')
      .select('valor')
      .gte('data', dataAbertura); // gte = greater than or equal (maior ou igual)

    if (error) {
      console.error("Erro ao calcular vendas do caixa:", error);
      return 0;
    }

    // Soma os valores
    const total = data.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
    return total;
  },

  async atualizar(id: string, produto: Partial<Produto>): Promise<Produto> {
    // CORREÇÃO: Mesma lógica de limpeza para atualização
    const payloadBanco: any = { ...produto };
    
    if (produto.categoria !== undefined) {
        payloadBanco.categoria = typeof produto.categoria === 'object' 
            ? produto.categoria?.nome || 'Geral' 
            : produto.categoria;
    }

    const { data, error } = await supabase.from('produtos').update(payloadBanco).eq('id', id).select().single();
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
       if (error.code !== 'PGRST116') {
          console.error("Erro ao buscar caixa aberto:", error);
       }
       return null;
    }

    if (!data) return null;
    return mapSupabaseCaixaToCaixa(data);
  },

  // 🔥 ESTA É A FUNÇÃO QUE FALTAVA 🔥
  async obterTotalVendasCaixaAtual(dataAbertura: string): Promise<number> {
    const { data, error } = await supabase
      .from('pagamentos')
      .select('valor')
      .gte('data', dataAbertura); // Pega tudo DEPOIS da abertura

    if (error) {
      console.error("Erro ao calcular vendas do caixa:", error);
      return 0;
    }

    // Soma os valores
    const total = data?.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0) || 0;
    return total;
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
    
    await supabase.from('movimentacoes_caixa').insert([{
        id_caixa: idCaixa,
        tipo: 'fechamento',
        valor: valorFinal,
        descricao: 'Fechamento de Caixa'
    }]);
  },
  
  async atualizarSaldo(idCaixa: string, novoSaldo: number): Promise<void> {
      const { error } = await supabase
        .from('caixas')
        .update({ saldo_atual: novoSaldo })
        .eq('id', idCaixa);
        
      if (error) throw error;
  }
};