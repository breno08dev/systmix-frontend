// src/services/comandas.ts
import { supabase } from '../lib/supabaseClient';
import { Comanda, ItemComanda, PagamentoInput } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

// --- FUNÇÃO AUXILIAR PARA NORMALIZAR DADOS ---
const normalizarItem = (item: any): ItemComanda => {
    if (!item) return item;
    return {
        ...item,
        produto: item.produto ? {
            ...item.produto,
            estoque: Number(item.produto.estoque ?? 0), 
            preco: Number(item.produto.preco ?? 0),
            categoria: item.produto.categoria || 'Geral' 
        } : undefined
    } as ItemComanda;
};

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
        
        const comandas = (data || []).map((c: any) => ({
            ...c,
            status: (c.status === 'aberta' || c.status === 'fechada') ? c.status : 'aberta',
            itens: c.itens ? c.itens.map((i: any) => normalizarItem(i)) : []
        })) as Comanda[];

        // CACHE
        if (comandas.length > 0) {
            const comandasParaCache = comandas.map(({ itens: _itens, cliente: _cliente, ...resto }) => ({
                ...resto,
                pagamentos: [] 
            }));
            await db.comandas.bulkPut(comandasParaCache as any);
            const todosItens = comandas.flatMap(c => c.itens || []);
            await db.itensComanda.bulkPut(todosItens as any);
            const clientesEncontrados = comandas.map(c => c.cliente).filter((c): c is any => !!c);
            if (clientesEncontrados.length > 0) await db.clientes.bulkPut(clientesEncontrados);
        }
        return comandas;
      } catch (err) {
        console.error("Erro online, fallback offline:", err);
        return await localDatabaseService.listarAbertas();
      }
    } else {
        return await localDatabaseService.listarAbertas();
    }
  },

 async buscarPorId(isOnline: boolean, id: string): Promise<Comanda | null> {
    if (!isOnline) {
       const comanda = await db.comandas.get(id);
       if (comanda) {
          const itens = await db.itensComanda.where('id_comanda').equals(id).toArray();
          for (const item of itens) {
             const prod = await db.produtos.get(item.id_produto);
             if (prod) item.produto = prod;
          }
          if (comanda.id_cliente && !comanda.cliente) {
              const cli = await db.clientes.get(comanda.id_cliente);
              if (cli) comanda.cliente = cli;
          }
          return { ...comanda, itens } as Comanda;
       }
       return null;
    }

    const { data, error } = await supabase
      .from('comandas')
      .select(`*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*))`)
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return null;

    return { ...data, itens: data.itens?.map((i: any) => normalizarItem(i)) } as Comanda;
  },

 async criarComanda(isOnline: boolean, numero: number, idCliente?: string): Promise<Comanda> {
  if (isOnline) {
    const { data: existente } = await supabase
        .from('comandas')
        .select(`*, cliente:clientes(*)`)
        .eq('numero', numero)
        .eq('status', 'aberta')
        .maybeSingle();
    
    if (existente) return existente as Comanda;

    const { data, error } = await supabase
      .from('comandas')
      .insert([{ numero, id_cliente: idCliente, status: 'aberta' }])
      .select(`*, cliente:clientes(*)`)
      .single();
      
      if (error) throw error;
      const novaComanda = data as Comanda;
      await db.comandas.put({ ...novaComanda, itens: [], pagamentos: [] });
      return novaComanda;
    } else {
      return await localDatabaseService.criarComanda(numero, idCliente);
    }
  },

  // --- NOVA FUNÇÃO ADICIONADA: EXCLUIR ---
  async excluir(isOnline: boolean, id: string): Promise<void> {
    if (isOnline) {
        // Deleta do Supabase
        const { error } = await supabase.from('comandas').delete().eq('id', id);
        if (error) throw error;

        // Limpa do local também para não ficar "fantasma"
        await db.comandas.delete(id);
        await db.itensComanda.where('id_comanda').equals(id).delete();
    } else {
        // Deleta apenas local
        await db.comandas.delete(id);
        await db.itensComanda.where('id_comanda').equals(id).delete();
        // Nota: Se precisar que essa exclusão suba pro servidor depois, 
        // precisaria adicionar um 'addPendingAction' aqui e tratar no SyncContext.
    }
  },

  async adicionarItem(isOnline: boolean, idComanda: string, item: any): Promise<ItemComanda> {
    if (isOnline) {
        const { data: produto } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).maybeSingle();
        const estoqueAtual = produto?.estoque ?? 0;
        if (estoqueAtual < item.quantidade) throw new Error("Estoque insuficiente (Online).");

        const { data: itemExistente } = await supabase.from('itens_comanda').select('*').eq('id_comanda', idComanda).eq('id_produto', item.id_produto).maybeSingle();
        let itemFinal;

        if (itemExistente) {
            const novaQtd = itemExistente.quantidade + item.quantidade;
            const { data, error } = await supabase.from('itens_comanda').update({ quantidade: novaQtd }).eq('id', itemExistente.id).select(`*, produto:produtos(*)`).single();
            if (error) throw error;
            itemFinal = normalizarItem(data);
            await db.itensComanda.update(itemExistente.id, { quantidade: novaQtd });
        } else {
            const { data, error } = await supabase.from('itens_comanda').insert([{ ...item, id_comanda: idComanda }]).select(`*, produto:produtos(*)`).single();
            if (error) throw error;
            itemFinal = normalizarItem(data);
            await db.itensComanda.put(itemFinal); 
        }
        await supabase.from('produtos').update({ estoque: estoqueAtual - item.quantidade }).eq('id', item.id_produto);
        return itemFinal;
    } else {
        const produtoLocal = await db.produtos.get(item.id_produto);
        const estoqueLocal = produtoLocal?.estoque ?? 0;
        if (estoqueLocal < item.quantidade) throw new Error("Estoque insuficiente (Local).");

        const itemLocalExistente = await db.itensComanda.where({ id_comanda: idComanda, id_produto: item.id_produto }).first();

        if (itemLocalExistente) {
            const novaQtd = itemLocalExistente.quantidade + item.quantidade;
            await db.itensComanda.update(itemLocalExistente.id, { quantidade: novaQtd });
            await localDatabaseService.addPendingAction('ATUALIZAR_QTD_ITEM', { id_comanda: idComanda, id_item: itemLocalExistente.id, novaQuantidade: novaQtd });
            if (produtoLocal) await db.produtos.update(item.id_produto, { estoque: estoqueLocal - item.quantidade });
            return { ...itemLocalExistente, quantidade: novaQtd } as ItemComanda;
        } else {
            const novoItem = await localDatabaseService.adicionarItem(idComanda, item);
            if (produtoLocal) await db.produtos.update(item.id_produto, { estoque: estoqueLocal - item.quantidade });
            return novoItem;
        }
    }
  },

 async removerItem(isOnline: boolean, _idComanda: string, idItem: string): Promise<void> {
    if (isOnline) {
        const { data: item } = await supabase.from('itens_comanda').select('*').eq('id', idItem).maybeSingle();
        if (item) {
            await supabase.from('itens_comanda').delete().eq('id', idItem);
            const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).maybeSingle();
            if (prod) {
                const estoqueAtual = Number(prod.estoque ?? 0); 
                await supabase.from('produtos').update({ estoque: estoqueAtual + item.quantidade }).eq('id', item.id_produto);
            }
        }
        await db.itensComanda.delete(idItem);
    } else {
        const item = await db.itensComanda.get(idItem);
        await localDatabaseService.removerItem(idItem);
        if (item) {
             const prod = await db.produtos.get(item.id_produto);
             if (prod) {
                 const estoqueAtual = Number(prod.estoque ?? 0);
                 await db.produtos.update(item.id_produto, { estoque: estoqueAtual + item.quantidade });
             }
        }
    }
  },

  async atualizarQuantidadeItem(isOnline: boolean, _idComanda: string, idItem: string, novaQuantidade: number): Promise<void> {
     if (isOnline) {
       const { data: itemAtual } = await supabase.from('itens_comanda').select('quantidade, id_produto').eq('id', idItem).maybeSingle();
       if (itemAtual) {
           const diferenca = novaQuantidade - itemAtual.quantidade;
           await supabase.from('itens_comanda').update({ quantidade: novaQuantidade }).eq('id', idItem);
           if (diferenca !== 0) {
              const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', itemAtual.id_produto).maybeSingle();
              if (prod) {
                  const estoqueAtual = Number(prod.estoque ?? 0);
                  await supabase.from('produtos').update({ estoque: estoqueAtual - diferenca }).eq('id', itemAtual.id_produto);
              }
           }
           await db.itensComanda.update(idItem, { quantidade: novaQuantidade });
       }
     } else {
       await localDatabaseService.atualizarQuantidadeItem(idItem, novaQuantidade);
     }
  },

  async fecharComanda(isOnline: boolean, idComanda: string, pagamentos: PagamentoInput[], dataFechamentoOffline?: string): Promise<void> {
    const dataFinal = dataFechamentoOffline || new Date().toISOString();
    const formatarMetodo = (m: string) => m.toUpperCase().includes('DINHEIRO') ? 'DINHEIRO' : (m.toUpperCase().includes('PIX') ? 'PIX' : 'CARTAO');

    if (isOnline) {
        const { data: comanda } = await supabase.from('comandas').select('status').eq('id', idComanda).maybeSingle();
        if (!comanda || comanda.status === 'fechada') return;

        await supabase.from('pagamentos').insert(pagamentos.map(p => ({
            id_comanda: idComanda,
            metodo: formatarMetodo(p.metodo),
            valor: p.valor,
            data: dataFinal
        })));
        await supabase.from('comandas').update({ status: 'fechada', fechado_em: dataFinal }).eq('id', idComanda);
        await db.comandas.update(idComanda, { status: 'fechada', fechado_em: dataFinal });
    } else {
        await localDatabaseService.fecharComanda(idComanda, pagamentos);
    }
  }
};