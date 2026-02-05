// src/services/produtos.ts
import { supabase } from '../lib/supabaseClient';
import { Produto } from '../types';
import { db, localDatabaseService } from '../lib/localDatabase';

// Normalizador para garantir tipos corretos vindo do Banco ou do Cache
const normalizarProduto = (p: any): Produto => ({
    ...p,
    preco: Number(p.preco ?? 0),
    estoque: Number(p.estoque ?? 0),
    ativo: p.ativo ?? true,
    // Garante que categoria seja string se vier flat, ou objeto se vier join
    categoria: p.categoria || 'Geral' 
});

export const produtosService = {
  
  async listarAtivos(isOnline: boolean): Promise<Produto[]> {
    if (isOnline) {
      try {
        let produtos: Produto[] = [];

        // 1. Tenta buscar com JOIN (trazendo objeto categoria completo)
        const { data, error } = await supabase
          .from('produtos')
          .select('*, categoria:categorias(*)') 
          .eq('ativo', true)
          .order('nome', { ascending: true });

        if (error) {
             console.warn("Tentando fallback de produtos sem join (API instável):", error.message);
             // Fallback: busca simples se o JOIN falhar
             const { data: dataSimples, error: errorSimples } = await supabase
                .from('produtos')
                .select('*')
                .eq('ativo', true);
             
             if (errorSimples) throw errorSimples;
             produtos = (dataSimples || []).map(normalizarProduto);
        } else {
             produtos = (data || []).map(normalizarProduto);
        }
        
        // 2. ATUALIZAÇÃO DO CACHE LOCAL (Upsert)
        if (produtos.length > 0) {
            // Salva no Dexie para acesso offline futuro
            await db.produtos.bulkPut(produtos).catch(e => console.warn('Erro ao atualizar cache produtos:', e));
        }

        // 3. FAXINA (Sync Destrutivo)
        // Remove do cache local itens que foram deletados no servidor
        try {
            const idsOnline = new Set(produtos.map(p => p.id));
            const idsLocais = await db.produtos.toCollection().primaryKeys();

            const paraDeletar = idsLocais.filter(id => {
                const idStr = String(id);
                // Deleta SE: (Não está na lista online) E (Não é um item recém-criado offline "local_")
                return !idsOnline.has(idStr) && !idStr.startsWith('local_');
            });

            if (paraDeletar.length > 0) {
                console.log(`[Sync Produtos] Removendo ${paraDeletar.length} itens obsoletos.`);
                await db.produtos.bulkDelete(paraDeletar);
            }
        } catch (cleanupError) {
            console.warn("Erro ao limpar cache de produtos:", cleanupError);
        }

        return produtos;

      } catch (error) {
        console.error("Erro buscar online, mudando para local...", error);
        return await localDatabaseService.listarProdutosAtivos();
      }
    } else {
      // Modo Offline
      return await localDatabaseService.listarProdutosAtivos();
    }
  },

  async criar(isOnline: boolean, produto: any): Promise<Produto> {
    // Prepara payload garantindo números e strings limpas
    const payload = {
        nome: produto.nome.trim(),
        descricao: produto.descricao,
        // Converte "10,50" para 10.50 se necessário
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
            await db.produtos.put(novoProd); // Atualiza cache imediatamente
            return novoProd;
        } catch (e) {
            console.error("Erro ao criar online, salvando offline...", e);
            // Se falhar online (ex: timeout), cai para o return abaixo (offline)
        }
    }
    
    // Offline: Cria localmente e o localDatabaseService JÁ adiciona a pending_action 'CRIAR_PRODUTO'
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

    if (isOnline) {
        try {
            const { error } = await supabase.from('produtos').update(payload).eq('id', id);
            if (error) throw error;
            
            // Sucesso Online: Atualiza apenas o cache local
            await db.produtos.update(id, payload);
            return;
        } catch (e) { 
            console.error("Erro update online, agendando offline...", e);
        }
    }
    
    // Offline:
    // 1. Atualiza o dado no Dexie para a UI refletir agora
    await localDatabaseService.atualizarProduto(id, payload);
    // 2. Agenda a sincronização (Importante: localDatabase.atualizarProduto NÃO agenda sozinho)
    await localDatabaseService.addPendingAction('ATUALIZAR_PRODUTO', { id, produto: payload });
  },

  async excluir(isOnline: boolean, id: string): Promise<void> {
      if (isOnline) {
          try {
              const { error } = await supabase.from('produtos').delete().eq('id', id);
              if (error) throw error;
              await db.produtos.delete(id);
              return;
          } catch (e) { console.error("Erro delete online, agendando offline...", e); }
      }
      
      // Offline:
      await localDatabaseService.deletarProduto(id);
      // Agenda a exclusão
      await localDatabaseService.addPendingAction('DELETAR_PRODUTO', { id });
  }
};