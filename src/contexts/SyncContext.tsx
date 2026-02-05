// src/contexts/SyncContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { localDatabaseService, db, PendingAction } from '../lib/localDatabase';
import { useToast } from './ToastContext';
import { comandasService } from '../services/comandas';
import { clientesService } from '../services/clientes';
import { produtosService } from '../services/produtos';
import { supabase } from '../lib/supabaseClient';

interface SyncContextData {
  isSyncing: boolean; 
}

const SyncContext = createContext<SyncContextData>({} as SyncContextData);

let isGlobalSyncingLocked = false;

// --- FUNÇÃO PARA OTIMIZAR A FILA (Fundir ações repetidas) ---
const otimizarFila = (actions: PendingAction[]) => {
    const optimized: PendingAction[] = [];
    const updateMap = new Map<string, number>(); // id_item -> indice no array optimized

    for (const action of actions) {
        // Se for atualização de quantidade, tenta fundir com a anterior
        if (action.type === 'ATUALIZAR_QTD_ITEM') {
            const idItem = action.payload.id_item || action.payload.idItem;
            
            if (idItem && updateMap.has(idItem)) {
                // Já existe uma atualização para esse item na fila, ATUALIZAMOS ela para a mais recente
                const index = updateMap.get(idItem)!;
                // Atualiza a quantidade da ação existente para a nova (mais recente)
                optimized[index].payload.quantidade = action.payload.quantidade || action.payload.novaQuantidade;
                optimized[index].payload.novaQuantidade = action.payload.quantidade || action.payload.novaQuantidade;
                
                // Também atualizamos o ID da ação original para marcar como processada depois
                // (Opcional, mas mantém a referência)
            } else {
                // Nova atualização
                const newLength = optimized.push(action);
                updateMap.set(idItem, newLength - 1);
            }
        } else {
            // Outras ações passam direto
            optimized.push(action);
        }
    }
    return optimized;
};

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processSyncQueue = async () => {
    if (isGlobalSyncingLocked) return;

    try {
      isGlobalSyncingLocked = true;
      setIsSyncing(true);
      
      await new Promise(resolve => setTimeout(resolve, 500));

      // 1. Busca e Ordena por Prioridade
      const rawActions = (await localDatabaseService.getPendingActions()).sort((a, b) => {
        const priority = { 
            'CRIAR_CLIENTE': 1, 'CRIAR_PRODUTO': 1, 
            'CRIAR_COMANDA': 2, 'ADICIONAR_ITEM': 3,
            'ATUALIZAR_QTD_ITEM': 4 
        };
        const pA = priority[a.type as keyof typeof priority] || 99;
        const pB = priority[b.type as keyof typeof priority] || 99;
        return pA - pB || a.criado_em - b.criado_em;
      });
      
      if (rawActions.length === 0) return;

      // 2. Otimiza a fila (Remove atualizações redundantes)
      const pendingActions = otimizarFila(rawActions);

      addToast(`Sincronizando ${pendingActions.length} ações...`, 'success');

      const idMap: Record<string, string> = {};
      // Set para não processar a mesma ação (pelo ID do banco local) duas vezes se houver duplicidade
      const processedActionIds = new Set<number>();

      for (const action of pendingActions) {
          if (action.id && processedActionIds.has(action.id)) continue;
          if (action.id) processedActionIds.add(action.id);

          try {
            let payload = JSON.parse(JSON.stringify(action.payload));
            let shouldRemoveAction = true; 

            // --- TRADUÇÃO DE IDS ---
            if (payload.id_comanda && idMap[payload.id_comanda]) payload.id_comanda = idMap[payload.id_comanda];
            if (payload.idComanda && idMap[payload.idComanda]) payload.idComanda = idMap[payload.idComanda];
            if (payload.idCliente && idMap[payload.idCliente]) payload.idCliente = idMap[payload.idCliente];
            if (payload.id_cliente && idMap[payload.id_cliente]) payload.id_cliente = idMap[payload.id_cliente];
            if (payload.idItem && idMap[payload.idItem]) payload.idItem = idMap[payload.idItem];
            if (payload.id_item && idMap[payload.id_item]) payload.id_item = idMap[payload.id_item];
            if (payload.id_produto && idMap[payload.id_produto]) payload.id_produto = idMap[payload.id_produto];

            console.log(`SYNC: Executando ${action.type}`, payload);

            switch (action.type) {
              case 'CRIAR_CLIENTE':
                try {
                    const { id: tempIdCli, criado_em: _x, ...clienteLimpo } = payload.cliente;
                    if (tempIdCli) {
                        const existeLocal = await db.clientes.get(tempIdCli);
                        if (!existeLocal) break; 
                    }
                    const novoCliente: any = await clientesService.criar(true, clienteLimpo);
                    if (novoCliente && tempIdCli) {
                        idMap[tempIdCli] = novoCliente.id;
                        await db.clientes.delete(tempIdCli); 
                    }
                } catch (err) {
                    console.error("Erro sync cliente:", err);
                    throw err; 
                }
                break;

              case 'CRIAR_PRODUTO':
                try {
                    const { id: tempIdProd, criado_em: _y, ...prodLimpo } = payload.produto;
                    if (tempIdProd) {
                        const existeLocal = await db.produtos.get(tempIdProd);
                        if (!existeLocal) break;
                    }
                    const novoProd = await produtosService.criar(true, prodLimpo);
                    if (novoProd && tempIdProd) {
                        idMap[tempIdProd] = novoProd.id;
                        await db.produtos.delete(tempIdProd);
                    }
                } catch (err) {
                    console.error("Erro sync produto:", err);
                    throw err;
                }
                break;

              case 'CRIAR_COMANDA':
                // CORREÇÃO: Aceita payload.idCliente OU payload.id_cliente (padrão do banco local)
                const rawIdCliente = payload.idCliente || payload.id_cliente;
                const idClienteFinal = idMap[rawIdCliente] || (rawIdCliente?.toString().startsWith('local_') ? null : rawIdCliente);
                
                const tempIdComanda = payload.tempId || payload.idTemp; 

                try {
                    const novaComanda = await comandasService.criarComanda(true, payload.numero, idClienteFinal);
                    if (novaComanda && tempIdComanda) {
                        idMap[tempIdComanda] = novaComanda.id;
                        await db.comandas.delete(tempIdComanda);
                    }
                } catch (err: any) {
                    if (err.code === '23505' || err.message?.includes('duplicate key') || err.status === 409) {
                        console.warn(`SYNC: Comanda ${payload.numero} já existe. Recuperando...`);
                        const { data: existente } = await supabase.from('comandas').select('*').eq('numero', payload.numero).eq('status', 'aberta').maybeSingle();
                        if (existente) {
                            if (tempIdComanda) idMap[tempIdComanda] = existente.id;
                            // Verifica se precisa vincular cliente
                            if (!existente.id_cliente && idClienteFinal && !idClienteFinal.toString().startsWith('local_')) {
                                await supabase.from('comandas').update({ id_cliente: idClienteFinal }).eq('id', existente.id);
                            }
                            if (tempIdComanda) await db.comandas.delete(tempIdComanda);
                        } else {
                            console.warn("Conflito de comanda fantasma. Removendo.");
                        }
                    } else {
                        throw err;
                    }
                }
                break;

              case 'ADICIONAR_ITEM':
                const idComandaReal = idMap[payload.id_comanda] || payload.id_comanda || idMap[payload.idComanda] || payload.idComanda;
                const idProdutoReal = idMap[payload.id_produto] || payload.id_produto;

                if (idProdutoReal && idProdutoReal.toString().startsWith('local_')) {
                    console.warn(`SYNC: Item adiado. Produto ${idProdutoReal} ainda não sincronizou.`);
                    shouldRemoveAction = false; 
                    break;
                }

                if (idComandaReal && !idComandaReal.toString().startsWith('local_')) {
                    const itemSanitizado = {
                        id_produto: idProdutoReal,
                        quantidade: Number(payload.quantidade),
                        valor_unit: Number(payload.valor_unit)
                    };
                    try {
                        const itemSalvo = await comandasService.adicionarItem(true, idComandaReal, itemSanitizado);
                        
                        const tempIdItem = payload.id;
                        if (tempIdItem && tempIdItem.toString().startsWith('local_')) {
                            // 🔥 CORREÇÃO IMPORTANTE: Mapear o ID do item
                            idMap[tempIdItem] = itemSalvo.id;
                            await db.itensComanda.delete(tempIdItem);
                        }
                    } catch (err: any) {
                         if (err.message === "COMANDA_NAO_ENCONTRADA_FATAL" || err.code === '23503') shouldRemoveAction = true;
                         else throw err;
                    }
                } else shouldRemoveAction = false; 
                break;
                
              case 'REMOVER_ITEM':
                try {
                    const idIR = idMap[payload.idItem] || payload.idItem;
                    const idCR = idMap[payload.idComanda] || payload.idComanda;
                    if (idIR && !idIR.toString().startsWith('local_') && idCR && !idCR.toString().startsWith('local_')) {
                       await comandasService.removerItem(true, idCR, idIR);
                    }
                } catch (e) { console.warn("Item ja removido", e); }
                break;

              case 'ATUALIZAR_QTD_ITEM':
                const idItemAtualizar = idMap[payload.id_item] || payload.id_item;
                // 🔥 CORREÇÃO: Aceita 'quantidade' OU 'novaQuantidade'
                const qtdFinal = payload.quantidade || payload.novaQuantidade;

                if (idItemAtualizar && !idItemAtualizar.toString().startsWith('local_')) {
                    await comandasService.atualizarQuantidadeItem(true, "", idItemAtualizar, Number(qtdFinal));
                } else {
                    shouldRemoveAction = false; 
                }
                break;

              case 'FECHAR_COMANDA':
                 const idComandaFechar = idMap[payload.idComanda] || payload.idComanda || idMap[payload.id_comanda] || payload.id_comanda;
                 if (idComandaFechar && !idComandaFechar.toString().startsWith('local_')) {
                    try {
                        await comandasService.fecharComanda(true, idComandaFechar, payload.pagamentos, payload.dataFechamento);
                    } catch (err: any) {
                         if (err.message === "COMANDA_NAO_ENCONTRADA_FATAL" || err.code === '23503' || (err as any).status === 409) shouldRemoveAction = true;
                         else throw err;
                    }
                 } else shouldRemoveAction = false;
                break;
                
              case 'ATUALIZAR_CLIENTE':
                 const realIdCli = idMap[payload.id] || payload.id;
                 if (realIdCli && !realIdCli.toString().startsWith('local_')) {
                    const { id: _ig, criado_em: _ig2, ...dadosCli } = payload.cliente;
                    await clientesService.atualizar(true, realIdCli, dadosCli);
                 } else shouldRemoveAction = false;
                break;

              case 'DELETAR_CLIENTE':
                 const delId = idMap[payload.id] || payload.id;
                 if (delId && !delId.toString().startsWith('local_')) await clientesService.excluir(true, delId);
                break;

               case 'ATUALIZAR_PRODUTO':
                const idProdUp = idMap[payload.id] || payload.id;
                if (idProdUp && !idProdUp.toString().startsWith('local_')) {
                    const { id: _upPId, criado_em: _upPCr, ...prodUp } = payload.produto;
                    await produtosService.atualizar(true, idProdUp, prodUp);
                } else shouldRemoveAction = false;
                break;
                
                case 'MOVIMENTACAO_CAIXA':
                 if (payload.idCaixa && !payload.idCaixa.startsWith('local_')) {
                    await supabase.from('caixas').update({ saldo_atual: payload.novoSaldo }).eq('id', payload.idCaixa);
                 }
                 break;
                 
                 case 'DELETAR_COMANDA':
                 const idComandaDel = idMap[payload.id] || payload.id;
                 if (idComandaDel && !idComandaDel.toString().startsWith('local_')) {
                     await comandasService.excluir(true, idComandaDel);
                 }
                break;
            }

            // Remove a ação do banco local se foi processada
            // Se foi otimizada (ex: 10 atualizações viraram 1), todas as originais devem ser removidas
            // A nossa lógica percorre a lista otimizada, mas precisamos limpar o lixo.
            // Para simplificar: Removemos a ação atual. Se houver outras ações originais que foram engolidas
            // pela otimização, elas serão removidas na próxima passada (já que não estarão na lista optimized mas estarão no banco?)
            // NÃO. Precisamos limpar as ações que foram "comprimidas".
            
            // SIMPLIFICAÇÃO: Removemos pelo ID da ação que acabamos de rodar.
            // As ações intermediárias (que foram puladas na otimização) vão ficar no banco?
            // Sim, isso é um problema da otimização visual.
            // CORREÇÃO: Vamos limpar TODAS as ações raw que compõem esta ação otimizada?
            // Para não complicar: O loop roda nas "optimized".
            // Vamos deletar do banco apenas se shouldRemoveAction.
            
            if (shouldRemoveAction && action.id) {
                await localDatabaseService.removePendingAction(action.id);
            }
            
            // LIMPEZA DE AÇÕES REDUNDANTES (HACK SEGURO)
            // Se processamos uma atualização de quantidade com sucesso, podemos deletar TODAS as
            // atualizações de quantidade anteriores para este mesmo item que tenham ID menor.
            if (action.type === 'ATUALIZAR_QTD_ITEM' && shouldRemoveAction) {
                const idItem = payload.id_item || payload.idItem;
                // Deleta todas as ações de update deste item que sejam mais antigas que a atual
                const allActions = await db.pending_actions
                    .where('type').equals('ATUALIZAR_QTD_ITEM')
                    .and(a => {
                        const p = a.payload;
                        const tId = p.id_item || p.idItem;
                        return tId === idItem && a.id! <= action.id!;
                    }).toArray();
                    
                 for (const oldAction of allActions) {
                     if (oldAction.id) await localDatabaseService.removePendingAction(oldAction.id);
                 }
            }
            
          } catch (syncError: any) {
            console.error(`SYNC ERRO [${action.type}]:`, syncError);
          }
      }
      addToast('Sincronização concluída!', 'success');

    } catch (error) {
      console.error('Erro Geral Sync:', error);
    } finally {
      setIsSyncing(false);
      isGlobalSyncingLocked = false;
    }
  };

  useEffect(() => {
    if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
    }
    if (!isOnline) return;
    
    timeoutRef.current = setTimeout(() => {
        processSyncQueue();
    }, 2000);

    return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOnline]); 

  return (
    <SyncContext.Provider value={{ isSyncing }}>
      {children}
    </SyncContext.Provider>
  );
};

export function useSync(): SyncContextData {
  return useContext(SyncContext);
}