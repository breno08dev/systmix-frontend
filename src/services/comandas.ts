import { supabase } from '../lib/supabase';
import { Comanda, ItemComanda, Pagamento } from '../types';

export const comandasService = {
  async listarAbertas(): Promise<Comanda[]> {
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
      .order('numero');
    
    if (error) throw error;
    return data || [];
  },

  async buscarPorNumero(numero: number): Promise<Comanda | null> {
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
      .eq('numero', numero)
      .eq('status', 'aberta')
      .order('itens.criado_em', { ascending: true })
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async criarComanda(numero: number, idCliente?: string): Promise<Comanda> {
    const { data, error } = await supabase
      .from('comandas')
      .insert({
        numero,
        id_cliente: idCliente,
        status: 'aberta'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async adicionarItem(item: Omit<ItemComanda, 'id' | 'criado_em'>): Promise<ItemComanda> {
    const { data, error } = await supabase
      .from('itens_comanda')
      .insert(item)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async atualizarQuantidadeItem(id: string, quantidade: number): Promise<void> {
    const { error } = await supabase
      .from('itens_comanda')
      .update({ quantidade })
      .eq('id', id);
    
    if (error) throw error;
  },

  async removerItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('itens_comanda')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async fecharComanda(idComanda: string, pagamentos: Omit<Pagamento, 'id' | 'data'>[]): Promise<void> {
    try {
      // Verificar se a comanda ainda está aberta
      const { data: comanda, error: checkError } = await supabase
        .from('comandas')
        .select('status')
        .eq('id', idComanda)
        .single();
      
      if (checkError) throw checkError;
      
      if (comanda.status !== 'aberta') {
        throw new Error('Esta comanda já foi fechada');
      }

      // Inserir pagamentos primeiro
      if (pagamentos.length > 0) {
        const { error: paymentError } = await supabase
          .from('pagamentos')
          .insert(pagamentos);
        
        if (paymentError) throw paymentError;
      }

      // Atualizar status da comanda
      const { error: updateError } = await supabase
        .from('comandas')
        .update({
          status: 'fechada',
          fechado_em: new Date().toISOString()
        })
        .eq('id', idComanda);
      
      if (updateError) throw updateError;
      
    } catch (error) {
      console.error('Erro ao fechar comanda:', error);
      throw error;
    }
  }
};