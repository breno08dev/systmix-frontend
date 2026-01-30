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

        // CACHE: Salva dados para offline
        if (comandas.length > 0) {
            const comandasLimpas = comandas.map(({ itens: _itens, cliente: _cliente, ...resto }) => resto);
            await db.comandas.bulkPut(comandasLimpas as any);

            const todosItens = comandas.flatMap(c => c.itens || []);
            await db.itensComanda.bulkPut(todosItens as any);
            
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
      .maybeSingle(); // maybeSingle evita erro se ID não existir
    
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
        idTemp: novaComanda.id 
      });
      return novaComanda;
    }
  },

  async adicionarItem(isOnline: boolean, idComanda: string, item: any): Promise<ItemComanda> {
    if (isOnline) {
        // 1. Verifica Estoque Online
        const { data: produto } = await supabase.from('produtos').select('estoque').eq('id', item.id_produto).single();
        if (!produto || produto.estoque < item.quantidade) throw new Error("Estoque insuficiente (Online).");

        // 2. LÓGICA DE AGRUPAMENTO (UPSERT)
        // USO DE .maybeSingle() -> Retorna null em vez de erro 406 se não encontrar
        const { data: itemExistente, error: erroBusca } = await supabase
            .from('itens_comanda')
            .select('*')
            .eq('id_comanda', idComanda)
            .eq('id_produto', item.id_produto)
            .maybeSingle();

        if (erroBusca) throw erroBusca;

        let itemFinal;

        if (itemExistente) {
            // SE EXISTE: Atualiza quantidade
            const novaQuantidade = itemExistente.quantidade + item.quantidade;
            const { data, error } = await supabase
                .from('itens_comanda')
                .update({ quantidade: novaQuantidade })
                .eq('id', itemExistente.id)
                .select(`*, produto:produtos(*)`)
                .single();
            
            if (error) throw error;
            itemFinal = data;
            
            await db.itensComanda.update(itemExistente.id, { quantidade: novaQuantidade });
        } else {
            // SE NÃO EXISTE: Cria novo
            const { data, error } = await supabase
              .from('itens_comanda')
              .insert([{ ...item, id_comanda: idComanda }])
              .select(`*, produto:produtos(*)`)
              .single();

            if (error) {
                // Tratamento de Erro Fatal (Comanda não existe)
                if (error.code === '23503') {
                    throw new Error("COMANDA_NAO_ENCONTRADA_FATAL");
                }
                throw error;
            }
            itemFinal = data;
            
            await db.itensComanda.put(data); 
        }

        // 3. Baixa no Estoque
        await supabase.from('produtos').update({ estoque: produto.estoque - item.quantidade }).eq('id', item.id_produto);
        
        return itemFinal;

    } else {
        // --- MODO OFFLINE ---
        const produtoLocal = await db.produtos.get(item.id_produto);
        if (produtoLocal && produtoLocal.estoque < item.quantidade) {
            throw new Error("Estoque insuficiente (Local).");
        }

        const itemLocalExistente = await db.itensComanda
            .where({ id_comanda: idComanda, id_produto: item.id_produto })
            .first();

        if (itemLocalExistente) {
            const novaQtd = itemLocalExistente.quantidade + item.quantidade;
            await db.itensComanda.update(itemLocalExistente.id, { quantidade: novaQtd });
            
            await localDatabaseService.addPendingAction('ATUALIZAR_QTD_ITEM', { 
                id_comanda: idComanda,
                id_item: itemLocalExistente.id, 
                novaQuantidade: novaQtd 
            });

            if (produtoLocal) {
                await db.produtos.update(item.id_produto, { estoque: produtoLocal.estoque - item.quantidade });
            }
            
            return { ...itemLocalExistente, quantidade: novaQtd };
        } else {
            const novoItem = await localDatabaseService.adicionarItem(idComanda, item);
            
            if (produtoLocal) {
                await db.produtos.update(item.id_produto, { estoque: produtoLocal.estoque - item.quantidade });
            }
            return novoItem;
        }
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
       const { data: itemAtual } = await supabase.from('itens_comanda').select('quantidade, id_produto').eq('id', idItem).single();
       
       if (itemAtual) {
           const diferenca = novaQuantidade - itemAtual.quantidade;
           
           await supabase.from('itens_comanda').update({ quantidade: novaQuantidade }).eq('id', idItem);
           
           if (diferenca !== 0) {
              const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', itemAtual.id_produto).single();
              if (prod) {
                  await supabase.from('produtos').update({ estoque: prod.estoque - diferenca }).eq('id', itemAtual.id_produto);
              }
           }
           await db.itensComanda.update(idItem, { quantidade: novaQuantidade });
       }
     } else {
       await localDatabaseService.atualizarQuantidadeItem(idItem, novaQuantidade);
       await localDatabaseService.addPendingAction('ATUALIZAR_QTD_ITEM', { 
           id_item: idItem, 
           id_comanda: _idComanda, 
           novaQuantidade 
       });
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
        // Uso de maybeSingle para evitar erro 406 se não existir
        const { data: comandaAtual, error: erroBusca } = await supabase.from('comandas').select('status').eq('id', idComanda).maybeSingle();
        
        if (erroBusca) throw erroBusca;

        // Se não achou comanda (null)
        if (!comandaAtual) {
             throw new Error("COMANDA_NAO_ENCONTRADA_FATAL");
        }

        if (comandaAtual.status === 'fechada') {
             console.warn(`Comanda ${idComanda} já está fechada. Ignorando.`);
             return; 
        }

        const pagamentosFormatados = pagamentos.map(p => ({ 
            id_comanda: idComanda, 
            metodo: normalizarMetodo(p.metodo),
            valor: p.valor,
            data: dataFinal
        }));

        const { error: erroPag } = await supabase.from('pagamentos').insert(pagamentosFormatados);
        if (erroPag) {
            if (erroPag.code === '23505') {
                 console.warn("Pagamentos já registrados, prosseguindo.");
            } else {
                 throw erroPag;
            }
        }

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