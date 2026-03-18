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
        let produtos: Produto[] = [];

        // 1. Tenta buscar com JOIN
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
             produtos = (dataSimples || []).map(normalizarProduto);
        } else {
             produtos = (data || []).map(normalizarProduto);
        }
        
        // 2. Cache Local
        if (produtos.length > 0) {
            await db.produtos.bulkPut(produtos).catch(e => console.warn('Erro cache produtos:', e));
        }

        // 3. Limpeza de obsoletos
        try {
            const idsOnline = new Set(produtos.map(p => p.id));
            const idsLocais = await db.produtos.toCollection().primaryKeys();
            const paraDeletar = idsLocais.filter(id => {
                const idStr = String(id);
                // Não deleta se não existe online MAS é novo localmente ('local_')
                return !idsOnline.has(idStr) && !idStr.startsWith('local_');
            });
            if (paraDeletar.length > 0) await db.produtos.bulkDelete(paraDeletar);
        } catch (cleanupError) {}

        return produtos;

      } catch (error) {
        console.error("Erro buscar online, usando local...", error);
        return await localDatabaseService.listarProdutosAtivos();
      }
    } 
    return await localDatabaseService.listarProdutosAtivos();
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
        try {
            const { data, error } = await supabase.from('produtos').insert([payload]).select().single();
            if (error) throw error;
            
            const novoProd = normalizarProduto(data);
            await db.produtos.put(novoProd); 
            return novoProd;
        } catch (e) {
            console.error("Erro criar produto online:", e);
        }
    }
    
    // Offline: Cria e já agenda a ação 'CRIAR_PRODUTO' internamente
    return await localDatabaseService.criarProduto(payload as any);
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

    if (isOnline && !id.startsWith('local_')) {
        try {
            const { error } = await supabase.from('produtos').update(payload).eq('id', id);
            if (error) throw error;
            await db.produtos.update(id, payload);
            return;
        } catch (e) { 
            console.error("Erro update produto online:", e);
        }
    }
    
    await localDatabaseService.atualizarProduto(id, payload);
    await localDatabaseService.addPendingAction('ATUALIZAR_PRODUTO', { id, produto: payload });
  },

  async excluir(isOnline: boolean, id: string): Promise<void> {
      if (isOnline && !id.startsWith('local_')) {
          try {
              const { error } = await supabase.from('produtos').delete().eq('id', id);
              if (error) throw error;
              await db.produtos.delete(id);
              return;
          } catch (e) { console.error("Erro delete produto online:", e); }
      }
      
      await localDatabaseService.deletarProduto(id);
      await localDatabaseService.addPendingAction('DELETAR_PRODUTO', { id });
  }
};