// src/services/comandas.ts (HÍBRIDO)
import { Comanda, ItemComanda, Pagamento } from '../types';
import { localDatabaseService } from '../lib/localDatabase';
import { supabaseComandasService } from './supabaseService';

export const comandasService = {
  
  async listarAbertas(isOnline: boolean): Promise<Comanda[]> {
    if (isOnline) {
      const comandasOnline = await supabaseComandasService.listarAbertas();
      // TODO: Salvar/Atualizar no Dexie para cache
      return comandasOnline;
    } else {
      return localDatabaseService.listarAbertas();
    }
  },

  async criarComanda(isOnline: boolean, numero: number, idCliente?: string): Promise<Comanda | void> {
    if (isOnline) {
      return await supabaseComandasService.criarComanda(numero, idCliente);
    } else {
      const comandaLocal = await localDatabaseService.criarComanda(numero, idCliente);
      await localDatabaseService.addPendingAction('CRIAR_COMANDA', { numero, idCliente, idLocal: comandaLocal.id });
      return comandaLocal;
    }
  },

  async adicionarItem(isOnline: boolean, idComanda: string, item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'>): Promise<ItemComanda | void> {
    if (isOnline) {
      return await supabaseComandasService.adicionarItem(idComanda, item);
    } else {
      // TODO: Implementar localDatabaseService.adicionarItem
      // const itemLocal = await localDatabaseService.adicionarItem(idComanda, item);
      await localDatabaseService.addPendingAction('ADICIONAR_ITEM', { idComanda, item });
      // return itemLocal;
    }
  },
  
  async fecharComanda(isOnline: boolean, idComanda: string, pagamentos: Omit<Pagamento, 'id' | 'data' | 'id_comanda'>[]): Promise<void> {
     if (isOnline) {
        return await supabaseComandasService.fecharComanda(idComanda, pagamentos);
     } else {
        // TODO: Implementar localDatabaseService.fecharComanda
        // await localDatabaseService.fecharComanda(idComanda, pagamentos);
        await localDatabaseService.addPendingAction('FECHAR_COMANDA', { idComanda, pagamentos });
     }
  },

  async atualizarQuantidadeItem(isOnline: boolean, idComanda: string, idItem: string, quantidade: number): Promise<void> {
    if (isOnline) {
      return await supabaseComandasService.atualizarQuantidadeItem(idComanda, idItem, quantidade);
    } else {
      // TODO: Implementar local
    }
  },

  async removerItem(isOnline: boolean, idComanda: string, idItem: string): Promise<void> {
    if (isOnline) {
      return await supabaseComandasService.removerItem(idComanda, idItem);
    } else {
      // TODO: Implementar local
    }
  }
};