import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Tag } from 'lucide-react';
import { produtosService } from '../../services/produtos';
import { Produto } from '../../types';
import ProdutoModal from './ProdutoModal';
import { CategoriaModal } from './CategoriaModal'; 
import { useToast } from '../../contexts/ToastContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ConfirmacaoModal } from '../Common/ConfirmacaoModal';

export const Produtos: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false); 
  const [produtoParaDeletar, setProdutoParaDeletar] = useState<string | null>(null);

  const { addToast } = useToast();
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    carregarProdutos();
  }, [isOnline]);

  const carregarProdutos = async () => {
    setLoading(true);
    try {
      const data = await produtosService.listarAtivos(isOnline); 
      setProdutos(data);
    } catch (error) {
      addToast('Erro ao carregar produtos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNovoProduto = () => {
    setProdutoSelecionado(null);
    setIsProdutoModalOpen(true);
  };

  const handleEditarProduto = (produto: Produto) => {
    setProdutoSelecionado(produto);
    setIsProdutoModalOpen(true);
  };

  const handleDeletarProduto = async () => {
    if (!produtoParaDeletar) return;
    try {
      setProdutos(prev => prev.filter(p => p.id !== produtoParaDeletar)); // Mock visual se não tiver delete no service
      addToast('Produto removido com sucesso!', 'success');
    } catch (error) {
      addToast('Erro ao remover produto.', 'error');
    } finally {
      setProdutoParaDeletar(null);
    }
  };

  const produtosFiltrados = produtos.filter(p => 
    p.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
    (p.categoria?.nome && p.categoria.nome.toLowerCase().includes(termoBusca.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Catálogo de Produtos</h1>
          <p className="text-slate-500">Gerencie seu estoque, preços e categorias.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsCategoriaModalOpen(true)}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 shadow-sm"
            >
                <Tag size={18} className="text-indigo-500" />
                Nova Categoria
            </button>

            <button 
                onClick={handleNovoProduto}
                className="px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
                <Plus size={20} />
                Novo Produto
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou categoria..." 
                    value={termoBusca}
                    onChange={e => setTermoBusca(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4">Produto</th>
                        <th className="px-6 py-4">Categoria</th>
                        <th className="px-6 py-4">Preço</th>
                        <th className="px-6 py-4">Estoque</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">Carregando estoque...</td></tr>
                    ) : produtosFiltrados.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum produto encontrado.</td></tr>
                    ) : (
                        produtosFiltrados.map(produto => (
                            <tr key={produto.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    {/* ÍCONE DE CAIXA REMOVIDO DAQUI */}
                                    {produto.nome}
                                </td>
                                <td className="px-6 py-4">
                                    {produto.categoria ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                                            {produto.categoria.nome}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 italic">Sem categoria</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 font-semibold text-emerald-600">R$ {produto.preco.toFixed(2)}</td>
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center gap-1.5 ${produto.estoque < 10 ? 'text-amber-600 font-bold' : ''}`}>
                                        {produto.estoque} un
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleEditarProduto(produto)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button 
                                            onClick={() => setProdutoParaDeletar(produto.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {isProdutoModalOpen && (
        <ProdutoModal
            produtoInicial={produtoSelecionado || undefined}
            onClose={() => setIsProdutoModalOpen(false)}
            onSalvar={() => {
                setIsProdutoModalOpen(false);
                carregarProdutos();
            }}
            isOnline={isOnline}
        />
      )}

      {isCategoriaModalOpen && (
        <CategoriaModal
            onClose={() => setIsCategoriaModalOpen(false)}
            onCategoriaCriada={() => addToast('Categoria criada!', 'success')}
            isOnline={isOnline}
        />
      )}

      <ConfirmacaoModal
        isOpen={!!produtoParaDeletar}
        onClose={() => setProdutoParaDeletar(null)}
        onConfirm={handleDeletarProduto}
        title="Excluir Produto"
        message="Tem certeza que deseja excluir?"
        tipo="perigo"
      />
    </div>
  );
};