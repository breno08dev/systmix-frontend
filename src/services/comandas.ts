// src/services/comandas.ts
import { supabase } from '../lib/supabaseClient';
import { Comanda, ItemComanda, PagamentoInput } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

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
        const { data } = await supabase
          .from('comandas')
          .select(`*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*))`)
          .eq('status', 'aberta')
          .order('numero', { ascending: true })
          .throwOnError(); 
        
        const comandas = (data || []).map((c: any) => ({
            ...c,
            status: (c.status === 'aberta' || c.status === 'fechada') ? c.status : 'aberta',
            itens: c.itens ? c.itens.map((i: any) => normalizarItem(i)) : []
        })) as Comanda[];

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
        console.warn("Fallback Offline Comandas:", err);
        return await localDatabaseService.listarAbertas();
      }
    } 
    return await localDatabaseService.listarAbertas();
  },

 async buscarPorId(isOnline: boolean, id: string): Promise<Comanda | null> {
    if (isOnline && !id.startsWith('local_')) {
        try {
            const { data, error } = await supabase
              .from('comandas')
              .select(`*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*))`)
              .eq('id', id)
              .maybeSingle();
            
            if (error) throw error;
            if (data) {
                return { ...data, itens: data.itens?.map((i: any) => normalizarItem(i)) } as Comanda;
            }
        } catch (error) {}
    }

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
  },

 async criarComanda(isOnline: boolean, numero: number, idCliente?: string): Promise<Comanda> {
  if (isOnline) {
    try {
        const { data: existente } = await supabase
            .from('comandas')
            .select(`*, cliente:clientes(*)`)
            .eq('numero', numero)
            .eq('status', 'aberta')
            .maybeSingle();
        
        if (existente) {
             await db.comandas.put({ ...existente, itens: [], pagamentos: [] } as any);
             return existente as Comanda;
        }

        const { data, error } = await supabase
          .from('comandas')
          .insert([{ numero, id_cliente: idCliente, status: 'aberta' }])
          .select(`*, cliente:clientes(*)`)
          .single();
          
        if (error) throw error;
        
        const nova = data as Comanda;
        await db.comandas.put({ ...nova, itens: [], pagamentos: [] });
        return nova;
    } catch (err) {
        console.error("Erro criar online, indo para offline:", err);
    }
  }
  return await localDatabaseService.criarComanda(numero, idCliente);
  },

  async excluir(isOnline: boolean, id: string): Promise<void> {
    if (isOnline && !id.startsWith('local_')) {
        try {
            const { error } = await supabase.from('comandas').delete().eq('id', id);
            if (error) throw error;
            await db.comandas.delete(id);
            await db.itensComanda.where('id_comanda').equals(id).delete();
            return;
        } catch (e) { console.error("Erro delete online:", e); }
    }
    await localDatabaseService.deletarComanda(id);
  },

  async adicionarItem(isOnline: boolean, idComanda: string, item: any): Promise<ItemComanda> {
    // 1. Tenta Online (somente se a comanda já estiver sincronizada)
    if (isOnline && !idComanda.startsWith('local_')) {
        try {
            const { data: produto } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).maybeSingle();
            const estoqueAtual = produto?.estoque ?? 0;
            if (estoqueAtual < item.quantidade) throw new Error("Estoque insuficiente.");

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
            const prodLocal = await db.produtos.get(item.id_produto);
            if (prodLocal) await db.produtos.update(item.id_produto, { estoque: (prodLocal.estoque || 0) - item.quantidade });

            return itemFinal;
        } catch (err) {
            console.error("Erro adicionarItem online:", err);
            // Cai para o bloco offline abaixo
        }
    } 

    // 2. Lógica Offline INTELIGENTE (Merge/Upsert Local)
    // Verifica se já existe esse produto na comanda localmente
    const itemExistenteLocal = await db.itensComanda
        .where('id_comanda').equals(idComanda)
        .filter(i => i.id_produto === item.id_produto)
        .first();

    if (itemExistenteLocal) {
        // Se existe, soma a quantidade e cria ação de ATUALIZAR (não ADICIONAR)
        const novaQtd = itemExistenteLocal.quantidade + Number(item.quantidade);
        await db.itensComanda.update(itemExistenteLocal.id, { quantidade: novaQtd });
        
        // Remove ações pendentes antigas desse item para não poluir
        // (Opcional, mas ajuda. O SyncContext já otimiza, mas garantimos aqui)
        
        await localDatabaseService.addPendingAction('ATUALIZAR_QTD_ITEM', {
            id_comanda: idComanda,
            id_item: itemExistenteLocal.id,
            quantidade: novaQtd
        });

        return { ...itemExistenteLocal, quantidade: novaQtd };
    } else {
        // Se não existe, cria novo
        return await localDatabaseService.adicionarItem(idComanda, item);
    }
  },

 async removerItem(isOnline: boolean, _idComanda: string, idItem: string): Promise<void> {
    if (isOnline && !idItem.startsWith('local_')) {
        try {
            const { data: item } = await supabase.from('itens_comanda').select('*').eq('id', idItem).maybeSingle();
            if (item) {
                await supabase.from('itens_comanda').delete().eq('id', idItem);
                
                const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).maybeSingle();
                if (prod) {
                    await supabase.from('produtos').update({ estoque: (prod.estoque || 0) + item.quantidade }).eq('id', item.id_produto);
                }
                const prodLocal = await db.produtos.get(item.id_produto);
                if (prodLocal) await db.produtos.update(item.id_produto, { estoque: (prodLocal.estoque || 0) + item.quantidade });
            }
            await db.itensComanda.delete(idItem);
            return;
        } catch (e) { console.error("Erro removerItem online:", e); }
    } 
    return await localDatabaseService.removerItem(idItem);
  },

  async atualizarQuantidadeItem(isOnline: boolean, _idComanda: string, idItem: string, novaQuantidade: number): Promise<void> {
     if (isOnline && !idItem.startsWith('local_')) {
       try {
           const { data: itemAtual } = await supabase.from('itens_comanda').select('quantidade, id_produto').eq('id', idItem).maybeSingle();
           if (itemAtual) {
               const diferenca = novaQuantidade - itemAtual.quantidade;
               await supabase.from('itens_comanda').update({ quantidade: novaQuantidade }).eq('id', idItem);
               
               if (diferenca !== 0) {
                  const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', itemAtual.id_produto).maybeSingle();
                  if (prod) {
                      await supabase.from('produtos').update({ estoque: (prod.estoque || 0) - diferenca }).eq('id', itemAtual.id_produto);
                  }
               }
               await db.itensComanda.update(idItem, { quantidade: novaQuantidade });
               const prodLocal = await db.produtos.get(itemAtual.id_produto);
               if (prodLocal) await db.produtos.update(itemAtual.id_produto, { estoque: (prodLocal.estoque || 0) - diferenca });
           }
           return;
       } catch (e) { console.error("Erro atualizarQtd online:", e); }
     }
     await localDatabaseService.atualizarQuantidadeItem(idItem, novaQuantidade);
  },

  async fecharComanda(isOnline: boolean, idComanda: string, pagamentos: PagamentoInput[], dataFechamentoOffline?: string): Promise<void> {
    const dataFinal = dataFechamentoOffline || new Date().toISOString();
    const formatarMetodo = (m: string) => m.toUpperCase().includes('DINHEIRO') ? 'DINHEIRO' : (m.toUpperCase().includes('PIX') ? 'PIX' : 'CARTAO');

    if (isOnline && !idComanda.startsWith('local_')) {
        try {
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
            return;
        } catch (e) { console.error("Erro fecharComanda online:", e); }
    }
    await localDatabaseService.fecharComanda(idComanda, pagamentos);
  }
};