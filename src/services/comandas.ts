// src/services/comandas.ts
import { supabase } from '../lib/supabaseClient';
import { Comanda, ItemComanda, PagamentoInput } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

export const comandasService = {
  
  async listarAbertas(isOnline: boolean): Promise<Comanda[]> {
    if (isOnline) {
      try {
        const { data, error } = await supabase
          .from('comandas')
          .select(`*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*))`)
          .eq('status', 'aberta')
          .order('numero', { ascending: true });
        
        if (error) throw error;
        
       const comandas = data || [];

        // CACHE: Salva comandas, itens E CLIENTES para uso offline
        if (comandas.length > 0) {
            const comandasLimpas = comandas.map(({ itens: _itens, cliente: _cliente, ...resto }) => resto);
            await db.comandas.bulkPut(comandasLimpas as any);

            const todosItens = comandas.flatMap(c => c.itens || []);
            await db.itensComanda.bulkPut(todosItens as any);
            
            // NOVO: Extrair e salvar clientes para garantir que existam offline
            const clientesEncontrados = comandas.map(c => c.cliente).filter(c => !!c);
            if (clientesEncontrados.length > 0) {
                 await db.clientes.bulkPut(clientesEncontrados as any);
            }
        }
        
        return comandas;
      } catch (err) {
        console.error("Erro online, fallback para offline:", err);
        return await localDatabaseService.listarAbertas();
      }
    } else {
        return await localDatabaseService.listarAbertas();
    }
  },

  async buscarPorId(isOnline: boolean, id: string): Promise<Comanda | null> {
    if (!isOnline) {
       const comanda = await db.comandas.get(id);
       if(comanda) {
          comanda.itens = await db.itensComanda.where('id_comanda').equals(id).toArray();
          return comanda;
       }
       return null;
    }

    const { data, error } = await supabase
      .from('comandas')
      .select(`*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*))`)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async criarComanda(isOnline: boolean, numero: number, idCliente?: string): Promise<Comanda> {
    if (isOnline) {
      const { data, error } = await supabase
        .from('comandas')
        .insert([{ numero, id_cliente: idCliente, status: 'aberta' }])
        .select(`*, cliente:clientes(*)`)
        .single();

      if (error) throw error;
      
      await db.comandas.put({ ...data, itens: [] });
      return data;
    } else {
      const novaComanda = await localDatabaseService.criarComanda(numero, idCliente);
      await localDatabaseService.addPendingAction('CRIAR_COMANDA', { 
        numero, 
        idCliente,
        tempId: novaComanda.id 
      });
      return novaComanda;
    }
  },

  async adicionarItem(isOnline: boolean, idComanda: string, item: any): Promise<ItemComanda> {
    if (isOnline) {
        // Verifica Estoque Online
        const { data: produto } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).single();
        if (!produto || produto.estoque < item.quantidade) throw new Error("Estoque insuficiente (Online).");

        const { data, error } = await supabase
          .from('itens_comanda')
          .insert([{ ...item, id_comanda: idComanda }])
          .select(`*, produto:produtos(*)`)
          .single();

        if (error) throw error;

        await supabase.from('produtos').update({ estoque: produto.estoque - item.quantidade }).eq('id', item.id_produto);
        await db.itensComanda.put(data); 
        
        return data;
    } else {
        const produtoLocal = await db.produtos.get(item.id_produto);
        if (produtoLocal && produtoLocal.estoque < item.quantidade) {
            throw new Error("Estoque insuficiente (Local).");
        }

        const novoItem = await localDatabaseService.adicionarItem(idComanda, item);
        
        if (produtoLocal) {
            await db.produtos.update(item.id_produto, { estoque: produtoLocal.estoque - item.quantidade });
        }

        await localDatabaseService.addPendingAction('ADICIONAR_ITEM', { ...item, id_comanda: idComanda });
        return novoItem;
    }
  },

  async removerItem(isOnline: boolean, _idComanda: string, idItem: string): Promise<void> {
    if (isOnline) {
        const { data: item } = await supabase.from('itens_comanda').select('*').eq('id', idItem).single();
        const { error } = await supabase.from('itens_comanda').delete().eq('id', idItem);
        if (error) throw error;

        if (item) {
            const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).single();
            if (prod) {
                await supabase.from('produtos').update({ estoque: prod.estoque + item.quantidade }).eq('id', item.id_produto);
            }
        }
        await db.itensComanda.delete(idItem);
    } else {
        const item = await db.itensComanda.get(idItem);
        await localDatabaseService.removerItem(idItem);
        
        if (item) {
             const prod = await db.produtos.get(item.id_produto);
             if (prod) await db.produtos.update(item.id_produto, { estoque: prod.estoque + item.quantidade });
        }
        await localDatabaseService.addPendingAction('REMOVER_ITEM', { idItem, idComanda: _idComanda });
    }
  },

  async atualizarQuantidadeItem(isOnline: boolean, _idComanda: string, idItem: string, novaQuantidade: number): Promise<void> {
     if (isOnline) {
       await supabase.from('itens_comanda').update({ quantidade: novaQuantidade }).eq('id', idItem);
       await db.itensComanda.update(idItem, { quantidade: novaQuantidade });
     } else {
       await localDatabaseService.atualizarQuantidadeItem(idItem, novaQuantidade);
       await localDatabaseService.addPendingAction('ATUALIZAR_QTD_ITEM', { idItem, novaQuantidade });
     }
  },

  async fecharComanda(isOnline: boolean, idComanda: string, pagamentos: PagamentoInput[], dataFechamentoOffline?: string): Promise<void> {
    const normalizarMetodo = (metodo: string) => {
        const m = metodo.toUpperCase();
        if (m.includes('DINHEIRO')) return 'DINHEIRO';
        if (m.includes('PIX')) return 'PIX';
        if (m.includes('CARTAO') || m.includes('CARTÃO') || m.includes('CREDITO') || m.includes('DEBITO')) return 'CARTAO';
        return 'OUTROS';
    };

    const dataFinal = dataFechamentoOffline || new Date().toISOString();

    if (isOnline) {
        const pagamentosFormatados = pagamentos.map(p => ({ 
            id_comanda: idComanda, 
            metodo: normalizarMetodo(p.metodo),
            valor: p.valor,
            data: dataFinal
        }));

        const { error: erroPag } = await supabase.from('pagamentos').insert(pagamentosFormatados);
        if (erroPag) throw new Error("Erro ao registrar pagamento financeiro.");

        const { error } = await supabase
          .from('comandas')
          .update({ status: 'fechada', fechado_em: dataFinal })
          .eq('id', idComanda);

        if (error) throw error;

        await db.comandas.update(idComanda, { status: 'fechada', fechado_em: dataFinal });
    } else {
        await localDatabaseService.fecharComanda(idComanda, pagamentos.map(p => ({
            metodo: normalizarMetodo(p.metodo),
            valor: p.valor
        })));

        await localDatabaseService.addPendingAction('FECHAR_COMANDA', { 
            idComanda, 
            pagamentos,
            dataFechamento: new Date().toISOString() 
        });
    }
  }
};