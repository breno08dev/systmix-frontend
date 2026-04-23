// src/services/crediario.ts
import { supabase } from '../lib/supabaseClient';
import { db } from '../lib/localDatabase';
import { Comanda, PagamentoInput } from '../types';
import { comandasService } from './comandas';

export const crediarioService = {
  async listarFiados(isOnline: boolean): Promise<Comanda[]> {
    if (isOnline) {
      try {
        const { data } = await supabase
          .from('comandas')
          .select(`*, cliente:clientes(*), itens:itens_comanda(*, produto:produtos(*)), pagamentos(*)`)
          .eq('status', 'fiado')
          .order('criado_em', { ascending: false });
        
        if (data) {
           // Atualiza cache local
           await db.comandas.bulkPut(data as any);
           return data as Comanda[];
        }
      } catch (e) {
        console.error("Erro ao buscar fiados online:", e);
      }
    }
    
    // Fallback Offline
    const comandasLocais = await db.comandas.filter(c => c.status === 'fiado').toArray();
    for (const c of comandasLocais) {
        c.itens = await db.itensComanda.where('id_comanda').equals(c.id).toArray();
        for (const i of c.itens) {
            const prod = await db.produtos.get(i.id_produto);
            if (prod) i.produto = prod;
        }
        if (c.id_cliente && !c.cliente) {
            const cli = await db.clientes.get(c.id_cliente);
            if (cli) c.cliente = cli;
        }
        c.pagamentos = c.pagamentos || []; 
    }
    return comandasLocais as Comanda[];
  },

  async pagarFiado(isOnline: boolean, idComanda: string, pagamentos: PagamentoInput[]): Promise<void> {
    // Reutilizamos a lógica poderosa de fechar comanda que já trata offline/online e pagamentos
    await comandasService.fecharComanda(isOnline, idComanda, pagamentos);
  }
};