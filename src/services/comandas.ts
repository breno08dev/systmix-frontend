// src/services/comandas.ts
import { supabase } from '../lib/supabaseClient';
import { Comanda, ItemComanda, PagamentoInput } from '../types';
import { localDatabaseService } from '../lib/localDatabase';

export const comandasService = {
  
  // CORREÇÃO: Adicionando a função que faltava e gerava o erro vermelho
  async listarAbertas(isOnline: boolean): Promise<Comanda[]> {
    if (isOnline) {
      const { data, error } = await supabase
        .from('comandas')
        .select(`*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*))`)
        .eq('status', 'aberta')
        .order('numero', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } else {
      // Fallback seguro para o offline
      if ('listarComandasAbertas' in localDatabaseService) {
          return (localDatabaseService as any).listarComandasAbertas();
      }
      return []; // Retorna vazio se não tiver suporte offline implementado ainda
    }
  },

  async criarComanda(isOnline: boolean, numero: number, idCliente?: string): Promise<Comanda> {
    if (isOnline) {
      const { data, error } = await supabase
        .from('comandas')
        .insert([{ numero, id_cliente: idCliente, status: 'aberta' }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      return localDatabaseService.criarComanda(numero, idCliente);
    }
  },

  async buscarPorId(isOnline: boolean, id: string): Promise<Comanda | null> {
    if (isOnline) {
      const { data, error } = await supabase
        .from('comandas')
        .select(`*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*))`)
        .eq('id', id)
        .single();
      
      if (error) return null;
      return data;
    } else {
      // CORREÇÃO: Nome correto do método offline (geralmente é buscarComanda)
      if ('buscarComanda' in localDatabaseService) {
          return (localDatabaseService as any).buscarComanda(id);
      }
      return null;
    }
  },

  async adicionarItem(
    isOnline: boolean, 
    idComanda: string, 
    item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'>
  ): Promise<void> {
    if (isOnline) {
      // 1. Verifica Estoque
      const { data: produto, error: erroProd } = await supabase
        .from('produtos')
        .select('estoque')
        .eq('id', item.id_produto)
        .single();

      if (erroProd || !produto) throw new Error("Produto não encontrado.");
      if (produto.estoque < item.quantidade) throw new Error("Estoque insuficiente.");

      // 2. Adiciona Item
      const { error } = await supabase.from('itens_comanda').insert([{ ...item, id_comanda: idComanda }]);
      if (error) throw error;

      // 3. Baixa Estoque
      await supabase.from('produtos').update({ estoque: produto.estoque - item.quantidade }).eq('id', item.id_produto);

    } else {
      await localDatabaseService.adicionarItem(idComanda, item);
    }
  },

  async removerItem(isOnline: boolean, idComanda: string, idItem: string): Promise<void> {
      if (isOnline) {
          // Busca para devolver estoque
          const { data: item } = await supabase.from('itens_comanda').select('id_produto, quantidade').eq('id', idItem).single();
          
          const { error } = await supabase.from('itens_comanda').delete().eq('id', idItem);
          if (error) throw error;

          // Devolve estoque
          if (item) {
             const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).single();
             if (prod) {
                 await supabase.from('produtos').update({ estoque: prod.estoque + item.quantidade }).eq('id', item.id_produto);
             }
          }
      } else {
          await localDatabaseService.removerItem(idItem);
      }
  },

  // CORREÇÃO: Aceita PagamentoInput[] para evitar erro de tipagem
  async fecharComanda(isOnline: boolean, idComanda: string, pagamentos: PagamentoInput[]): Promise<void> {
    if (isOnline) {
      const { error: erroPag } = await supabase.from('pagamentos').insert(
        pagamentos.map(p => ({ 
            id_comanda: idComanda, 
            metodo: p.metodo, 
            valor: p.valor,
            data: new Date().toISOString() 
        }))
      );
      if (erroPag) throw erroPag;

      const { error } = await supabase
        .from('comandas')
        .update({ status: 'fechada', fechado_em: new Date().toISOString() })
        .eq('id', idComanda);

      if (error) throw error;
    } else {
      await localDatabaseService.fecharComanda(idComanda, pagamentos as any);
    }
  }
};