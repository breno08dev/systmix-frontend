// src/services/produtos.ts
import { supabase } from '../lib/supabaseClient';
import { Produto } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

// Normaliza para evitar erros de 'possibly null' e conflito de categoria
const normalizarProduto = (p: any): Produto => ({
    ...p,
    // Garante números válidos
    preco: Number(p.preco ?? 0),
    estoque: Number(p.estoque ?? 0),
    ativo: p.ativo ?? true,
    // Aceita tanto a string do banco antigo quanto o objeto da nova relação
    categoria: p.categoria || 'Geral' 
});

export const produtosService = {
  
  async listarAtivos(isOnline: boolean): Promise<Produto[]> {
    if (isOnline) {
      try {
        // Tenta buscar com relação, se falhar o banco pode estar no formato antigo (texto)
        const { data, error } = await supabase
          .from('produtos')
          .select('*, categoria:categorias(*)') 
          .eq('ativo', true)
          .order('nome', { ascending: true });

        // Se der erro no select (ex: tabela categorias não existe), tenta select simples
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

        // Cache Offline
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
    // CORREÇÃO: Adicionado 'categoria' ao payload para satisfazer o tipo Produto
    const payload = {
        nome: produto.nome.trim(),
        descricao: produto.descricao,
        preco: typeof produto.preco === 'string' ? parseFloat(produto.preco.replace(',', '.')) : produto.preco,
        estoque: Number(produto.estoque),
        codigo_barras: produto.codigo_barras,
        imagem_url: produto.imagem_url,
        id_categoria: (produto.id_categoria && produto.id_categoria !== "") ? produto.id_categoria : null,
        ativo: true,
        categoria: produto.categoria || 'Geral' // <--- OBRIGATÓRIO AGORA
    };

    if (isOnline) {
        const { data, error } = await supabase.from('produtos').insert([payload]).select().single();
        if (error) throw error;
        
        const novoProd = normalizarProduto(data);
        await db.produtos.put(novoProd);
        return novoProd;
    } else {
        // Agora o payload satisfaz o tipo Omit<Produto, 'id'> esperado aqui
        const novoProduto = await localDatabaseService.criarProduto(payload as any);
        await localDatabaseService.addPendingAction('CRIAR_PRODUTO', { produto: payload });
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
        categoria: produto.categoria || 'Geral' // <--- OBRIGATÓRIO AGORA
    };

    if (isOnline) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', id);
        if (error) throw error;
        
        await db.produtos.update(id, payload);
    } else {
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