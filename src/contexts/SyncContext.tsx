// src/contexts/SyncContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { localDatabaseService, db } from '../lib/localDatabase';
import { useToast } from './ToastContext';
import { comandasService } from '../services/comandas';
import { clientesService } from '../services/clientes';
import { produtosService } from '../services/produtos';
import { supabase } from '../lib/supabaseClient';

interface SyncContextData {
  isSyncing: boolean; 
}

const SyncContext = createContext<SyncContextData>({} as SyncContextData);

// --- TRAVA GLOBAL (Fora do Componente) ---
// Isso garante que apenas UM processo de sync rode na aplicação inteira,
// independente de quantos Providers existam ou do StrictMode.
let isGlobalSyncingLocked = false;

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processSyncQueue = async () => {
    // Verifica a trava global
    if (isGlobalSyncingLocked) {
        console.log('SYNC: Tentativa de execução paralela bloqueada pelo Global Lock.');
        return;
    }

    try {
      // Ativa a trava global
      isGlobalSyncingLocked = true;
      setIsSyncing(true);
      
      console.log('SYNC: Iniciando varredura (Global Lock Ativo)...'); 

      // Pequeno delay para garantir estabilidade
      await new Promise(resolve => setTimeout(resolve, 500));

      const pendingActions = await localDatabaseService.getPendingActions();
      
      if (pendingActions.length === 0) {
        return;
      }

      addToast(`Sincronizando ${pendingActions.length} ações pendentes...`, 'error');

      const idMap: Record<string, string> = {};
      const processedThisBatch = new Set<number>();

      for (const action of pendingActions) {
          // Proteção contra duplicidade de ID no mesmo lote
          if (action.id && processedThisBatch.has(action.id)) continue;
          if (action.id) processedThisBatch.add(action.id);

          try {
            let payload = JSON.parse(JSON.stringify(action.payload));

            // --- TRADUÇÃO DE IDS ---
            if (payload.id_comanda && idMap[payload.id_comanda]) payload.id_comanda = idMap[payload.id_comanda];
            if (payload.idComanda && idMap[payload.idComanda]) payload.idComanda = idMap[payload.idComanda];
            if (payload.idCliente && idMap[payload.idCliente]) payload.idCliente = idMap[payload.idCliente];
            if (payload.id_cliente && idMap[payload.id_cliente]) payload.id_cliente = idMap[payload.id_cliente];
            if (payload.idItem && idMap[payload.idItem]) payload.idItem = idMap[payload.idItem];
            if (payload.id_item && idMap[payload.id_item]) payload.id_item = idMap[payload.id_item];

            console.log(`SYNC: Executando ${action.type}`, payload);
            
            let shouldRemoveAction = true; 

            switch (action.type) {
              case 'CRIAR_CLIENTE':
                try {
                    const { id: _idCli, criado_em: _cEmCli, ...clienteLimpo } = payload.cliente;
                    const novoCliente: any = await clientesService.criar(true, clienteLimpo);
                    const tempIdCliente = payload.tempId || payload.idTemp;
                    if (novoCliente && tempIdCliente) {
                        idMap[tempIdCliente] = novoCliente.id;
                        await db.clientes.delete(tempIdCliente); 
                    }
                } catch (err: any) {
                    console.error("Erro sync cliente:", err);
                    throw err; 
                }
                break;

              case 'CRIAR_COMANDA':
                const idClienteFinal = idMap[payload.idCliente] || (payload.idCliente?.toString().startsWith('local_') ? null : payload.idCliente);
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
                const idComandaReal = payload.id_comanda || payload.idComanda;
                if (idComandaReal && !idComandaReal.toString().startsWith('local_')) {
                    const itemSanitizado = {
                        id_produto: payload.id_produto,
                        quantidade: Number(payload.quantidade),
                        valor_unit: Number(payload.valor_unit)
                    };
                    try {
                        const itemSalvo = await comandasService.adicionarItem(true, idComandaReal, itemSanitizado);
                        if (payload.id && payload.id.toString().startsWith('local_')) {
                            idMap[payload.id] = itemSalvo.id;
                            await db.itensComanda.delete(payload.id);
                        }
                    } catch (err: any) {
                        if (err.message === "COMANDA_NAO_ENCONTRADA_FATAL" || err.code === '23503') {
                            shouldRemoveAction = true;
                        } else {
                            throw err;
                        }
                    }
                } else {
                    shouldRemoveAction = false; 
                }
                break;
                
              case 'REMOVER_ITEM':
                try {
                    const idIR = idMap[payload.idItem] || payload.idItem;
                    const idCR = idMap[payload.idComanda] || payload.idComanda;
                    if (!idIR.toString().startsWith('local_')) {
                       await comandasService.removerItem(true, idCR, idIR);
                    }
                } catch (e) { console.warn("Item ja removido", e); }
                break;

              case 'ATUALIZAR_QTD_ITEM':
                const idItemAtualizar = idMap[payload.id_item] || payload.id_item;
                if (idItemAtualizar && !idItemAtualizar.toString().startsWith('local_')) {
                    await comandasService.atualizarQuantidadeItem(true, "", idItemAtualizar, payload.novaQuantidade);
                } else {
                    console.warn(`SYNC: Update QTD adiado (Item local).`);
                }
                break;

              case 'FECHAR_COMANDA':
                 const idComandaFechar = payload.idComanda || payload.id_comanda;
                 if (idComandaFechar && !idComandaFechar.toString().startsWith('local_')) {
                    try {
                        await comandasService.fecharComanda(true, idComandaFechar, payload.pagamentos, payload.dataFechamento);
                    } catch (err: any) {
                        if (err.message === "COMANDA_NAO_ENCONTRADA_FATAL" || err.code === '23503' || (err as any).status === 409) {
                            shouldRemoveAction = true;
                        } else {
                            throw err;
                        }
                    }
                 } else {
                    shouldRemoveAction = false;
                 }
                break;
              
              case 'MOVIMENTACAO_CAIXA':
                 if (payload.idCaixa && !payload.idCaixa.startsWith('local_')) {
                    await supabase.from('caixas').update({ saldo_atual: payload.novoSaldo }).eq('id', payload.idCaixa);
                 }
                 break;

              case 'ATUALIZAR_CLIENTE':
                 // ...logica cliente...
                 const realIdCli = idMap[payload.id] || payload.id;
                 if (!realIdCli.toString().startsWith('local_')) {
                    const { id: _upId, criado_em: _upCr, ...dadosCli } = payload.cliente;
                    await clientesService.atualizar(true, realIdCli, dadosCli);
                 } else shouldRemoveAction = false;
                break;

              case 'DELETAR_CLIENTE':
                 // ...logica cliente...
                 const delId = idMap[payload.id] || payload.id;
                 if (!delId.toString().startsWith('local_')) await clientesService.excluir(true, delId);
                break;

              case 'CRIAR_PRODUTO':
                const { id: _pId, criado_em: _pCr, ...prodLimpo } = payload.produto;
                await produtosService.criar(true, prodLimpo);
                break;
              case 'ATUALIZAR_PRODUTO':
                const { id: _upPId, criado_em: _upPCr, ...prodUp } = payload.produto;
                await produtosService.atualizar(true, payload.id, prodUp);
                break;
            }

            if (shouldRemoveAction && action.id) {
                await localDatabaseService.removePendingAction(action.id);
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
      // LIBERA A TRAVA GLOBAL
      isGlobalSyncingLocked = false;
    }
  };

  useEffect(() => {
    if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
    }
    if (!isOnline) return;
    
    // Timer com debounce
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