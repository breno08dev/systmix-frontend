// src/contexts/SyncContext.tsx (CORRIGIDO PARA O LOOP)
import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'; // 1. Adicionado 'useRef'
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { localDatabaseService } from '../lib/localDatabase';
import { supabaseComandasService, supabaseClientesService, supabaseProdutosService } from '../services/supabaseService';
import { useToast } from './ToastContext';

interface SyncContextData {
  isSyncing: boolean; 
}
const SyncContext = createContext<SyncContextData>({} as SyncContextData);

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isOnline } = useOnlineStatus();
  const { addToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  // 2. NOVO: Rastreia se o sync já foi feito desde que a conexão voltou
  const hasSyncedSinceOnline = useRef(false); 

  // O processo de sincronização principal (função de loop)
  const processSyncQueue = async () => {
    // 3. Checa o flag antes de iniciar o processo demorado
    if (isSyncing) return; 

    setIsSyncing(true);
    hasSyncedSinceOnline.current = true; // Marca como sincronizando para prevenir loops
    
    console.log('SYNC: Iniciando sincronização...'); 

    try {
      const pendingActions = await localDatabaseService.getPendingActions();
      if (pendingActions.length === 0) {
        console.log('SYNC: Nada para sincronizar.');
        return;
      }

      addToast(`Sincronizando ${pendingActions.length} ações...`, 'success');

      // ... (Resto da lógica de sincronização: for loop, switch case, etc.) ...
      for (const action of pendingActions) {
          if (!action.id) continue;
          try {
            switch (action.type) {
              case 'CRIAR_COMANDA':
                await supabaseComandasService.criarComanda(action.payload.numero, action.payload.idCliente);
                break;
              case 'CRIAR_CLIENTE':
                await supabaseClientesService.criar(action.payload.cliente);
                break;
              case 'CRIAR_PRODUTO':
                await supabaseProdutosService.criar(action.payload.produto);
                break;
            }
            await localDatabaseService.removePendingAction(action.id);
          } catch (syncError) {
            console.error(`SYNC: Falha ao processar ação ${action.id} (${action.type})`, syncError);
          }
      }
      addToast('Sincronização concluída.', 'success');

    } catch (error) {
      console.error('Erro ao processar fila de sincronização:', error);
      addToast('Falha na sincronização.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. CORREÇÃO PRINCIPAL: O useEffect só roda se o status 'isOnline' mudar.
  useEffect(() => {
    // Se a conexão caiu, resetamos o flag para que ela possa rodar quando voltar.
    if (!isOnline) {
      hasSyncedSinceOnline.current = false;
      return;
    }
    
    // Se a conexão voltou e ainda não sincronizamos, inicie.
    if (isOnline && !hasSyncedSinceOnline.current) {
        // Pequeno atraso para dar tempo de reestabelecer o status do Dexie/outros
        const timer = setTimeout(() => processSyncQueue(), 1000); 
        return () => clearTimeout(timer);
    }
    
  }, [isOnline, addToast]); // Depende apenas de isOnline

  return (
    <SyncContext.Provider value={{ isSyncing }}>
      {children}
    </SyncContext.Provider>
  );
};

export function useSync(): SyncContextData {
  return useContext(SyncContext);
}