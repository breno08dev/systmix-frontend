// src/services/produtos.ts
import { supabase } from '../lib/supabaseClient';
import { Produto } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

const normalizarProduto = (p: any): Produto => ({
    ...p,
    preco: Number(p.preco ?? 0),
    estoque: Number(p.estoque ?? 0),
    ativo: p.ativo ?? true,
    categoria: p.categoria || 'Geral' 
});

export const produtosService = {
  
  async listarAtivos(isOnline: boolean): Promise<Produto[]> {
    if (isOnline) {
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('*, categoria:categorias(*)') 
          .eq('ativo', true)
          .order('nome', { ascending: true });

        if (error) {
             console.warn("Tentando fallback de produtos sem join:", error.message);
             const { data: dataSimples, error: errorSimples } = await supabase
                .from('produtos')
                .select('*')
                .eq('ativo', true);
             
             if (errorSimples) throw errorSimples;
             
             const produtos = (dataSimples || []).map(normalizarProduto);
             if (produtos.length > 0) await db.produtos.bulkPut(produtos);
             return produtos;
        }
        
        const produtos = (data || []).map(normalizarProduto);

        if (produtos.length > 0) {
            await db.produtos.bulkPut(produtos);
        }

        return produtos;
      } catch (error) {
        console.error("Erro buscar online, tentando local...", error);
        return await localDatabaseService.listarProdutosAtivos();
      }
    } else {
      return await localDatabaseService.listarProdutosAtivos();
    }
  },

  async criar(isOnline: boolean, produto: any): Promise<Produto> {
    const payload = {
        nome: produto.nome.trim(),
        descricao: produto.descricao,
        preco: typeof produto.preco === 'string' ? parseFloat(produto.preco.replace(',', '.')) : produto.preco,
        estoque: Number(produto.estoque),
        codigo_barras: produto.codigo_barras,
        imagem_url: produto.imagem_url,
        id_categoria: (produto.id_categoria && produto.id_categoria !== "") ? produto.id_categoria : null,
        ativo: true,
        categoria: produto.categoria || 'Geral'
    };

    if (isOnline) {
        const { data, error } = await supabase.from('produtos').insert([payload]).select().single();
        if (error) throw error;
        
        const novoProd = normalizarProduto(data);
        await db.produtos.put(novoProd);
        return novoProd;
    } else {
        // CORREÇÃO: Removido o addPendingAction daqui pois o localDatabaseService já adiciona.
        const novoProduto = await localDatabaseService.criarProduto(payload as any);
        return novoProduto;
    }
  },

  async atualizar(isOnline: boolean, id: string, produto: any): Promise<void> {
    const payload = {
        nome: produto.nome.trim(),
        descricao: produto.descricao,
        preco: typeof produto.preco === 'string' ? parseFloat(produto.preco.replace(',', '.')) : produto.preco,
        estoque: Number(produto.estoque),
        codigo_barras: produto.codigo_barras,
        imagem_url: produto.imagem_url,
        id_categoria: (produto.id_categoria && produto.id_categoria !== "") ? produto.id_categoria : null,
        ativo: produto.ativo,
        categoria: produto.categoria || 'Geral'
    };

    if (isOnline) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', id);
        if (error) throw error;
        await db.produtos.update(id, payload);
    } else {
        // Atualização não tem wrapper automático no localDatabaseService para adicionar ação, então mantemos aqui.
        await localDatabaseService.atualizarProduto(id, payload);
        await localDatabaseService.addPendingAction('ATUALIZAR_PRODUTO', { id, produto: payload });
    }
  },

  async excluir(isOnline: boolean, id: string): Promise<void> {
      if (isOnline) {
          const { error } = await supabase.from('produtos').delete().eq('id', id);
          if (error) throw error;
          await db.produtos.delete(id);
      } else {
          await localDatabaseService.deletarProduto(id);
          await localDatabaseService.addPendingAction('DELETAR_PRODUTO', { id });
      }
  }
};