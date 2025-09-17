import { Comanda, ItemComanda, Pagamento } from '../types';
import { apiFetch } from '../lib/api'; // Importa a nossa função de fetch centralizada

export const comandasService = {
  /**
   * Busca todas as comandas com status 'aberta' na API.
   */
  async listarAbertas(): Promise<Comanda[]> {
    return apiFetch('/comandas');
  },

  /**
   * Envia uma requisição para criar uma nova comanda.
   * @param numero O número da comanda.
   * @param idCliente O ID opcional do cliente.
   */
  async criarComanda(numero: number, idCliente?: string): Promise<Comanda> {
    return apiFetch('/comandas', {
      method: 'POST',
      body: JSON.stringify({ numero, id_cliente: idCliente }),
    });
  },

  /**
   * Adiciona um item a uma comanda específica.
   * @param idComanda O ID da comanda.
   * @param item O objeto do item a ser adicionado.
   */
  async adicionarItem(idComanda: string, item: Omit<ItemComanda, 'id' | 'id_comanda' | 'criado_em'>): Promise<ItemComanda> {
    return apiFetch(`/comandas/${idComanda}/itens`, {
        method: 'POST',
        body: JSON.stringify(item),
    });
  },

  /**
   * Atualiza a quantidade de um item específico em uma comanda.
   * @param idComanda O ID da comanda.
   * @param idItem O ID do item.
   * @param quantidade A nova quantidade.
   */
  async atualizarQuantidadeItem(idComanda: string, idItem: string, quantidade: number): Promise<void> {
    await apiFetch(`/comandas/${idComanda}/itens/${idItem}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantidade }),
    });
  },

  /**
   * Remove um item de uma comanda.
   * @param idComanda O ID da comanda.
   * @param idItem O ID do item a ser removido.
   */
  async removerItem(idComanda: string, idItem: string): Promise<void> {
    await apiFetch(`/comandas/${idComanda}/itens/${idItem}`, {
        method: 'DELETE',
    });
  },

  /**
   * Fecha uma comanda, registrando os pagamentos.
   * @param idComanda O ID da comanda a ser fechada.
   * @param pagamentos Um array com os pagamentos realizados.
   */
  async fecharComanda(idComanda: string, pagamentos: Omit<Pagamento, 'id' | 'data' | 'id_comanda'>[]): Promise<void> {
    await apiFetch(`/comandas/${idComanda}/fechar`, {
        method: 'POST',
        body: JSON.stringify({ pagamentos }),
    });
  },
};