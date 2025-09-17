import { Cliente } from '../types';
import { apiFetch } from '../lib/api'; // Certifique-se de que o caminho para api.ts está correto

export const clientesService = {
  /**
   * Lista todos os clientes a partir da API.
   */
  async listar(): Promise<Cliente[]> {
    return apiFetch('/clientes');
  },

  /**
   * Envia uma requisição para criar um novo cliente.
   * @param cliente Os dados do cliente a ser criado.
   */
  async criar(cliente: Omit<Cliente, 'id' | 'criado_em'>): Promise<Cliente> {
    return apiFetch('/clientes', {
      method: 'POST',
      body: JSON.stringify(cliente),
    });
  },

  /**
   * Envia uma requisição para atualizar um cliente existente.
   * @param id O ID do cliente a ser atualizado.
   * @param cliente Os novos dados parciais do cliente.
   */
  async atualizar(id: string, cliente: Partial<Cliente>): Promise<Cliente> {
    return apiFetch(`/clientes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cliente),
    });
  },

  /**
   * Envia uma requisição para deletar um cliente.
   * A API irá tratar o erro caso o cliente esteja vinculado a uma comanda.
   * @param id O ID do cliente a ser deletado.
   */
  async deletar(id: string): Promise<void> {
    await apiFetch(`/clientes/${id}`, {
      method: 'DELETE',
    });
  },
};