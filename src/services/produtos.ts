import { Produto } from '../types';
import { apiFetch } from '../lib/api'; // Supondo que você criou o apiFetch em src/lib/api.ts

export const produtosService = {
  /**
   * Lista todos os produtos (ativos e inativos) a partir da API.
   */
  async listar(): Promise<Produto[]> {
    return apiFetch('/products');
  },

  /**
   * Busca todos os produtos e filtra apenas os ativos no lado do cliente.
   * Isso evita a necessidade de um endpoint de API separado.
   */
  async listarAtivos(): Promise<Produto[]> {
    const todosProdutos = await this.listar();
    return todosProdutos.filter(p => p.ativo);
  },

  /**
   * Envia uma requisição para criar um novo produto.
   * @param produto Os dados do produto a ser criado.
   */
  async criar(produto: Omit<Produto, 'id' | 'criado_em'>): Promise<Produto> {
    return apiFetch('/products', {
      method: 'POST',
      body: JSON.stringify(produto),
    });
  },

  /**
   * Envia uma requisição para atualizar um produto existente.
   * @param id O ID do produto a ser atualizado.
   * @param produto Os novos dados parciais do produto.
   */
  async atualizar(id: string, produto: Partial<Produto>): Promise<Produto> {
    return apiFetch(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(produto),
    });
  },

  /**
   * Envia uma requisição para deletar um produto.
   * @param id O ID do produto a ser deletado.
   */
  async deletar(id: string): Promise<void> {
    await apiFetch(`/products/${id}`, {
      method: 'DELETE',
    });
  },
};