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

// CORREÇÃO CRÍTICA: Vacina Anti-Amnésia. Substitui o ID temporário pelo ID real em TODA A FILA.
const updatePendingActionsId = async (oldId: string, newId: string) => {
    if (!oldId || !newId || oldId === newId) return;
    
    const actions = await db.pending_actions.toArray();
    for (const action of actions) {
        let changed = false;
        let p = JSON.parse(JSON.stringify(action.payload));
        
        const fieldsToCheck = ['idComanda', 'id_comanda', 'idCliente', 'id_cliente', 'idItem', 'id_item', 'id_produto', 'id', 'id_caixa', 'idTemp', 'tempId'];
        
        fieldsToCheck.forEach(field => {
            if (p[field] === oldId) {
                p[field] = newId;
                changed = true;
            }
        });

        if (changed && action.id) {
            await db.pending_actions.update(action.id, { payload: p });
        }
    }
};

const otimizarFila = (actions: PendingAction[]) => {
    const optimized: PendingAction[] = [];
    const updateMap = new Map<string, number>();
    const addMap = new Map<string, number>();

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
        } 
        else if (action.type === 'ADICIONAR_ITEM') {
            const payload = action.payload;
            const key = `${payload.id_comanda}_${payload.id_produto}`;
            
            if (addMap.has(key)) {
                const index = addMap.get(key)!;
                optimized[index].payload.quantidade += Number(payload.quantidade);
            } else {
                const newLength = optimized.push({ ...action, payload: { ...payload, quantidade: Number(payload.quantidade) } });
                addMap.set(key, newLength - 1);
            }
        }
        else {
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
    if (isSyncing) return;

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
            'ABRIR_CAIXA': 1, 
            'CRIAR_CLIENTE': 1, 'ATUALIZAR_CLIENTE': 1,
            'CRIAR_PRODUTO': 1, 'ATUALIZAR_PRODUTO': 1,
            'CRIAR_COMANDA': 2, 'ADICIONAR_ITEM': 3,
            'ATUALIZAR_QTD_ITEM': 4, 'REMOVER_ITEM': 5, 'FECHAR_COMANDA': 6,
            'ATUALIZAR_COMANDA_FIADO': 6,
            'CRIAR_SANGRIA': 6,
            'FECHAR_CAIXA': 7,
            'EXCLUIR_COMANDA': 8
        };
        const pA = priority[a.type] || 99;
        const pB = priority[b.type] || 99;
        return pA - pB || a.criado_em - b.criado_em;
      });

      const pendingActions = otimizarFila(actionsSorted);
      console.log(`SYNC: Processando ${pendingActions.length} ações otimizadas.`);
      
      const idMap: Record<string, string> = {}; 
      const processedActionIds = new Set<number>();
      let successCount = 0;

      for (const action of pendingActions) {
          if (action.id && processedActionIds.has(action.id)) continue;
          if (action.id) processedActionIds.add(action.id);

          const success = await processAction(action, idMap);
          if (success) successCount++;
      }

      if (successCount > 0) {
          addToast(`Sincronização: ${successCount} atualizações enviadas.`, 'success');
          window.dispatchEvent(new Event('sync_completed'));
      }

    } catch (error) {
      console.error('Erro Geral Sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const processAction = async (action: PendingAction, idMap: Record<string, string>): Promise<boolean> => {
    let payload = JSON.parse(JSON.stringify(action.payload));
    let shouldRemoveAction = true; 

    const fieldsToCheck = ['idComanda', 'id_comanda', 'idCliente', 'id_cliente', 'idItem', 'id_item', 'id_produto', 'id', 'id_caixa'];
    fieldsToCheck.forEach(field => {
        if (payload[field] && idMap[payload[field]]) {
            payload[field] = idMap[payload[field]];
        }
    });

    console.log(`SYNC Executando: [${action.type}]`, payload);

    try {
        switch (action.type) {
          case 'ABRIR_CAIXA':
            try {
                const { id: tempId, data_abertura, operador, valor_inicial } = payload.caixa;
                const { data, error } = await supabase.from('caixas').insert([{
                    operador: operador,
                    saldo_inicial: valor_inicial,
                    aberto: true,
                    aberto_em: data_abertura
                }]).select().single();

                if (error) throw error;

                if (data && tempId) {
                    idMap[tempId] = data.id;
                    await updatePendingActionsId(tempId, data.id); // Aplica a vacina
                    
                    const cached = localStorage.getItem('systmix_caixa_aberto');
                    if (cached) {
                        const caixaAberto = JSON.parse(cached);
                        if (caixaAberto.id === tempId) {
                            caixaAberto.id = data.id;
                            localStorage.setItem('systmix_caixa_aberto', JSON.stringify(caixaAberto));
                        }
                    }
                }
            } catch (err) { shouldRemoveAction = false; }
            break;

          case 'CRIAR_SANGRIA':
            const idCaixaSangria = payload.id_caixa;
            if (idCaixaSangria && String(idCaixaSangria).startsWith('local_')) {
                shouldRemoveAction = false;
                break;
            }
            try {
                const { id: tempIdSangria, id_caixa, valor, motivo, data } = payload;
                const { error } = await supabase.from('movimentacoes_caixa').insert([{
                    id_caixa: id_caixa, tipo: 'sangria', valor: valor, motivo: motivo, data: data 
                }]);
                if (error) throw error;
                if (tempIdSangria) await db.sangrias.delete(tempIdSangria).catch(() => {});
            } catch (err) { shouldRemoveAction = false; }
            break;

          case 'FECHAR_CAIXA':
            if (payload.id && !String(payload.id).startsWith('local_')) {
                try {
                    const { error } = await supabase.from('caixas').update({
                        aberto: false, fechado_em: payload.fechado_em, saldo_atual: payload.saldoFinal,
                    }).eq('id', payload.id);
                    if (error) throw error;
                } catch (e) { shouldRemoveAction = false; }
            } else { shouldRemoveAction = false; }
            break;

          case 'CRIAR_CLIENTE':
            try {
                const { id: tempId, criado_em, ...dados } = payload.cliente;
                const novo = await clientesService.criar(true, dados);
                if (novo.id && String(novo.id).startsWith('local_')) {
                    shouldRemoveAction = false;
                    await db.clientes.delete(novo.id).catch(() => {});
                } else if (novo && tempId) {
                    idMap[tempId] = novo.id;
                    await updatePendingActionsId(tempId, novo.id); // Aplica a vacina
                    await db.clientes.delete(tempId).catch(() => {});
                }
            } catch (err) { shouldRemoveAction = false; }
            break;

          case 'ATUALIZAR_CLIENTE':
            if (payload.id && !String(payload.id).startsWith('local_')) {
                try { await clientesService.atualizar(true, payload.id, payload.cliente); } catch (e) { shouldRemoveAction = false; }
            } else { shouldRemoveAction = false; }
            break;

          case 'CRIAR_PRODUTO':
            try {
                const { id: tempId, criado_em, ...dados } = payload.produto;
                const novo = await produtosService.criar(true, dados);
                if (novo.id && String(novo.id).startsWith('local_')) {
                    shouldRemoveAction = false;
                    await db.produtos.delete(novo.id).catch(() => {});
                } else if (novo && tempId) {
                    idMap[tempId] = novo.id;
                    await updatePendingActionsId(tempId, novo.id); // Aplica a vacina
                    await db.produtos.delete(tempId).catch(() => {});
                }
            } catch (err) { shouldRemoveAction = false; }
            break;

          case 'ATUALIZAR_PRODUTO':
            if (payload.id && !String(payload.id).startsWith('local_')) {
                try { await produtosService.atualizar(true, payload.id, payload.produto); } catch (e) { shouldRemoveAction = false; }
            } else { shouldRemoveAction = false; }
            break;

          case 'CRIAR_COMANDA':
            const idCli = payload.id_cliente || payload.idCliente;
            const tempIdCom = payload.idTemp || payload.tempId;

            if (idCli && String(idCli).startsWith('local_')) {
                shouldRemoveAction = false;
                break;
            }

            try {
                const nova = await comandasService.criarComanda(true, payload.numero, idCli);
                if (nova.id && !String(nova.id).startsWith('local_')) {
                    if (tempIdCom) {
                        idMap[tempIdCom] = nova.id;
                        await updatePendingActionsId(tempIdCom, nova.id); // Vacina Anti-Amnésia garante o fechamento!
                        await db.comandas.delete(tempIdCom).catch(() => {});
                    }
                    shouldRemoveAction = true;
                } else if (nova && tempIdCom) {
                    idMap[tempIdCom] = nova.id;
                    shouldRemoveAction = false;
                }
            } catch (err) { shouldRemoveAction = false; }
            break;

          case 'ADICIONAR_ITEM':
            const idComanda = payload.id_comanda || payload.idComanda;
            if (idComanda && String(idComanda).startsWith('local_')) {
                shouldRemoveAction = false;
                break;
            }

            if (idComanda) {
                try {
                    const item = await comandasService.adicionarItem(true, idComanda, {
                        id_produto: payload.id_produto,
                        quantidade: Number(payload.quantidade),
                        valor_unit: Number(payload.valor_unit)
                    });

                    if (item.id && String(item.id).startsWith('local_')) {
                        await db.itensComanda.delete(item.id).catch(() => {});
                        shouldRemoveAction = false;
                    } else {
                        const tempIdItem = payload.id;
                        if (tempIdItem && String(tempIdItem).startsWith('local_')) {
                            idMap[tempIdItem] = item.id;
                            await updatePendingActionsId(tempIdItem, item.id); // Aplica a vacina
                            await db.itensComanda.delete(tempIdItem).catch(() => {});
                        }
                    }
                } catch (err: any) {
                    if (err.message === "COMANDA_NAO_ENCONTRADA_FATAL") shouldRemoveAction = true;
                    else shouldRemoveAction = false;
                }
            } else { shouldRemoveAction = true; }
            break;

          case 'ATUALIZAR_QTD_ITEM':
             if (payload.id_item && !String(payload.id_item).startsWith('local_')) {
                 try { await comandasService.atualizarQuantidadeItem(true, payload.id_comanda, payload.id_item, Number(payload.quantidade)); } catch (e) { shouldRemoveAction = false; }
             } else { shouldRemoveAction = false; }
             break;

          case 'REMOVER_ITEM':
             if (payload.id_item && String(payload.id_item).startsWith('local_')) {
                 shouldRemoveAction = true; 
             } else if (payload.id_item) {
                 await comandasService.removerItem(true, payload.id_comanda || '', payload.id_item).catch(() => {});
             }
             break;

          case 'FECHAR_COMANDA':
             if (payload.idComanda && !String(payload.idComanda).startsWith('local_')) {
                 try { await comandasService.fecharComanda(true, payload.idComanda, payload.pagamentos, payload.dataFechamento); } catch (e) { shouldRemoveAction = false; }
             } else { shouldRemoveAction = false; }
             break;
             
          case 'ATUALIZAR_COMANDA_FIADO':
             if (payload.id && !String(payload.id).startsWith('local_')) {
                 try {
                     const { error } = await supabase.from('comandas').update({ status: 'fiado', fechado_em: payload.fechado_em }).eq('id', payload.id);
                     if (error) throw error;
                 } catch (e) { shouldRemoveAction = false; }
             } else { shouldRemoveAction = false; }
             break;

          case 'EXCLUIR_COMANDA':
             if (payload.id && !String(payload.id).startsWith('local_')) {
                 try {
                     await supabase.from('pagamentos').delete().eq('id_comanda', payload.id);
                     await supabase.from('itens_comanda').delete().eq('id_comanda', payload.id);
                     const { error } = await supabase.from('comandas').delete().eq('id', payload.id);
                     if (error) throw error;
                 } catch (e) { shouldRemoveAction = false; }
             } else { shouldRemoveAction = true; } 
             break;
        }
    } catch (e) {
        console.error(`SYNC Fatal: ${action.type}`, e);
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
        return true;
    }
    return false;
  };

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isOnline) return;
    timeoutRef.current = setTimeout(processSyncQueue, 2000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [isOnline]);

  return <SyncContext.Provider value={{ isSyncing }}>{children}</SyncContext.Provider>;
};

export function useSync() { return useContext(SyncContext); }