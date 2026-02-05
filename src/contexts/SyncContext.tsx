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

// --- FUNÇÃO PARA OTIMIZAR A FILA ---
const otimizarFila = (actions: PendingAction[]) => {
    const optimized: PendingAction[] = [];
    const updateMap = new Map<string, number>();

    for (const action of actions) {
        if (action.type === 'ATUALIZAR_QTD_ITEM') {
            const payload = action.payload;
            const idItem = payload.id_item || payload.idItem;
            const novaQtd = payload.quantidade !== undefined ? payload.quantidade : payload.novaQuantidade;
            
            if (idItem && updateMap.has(idItem)) {
                const index = updateMap.get(idItem)!;
                optimized[index].payload.quantidade = novaQtd;
            } else {
                const newLength = optimized.push({ ...action, payload: { ...payload, quantidade: novaQtd } });
                updateMap.set(idItem, newLength - 1);
            }
        } else {
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
    if ('locks' in navigator) {
        await navigator.locks.request('systmix-sync-process', { ifAvailable: true }, async (lock) => {
            if (!lock) return; 
            await executeSyncLogic();
        });
    } else {
        await executeSyncLogic();
    }
  };

  const executeSyncLogic = async () => {
    try {
      setIsSyncing(true);
      await new Promise(resolve => setTimeout(resolve, 500));

      const rawActions = await localDatabaseService.getPendingActions();
      
      if (rawActions.length === 0) {
          setIsSyncing(false);
          return;
      }

      const actionsSorted = rawActions.sort((a, b) => {
        const priority: Record<string, number> = { 
            'CRIAR_CLIENTE': 1, 'ATUALIZAR_CLIENTE': 1,
            'CRIAR_PRODUTO': 1, 'ATUALIZAR_PRODUTO': 1,
            'CRIAR_COMANDA': 2, 'ADICIONAR_ITEM': 3,
            'ATUALIZAR_QTD_ITEM': 4, 'FECHAR_COMANDA': 5
        };
        const pA = priority[a.type] || 99;
        const pB = priority[b.type] || 99;
        return pA - pB || a.criado_em - b.criado_em;
      });

      const pendingActions = otimizarFila(actionsSorted);
      console.log(`SYNC: Iniciando processamento de ${pendingActions.length} ações.`);
      
      const idMap: Record<string, string> = {}; 
      const processedActionIds = new Set<number>();

      for (const action of pendingActions) {
          if (action.id && processedActionIds.has(action.id)) continue;
          if (action.id) processedActionIds.add(action.id);

          try {
             await processAction(action, idMap);
          } catch (itemError) {
             console.error(`SYNC: Erro no item ${action.type}:`, itemError);
          }
      }

      if (pendingActions.length > 0) {
          addToast('Sincronização concluída.', 'success');
          
          // 🔥 NOVO: Dispara evento para atualizar a UI automaticamente
          window.dispatchEvent(new Event('sync_completed'));
      }

    } catch (error) {
      console.error('Erro Geral Sync Loop:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const processAction = async (action: PendingAction, idMap: Record<string, string>) => {
    let payload = JSON.parse(JSON.stringify(action.payload));
    let shouldRemoveAction = true; 

    // Tradução de IDs
    const fieldsToCheck = ['idComanda', 'id_comanda', 'idCliente', 'id_cliente', 'idItem', 'id_item', 'id_produto', 'id'];
    fieldsToCheck.forEach(field => {
        if (payload[field] && idMap[payload[field]]) {
            payload[field] = idMap[payload[field]];
        }
    });

    console.log(`SYNC Executando: [${action.type}]`, payload);

    try {
        switch (action.type) {
          case 'CRIAR_CLIENTE':
            try {
                const { id: tempId, criado_em, ...dadosCliente } = payload.cliente;
                const novoCliente = await clientesService.criar(true, dadosCliente);
                if (novoCliente && tempId) {
                    idMap[tempId] = novoCliente.id;
                    await db.clientes.delete(tempId).catch(() => {});
                }
            } catch (err) {
                console.error("Erro sync cliente:", err);
                shouldRemoveAction = false; 
            }
            break;

          // ✅ NOVO: Case que faltava para atualizar clientes
          case 'ATUALIZAR_CLIENTE':
            const idCliUp = payload.id;
            if (idCliUp && !String(idCliUp).startsWith('local_')) {
                try {
                    await clientesService.atualizar(true, idCliUp, payload.cliente);
                } catch (e) {
                    console.error("Erro sync update cliente:", e);
                    shouldRemoveAction = false; 
                }
            } else {
                shouldRemoveAction = false; 
            }
            break;

          case 'CRIAR_PRODUTO':
            try {
                const { id: tempId, criado_em, ...dadosProd } = payload.produto;
                const novoProd = await produtosService.criar(true, dadosProd);
                if (novoProd && tempId) {
                    idMap[tempId] = novoProd.id;
                    await db.produtos.delete(tempId).catch(() => {});
                }
            } catch (err) {
                console.error("Erro sync produto:", err);
                shouldRemoveAction = false;
            }
            break;
            
          case 'ATUALIZAR_PRODUTO':
            const idProdUp = payload.id;
            if (idProdUp && !String(idProdUp).startsWith('local_')) {
                try {
                    await produtosService.atualizar(true, idProdUp, payload.produto);
                } catch (e) {
                    console.error("Erro sync update produto:", e);
                    shouldRemoveAction = false; 
                }
            } else {
                shouldRemoveAction = false; 
            }
            break;

          case 'CRIAR_COMANDA':
            const idCliFinal = payload.id_cliente || payload.idCliente;
            const tempIdComanda = payload.idTemp || payload.tempId;

            if (idCliFinal && String(idCliFinal).startsWith('local_')) {
                console.warn(`SYNC: Adiado Comanda ${payload.numero} - Cliente local.`);
                shouldRemoveAction = false;
                break;
            }

            try {
                const novaComanda = await comandasService.criarComanda(true, payload.numero, idCliFinal);
                if (novaComanda && tempIdComanda) {
                    idMap[tempIdComanda] = novaComanda.id;
                    await db.comandas.delete(tempIdComanda).catch(() => {});
                }
            } catch (err: any) {
                if (err.code === '23505' || err.message?.includes('duplicate key') || err.status === 409) {
                    const { data: existente } = await supabase
                        .from('comandas')
                        .select('id, id_cliente')
                        .eq('numero', payload.numero)
                        .eq('status', 'aberta')
                        .maybeSingle();
                        
                    if (existente) {
                        if (tempIdComanda) idMap[tempIdComanda] = existente.id;
                        if (!existente.id_cliente && idCliFinal && !String(idCliFinal).startsWith('local_')) {
                            await supabase.from('comandas').update({ id_cliente: idCliFinal }).eq('id', existente.id);
                        }
                        if (tempIdComanda) await db.comandas.delete(tempIdComanda).catch(() => {});
                    } else {
                       shouldRemoveAction = false; 
                    }
                } else {
                    shouldRemoveAction = false;
                    console.error("Erro ao criar comanda sync:", err);
                }
            }
            break;

          case 'ADICIONAR_ITEM':
            const idComandaReal = payload.id_comanda || payload.idComanda;
            if (idComandaReal && String(idComandaReal).startsWith('local_')) {
                shouldRemoveAction = false;
                break;
            }

            if (idComandaReal) {
                try {
                    const itemSalvo = await comandasService.adicionarItem(true, idComandaReal, {
                        id_produto: payload.id_produto,
                        quantidade: Number(payload.quantidade),
                        valor_unit: Number(payload.valor_unit)
                    });
                    const tempIdItem = payload.id;
                    if (tempIdItem && String(tempIdItem).startsWith('local_')) {
                        idMap[tempIdItem] = itemSalvo.id;
                        await db.itensComanda.delete(tempIdItem).catch(() => {});
                    }
                } catch (err: any) {
                    if (err.message === "COMANDA_NAO_ENCONTRADA_FATAL") shouldRemoveAction = true;
                    else {
                        console.error("Erro sync item:", err);
                        shouldRemoveAction = false;
                    }
                }
            }
            break;

          case 'ATUALIZAR_QTD_ITEM':
            const idItemUp = payload.id_item || payload.idItem;
            const idComandaUp = payload.id_comanda || payload.idComanda; 

            if (idItemUp && !String(idItemUp).startsWith('local_')) {
                try {
                    await comandasService.atualizarQuantidadeItem(true, idComandaUp, idItemUp, Number(payload.quantidade));
                } catch (e) {
                    console.error("Erro update qtd:", e);
                    shouldRemoveAction = false; 
                }
            } else {
                shouldRemoveAction = false; 
            }
            break;
            
          case 'REMOVER_ITEM':
             const idItemRem = payload.idItem || payload.id_item;
             const idComandaRem = payload.idComanda || payload.id_comanda;
             
             if (idItemRem && String(idItemRem).startsWith('local_')) {
                 shouldRemoveAction = true;
                 break;
             }
             if (idItemRem && idComandaRem) {
                 await comandasService.removerItem(true, idComandaRem, idItemRem).catch(() => {});
             }
             break;

          case 'FECHAR_COMANDA':
             const idComandaFechar = payload.idComanda || payload.id_comanda;
             if (idComandaFechar && !String(idComandaFechar).startsWith('local_')) {
                try {
                    await comandasService.fecharComanda(true, idComandaFechar, payload.pagamentos, payload.dataFechamento);
                } catch (err) {
                    console.error("Erro ao fechar comanda sync:", err);
                    shouldRemoveAction = false;
                }
             } else {
                 shouldRemoveAction = false;
             }
            break;
        }
    } catch (e) {
        console.error(`SYNC: Erro fatal ao processar ${action.type}:`, e);
        shouldRemoveAction = false;
    }

    if (shouldRemoveAction && action.id) {
        await localDatabaseService.removePendingAction(action.id);
        
        if (action.type === 'ATUALIZAR_QTD_ITEM') {
            const idItem = payload.id_item || payload.idItem;
            const staleActions = await db.pending_actions
                .where('type').equals('ATUALIZAR_QTD_ITEM')
                .filter(a => {
                    const p = a.payload;
                    const pId = p.id_item || p.idItem;
                    return pId === idItem && a.id !== action.id;
                }).toArray();
            
            for (const stale of staleActions) {
                 if (stale.id) await localDatabaseService.removePendingAction(stale.id);
            }
        }
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