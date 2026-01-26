// src/contexts/SyncContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { localDatabaseService } from '../lib/localDatabase';
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

      addToast(`Sincronizando ${pendingActions.length} ações...`, 'success');

      // Mapa de Tradução (Local ID -> Real UUID)
      const idMap: Record<string, string> = {};

      for (const action of pendingActions) {
          if (!action.id) continue;
          
          try {
            // Clona o payload
            let payload = JSON.parse(JSON.stringify(action.payload));

            // Atualiza IDs baseados no Mapa
            if (payload.id_comanda && idMap[payload.id_comanda]) payload.id_comanda = idMap[payload.id_comanda];
            if (payload.idComanda && idMap[payload.idComanda]) payload.idComanda = idMap[payload.idComanda];
            if (payload.idCliente && idMap[payload.idCliente]) payload.idCliente = idMap[payload.idCliente];
            if (payload.id_cliente && idMap[payload.id_cliente]) payload.id_cliente = idMap[payload.id_cliente];

            console.log(`SYNC: Executando ${action.type}`, payload);

            switch (action.type) {
              case 'CRIAR_CLIENTE':
                const { id: _idCli, criado_em: _cEmCli, ...clienteLimpo } = payload.cliente;
                const novoCliente: any = await clientesService.criar(true, clienteLimpo);
                if (novoCliente && payload.tempId) {
                    idMap[payload.tempId] = novoCliente.id;
                }
                break;

              case 'CRIAR_COMANDA':
                const idClienteFinal = payload.idCliente?.toString().startsWith('local_') ? null : payload.idCliente;
                const novaComanda = await comandasService.criarComanda(true, payload.numero, idClienteFinal);
                if (novaComanda && payload.tempId) {
                    idMap[payload.tempId] = novaComanda.id;
                }
                break;

              case 'ADICIONAR_ITEM':
                const idComandaReal = payload.id_comanda || payload.idComanda;
                if (idComandaReal && !idComandaReal.toString().startsWith('local_')) {
                    // Limpeza Profunda: envia só o necessário
                    const itemSanitizado = {
                        id_produto: payload.id_produto,
                        quantidade: Number(payload.quantidade),
                        valor_unit: Number(payload.valor_unit),
                        observacao: payload.observacao || '',
                        adicionais: payload.adicionais || null
                    };
                    await comandasService.adicionarItem(true, idComandaReal, itemSanitizado);
                }
                break;
                
              case 'REMOVER_ITEM':
                await comandasService.removerItem(true, payload.idComanda, payload.idItem);
                break;

              case 'ATUALIZAR_QTD_ITEM':
                await comandasService.atualizarQuantidadeItem(true, "", payload.idItem, payload.novaQuantidade);
                break;

              case 'FECHAR_COMANDA':
                 if (payload.idComanda && !payload.idComanda.toString().startsWith('local_')) {
                    // Passa a data original salva no offline
                    await comandasService.fecharComanda(true, payload.idComanda, payload.pagamentos, payload.dataFechamento);
                 }
                break;
              
              case 'MOVIMENTACAO_CAIXA':
                 if (payload.idCaixa && !payload.idCaixa.startsWith('local_')) {
                    await supabase.from('caixas').update({ saldo_atual: payload.novoSaldo }).eq('id', payload.idCaixa);
                 }
                 break;

              case 'ATUALIZAR_CLIENTE':
                const realIdCliente = idMap[payload.id] || payload.id;
                const { id: _upId, criado_em: _upCr, ...dadosCli } = payload.cliente;
                await clientesService.atualizar(true, realIdCliente, dadosCli);
                break;

              case 'DELETAR_CLIENTE':
                const delIdCliente = idMap[payload.id] || payload.id;
                await clientesService.deletar(true, delIdCliente);
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

            await localDatabaseService.removePendingAction(action.id);
            
          } catch (syncError: any) {
            console.error(`SYNC ERRO [${action.type}]:`, syncError);
          }
      }
      
      addToast('Dados sincronizados com sucesso!', 'success');

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
        const timer = setTimeout(() => processSyncQueue(), 3000); 
        return () => clearTimeout(timer);
    }
  }, [isOnline, addToast]); 

  return (
    <SyncContext.Provider value={{ isSyncing }}>
      {children}
    </SyncContext.Provider>
  );
};

export function useSync(): SyncContextData {
  return useContext(SyncContext);
}