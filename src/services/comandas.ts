import { supabase } from '../lib/supabaseClient';
import { Comanda, ItemComanda, PagamentoInput } from '../types';

export const comandasService = {
  
  // Lista todas as comandas abertas
  async listarAbertas(isOnline: boolean): Promise<Comanda[]> {
    if (!isOnline) return [];

    const { data, error } = await supabase
      .from('comandas')
      .select(`
        *, 
        cliente:clientes(*), 
        itens:itens_comanda(
          *, 
          produto:produtos(*)
        )
      `)
      .eq('status', 'aberta')
      .order('numero', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  // Busca uma comanda específica por ID
  async buscarPorId(isOnline: boolean, id: string): Promise<Comanda | null> {
    if (!isOnline) return null;

    const { data, error } = await supabase
      .from('comandas')
      .select(`
        *, 
        cliente:clientes(*), 
        itens:itens_comanda(
          *, 
          produto:produtos(*)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async criarComanda(isOnline: boolean, numero: number, idCliente?: string): Promise<Comanda> {
    if (!isOnline) throw new Error("Offline");

    const { data, error } = await supabase
      .from('comandas')
      .insert([{ numero, id_cliente: idCliente, status: 'aberta' }])
      .select(`*, cliente:clientes(*)`)
      .single();

    if (error) throw error;
    return data;
  },

  async adicionarItem(isOnline: boolean, idComanda: string, item: any): Promise<ItemComanda> {
    if (!isOnline) throw new Error("Offline");

    // 1. Verifica Estoque
    const { data: produto } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).single();
    if (!produto || produto.estoque < item.quantidade) throw new Error("Estoque insuficiente.");

    // 2. Adiciona Item
    const { data, error } = await supabase
      .from('itens_comanda')
      .insert([{ ...item, id_comanda: idComanda }])
      .select(`*, produto:produtos(*)`)
      .single();

    if (error) throw error;

    // 3. Baixa Estoque
    await supabase.from('produtos').update({ estoque: produto.estoque - item.quantidade }).eq('id', item.id_produto);
    
    return data;
  },

  async removerItem(isOnline: boolean, idComanda: string, idItem: string): Promise<void> {
    if (!isOnline) throw new Error("Offline");

    // Pega dados para estorno
    const { data: item } = await supabase.from('itens_comanda').select('*').eq('id', idItem).single();
    
    const { error } = await supabase.from('itens_comanda').delete().eq('id', idItem);
    if (error) throw error;

    // Devolve Estoque
    if (item) {
       const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).single();
       if (prod) {
           await supabase.from('produtos').update({ estoque: prod.estoque + item.quantidade }).eq('id', item.id_produto);
       }
    }
  },

  // --- AQUI ESTÁ A CORREÇÃO PRINCIPAL ---
  async fecharComanda(isOnline: boolean, idComanda: string, pagamentos: PagamentoInput[]): Promise<void> {
    if (!isOnline) throw new Error("Offline");

    // Função para garantir que o texto salvo seja compatível com o Relatório
    const normalizarMetodo = (metodo: string) => {
        const m = metodo.toUpperCase();
        if (m.includes('DINHEIRO')) return 'DINHEIRO';
        if (m.includes('PIX')) return 'PIX';
        if (m.includes('CARTAO') || m.includes('CARTÃO') || m.includes('CREDITO') || m.includes('DEBITO')) return 'CARTAO';
        return 'OUTROS';
    };

    // 1. Registra os pagamentos na tabela 'pagamentos' (usada pelo relatório)
    const pagamentosFormatados = pagamentos.map(p => ({ 
        id_comanda: idComanda, 
        metodo: normalizarMetodo(p.metodo), // Converte 'Dinheiro - Comanda' -> 'DINHEIRO'
        valor: p.valor,
        data: new Date().toISOString() 
    }));

    const { error: erroPag } = await supabase
        .from('pagamentos')
        .insert(pagamentosFormatados);
    
    if (erroPag) {
        console.error("Erro ao salvar pagamento:", erroPag);
        throw new Error("Erro ao registrar pagamento financeiro.");
    }

    // 2. Marca a comanda como fechada
    const { error } = await supabase
      .from('comandas')
      .update({ status: 'fechada', fechado_em: new Date().toISOString() })
      .eq('id', idComanda);

    if (error) throw error;
  },
  
  async atualizarQuantidadeItem(isOnline: boolean, idComanda: string, idItem: string, novaQuantidade: number): Promise<void> {
    if (isOnline) {
       await supabase.from('itens_comanda').update({ quantidade: novaQuantidade }).eq('id', idItem);
    }
  }
};