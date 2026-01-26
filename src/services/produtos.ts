// src/services/produtos.ts
import { supabase } from '../lib/supabaseClient';
import { Produto } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

export const produtosService = {
  
  async listarAtivos(isOnline: boolean): Promise<Produto[]> {
    if (isOnline) {
      try {
        // 1. Busca do Supabase
        const { data, error } = await supabase
          .from('produtos')
          .select('*, categoria:categorias(*)')
          .eq('ativo', true)
          .order('nome', { ascending: true });

        if (error) throw error;
        
        const produtos = data || [];

        // 2. CACHE: Salva/Atualiza tudo no banco local para usar offline depois
        if (produtos.length > 0) {
            // Removemos a categoria aninhada para salvar no banco plano, se necessário, 
            // ou salvamos direto se o Dexie suportar objetos complexos (suporta).
            await db.produtos.bulkPut(produtos);
            console.log(`CACHE: ${produtos.length} produtos atualizados.`);
        }

        return produtos;
      } catch (error) {
        console.error("Erro ao buscar online, tentando local...", error);
        return await localDatabaseService.listarProdutosAtivos();
      }
    } else {
      // MODO OFFLINE: Busca do Dexie
      console.log("OFFLINE: Buscando produtos locais...");
      return await localDatabaseService.listarProdutosAtivos();
    }
  },

  async criar(isOnline: boolean, produto: any): Promise<Produto> {
    const payload = {
        nome: produto.nome.trim(),
        preco: typeof produto.preco === 'string' ? parseFloat(produto.preco.replace(',', '.')) : produto.preco,
        estoque: Number(produto.estoque),
        id_categoria: (produto.id_categoria && produto.id_categoria !== "") ? produto.id_categoria : null,
        ativo: true
    };

    if (isOnline) {
        const { data, error } = await supabase.from('produtos').insert([payload]).select().single();
        if (error) throw error;
        
        // Atualiza cache local
        await db.produtos.put(data);
        return data;
    } else {
        // Cria offline e agenda sync
        const novoProduto = await localDatabaseService.criarProduto(payload);
        await localDatabaseService.addPendingAction('CRIAR_PRODUTO', { produto: payload });
        return novoProduto;
    }
  },

  async atualizar(isOnline: boolean, id: string, produto: any): Promise<void> {
    const payload = {
        nome: produto.nome.trim(),
        preco: typeof produto.preco === 'string' ? parseFloat(produto.preco.replace(',', '.')) : produto.preco,
        estoque: Number(produto.estoque),
        id_categoria: (produto.id_categoria && produto.id_categoria !== "") ? produto.id_categoria : null,
        ativo: true
    };

    if (isOnline) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', id);
        if (error) throw error;
        // Atualiza local
        await db.produtos.update(id, payload);
    } else {
        await localDatabaseService.atualizarProduto(id, payload);
        await localDatabaseService.addPendingAction('ATUALIZAR_PRODUTO', { id, produto: payload });
    }
  }
};