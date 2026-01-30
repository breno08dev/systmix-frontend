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

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const hasSyncedSinceOnline = useRef(false); 

  const processSyncQueue = async () => {
    if (isSyncing) return; 

    setIsSyncing(true);
    hasSyncedSinceOnline.current = true;
    
    console.log('SYNC: Iniciando varredura de pendências...'); 

    try {
      const pendingActions = await localDatabaseService.getPendingActions();
      
      if (pendingActions.length === 0) {
        setIsSyncing(false);
        return;
      }

      addToast(`Sincronizando ${pendingActions.length} ações pendentes...`, 'error');

      // Mapa de Tradução (ID Local -> ID Real UUID)
      const idMap: Record<string, string> = {};

      for (const action of pendingActions) {
          try {
            // Clona o payload
            let payload = JSON.parse(JSON.stringify(action.payload));

            // --- 1. TRADUÇÃO DE IDS (Local -> Real) ---
            if (payload.id_comanda && idMap[payload.id_comanda]) payload.id_comanda = idMap[payload.id_comanda];
            if (payload.idComanda && idMap[payload.idComanda]) payload.idComanda = idMap[payload.idComanda];
            if (payload.idCliente && idMap[payload.idCliente]) payload.idCliente = idMap[payload.idCliente];
            if (payload.id_cliente && idMap[payload.id_cliente]) payload.id_cliente = idMap[payload.id_cliente];

            console.log(`SYNC: Executando ${action.type}`, payload);
            
            let shouldRemoveAction = true; // Flag para controlar se removemos da fila

            switch (action.type) {
              case 'CRIAR_CLIENTE':
                try {
                    const { id: _idCli, criado_em: _cEmCli, ...clienteLimpo } = payload.cliente;
                    const novoCliente: any = await clientesService.criar(true, clienteLimpo);
                    
                    if (novoCliente && payload.tempId) {
                        idMap[payload.tempId] = novoCliente.id;
                        await db.clientes.delete(payload.tempId); 
                    }
                } catch (err: any) {
                    console.error("Erro ao criar cliente sync:", err);
                    throw err; 
                }
                break;

              case 'CRIAR_COMANDA':
                const idClienteFinal = idMap[payload.idCliente] || (payload.idCliente?.toString().startsWith('local_') ? null : payload.idCliente);
                
                try {
                    const novaComanda = await comandasService.criarComanda(true, payload.numero, idClienteFinal);
                    if (novaComanda && payload.tempId) {
                        idMap[payload.tempId] = novaComanda.id;
                        await db.comandas.delete(payload.tempId);
                    }
                } catch (err: any) {
                    // TRATAMENTO DE CONFLITO (409) - Comanda já existe
                    if (err.code === '23505' || err.message?.includes('duplicate key') || err.status === 409) {
                        console.warn(`SYNC: Comanda ${payload.numero} já existe. Recuperando ID...`);
                        
                        // Busca a comanda existente para pegar o ID real
                        const { data: existente } = await supabase
                            .from('comandas')
                            .select('*')
                            .eq('numero', payload.numero)
                            .eq('status', 'aberta')
                            .single();

                        if (existente) {
                            if (payload.tempId) idMap[payload.tempId] = existente.id;
                            
                            // Atualiza o cliente se necessário
                            if (!existente.id_cliente && idClienteFinal && !idClienteFinal.toString().startsWith('local_')) {
                                await supabase.from('comandas').update({ id_cliente: idClienteFinal }).eq('id', existente.id);
                            }

                            // Limpa local
                            if (payload.tempId) await db.comandas.delete(payload.tempId);
                        } else {
                            shouldRemoveAction = false;
                        }
                    } else {
                        throw err;
                    }
                }
                break;

              case 'ADICIONAR_ITEM':
                const idComandaReal = payload.id_comanda || payload.idComanda;
                
                if (idComandaReal && !idComandaReal.toString().startsWith('local_')) {
                    // CORREÇÃO: Removemos campos que não existem no banco online (adicionais/observacao)
                    const itemSanitizado = {
                        id_produto: payload.id_produto,
                        quantidade: Number(payload.quantidade),
                        valor_unit: Number(payload.valor_unit)
                        // Removido 'observacao' e 'adicionais' pois o Supabase retornou erro de coluna inexistente
                    };
                    
                    await comandasService.adicionarItem(true, idComandaReal, itemSanitizado);
                    
                    if (payload.id && payload.id.toString().startsWith('local_')) {
                        await db.itensComanda.delete(payload.id);
                    }
                } else {
                    console.warn(`SYNC: Item adiado. Dependência de comanda (${idComandaReal}) não resolvida.`);
                    shouldRemoveAction = false; 
                }
                break;
                
              case 'REMOVER_ITEM':
                try {
                    await comandasService.removerItem(true, payload.idComanda, payload.idItem);
                } catch (e) { console.warn("Item já removido ou inexistente", e); }
                break;

              case 'ATUALIZAR_QTD_ITEM':
                await comandasService.atualizarQuantidadeItem(true, "", payload.idItem, payload.novaQuantidade);
                break;

              case 'FECHAR_COMANDA':
                 const idComandaFechar = payload.idComanda || payload.id_comanda;
                 if (idComandaFechar && !idComandaFechar.toString().startsWith('local_')) {
                    await comandasService.fecharComanda(true, idComandaFechar, payload.pagamentos, payload.dataFechamento);
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
                const realIdCliente = idMap[payload.id] || payload.id;
                if (!realIdCliente.toString().startsWith('local_')) {
                    const { id: _upId, criado_em: _upCr, ...dadosCli } = payload.cliente;
                    await clientesService.atualizar(true, realIdCliente, dadosCli);
                } else {
                    shouldRemoveAction = false;
                }
                break;

              case 'DELETAR_CLIENTE':
                const delIdCliente = idMap[payload.id] || payload.id;
                if (!delIdCliente.toString().startsWith('local_')) {
                    await clientesService.deletar(true, delIdCliente);
                }
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
      addToast('Erro ao sincronizar dados.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!isOnline) {
      hasSyncedSinceOnline.current = false;
      return;
    }
    
    if (isOnline && !hasSyncedSinceOnline.current) {
        const timer = setTimeout(() => processSyncQueue(), 2000); 
        return () => clearTimeout(timer);
    }
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