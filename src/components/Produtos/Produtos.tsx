// src/components/Produtos/Produtos.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Tag, Box, CheckCircle, XCircle } from 'lucide-react';
import { produtosService } from '../../services/produtos';
import { Produto } from '../../types';
import { ProdutoModal } from './ProdutoModal';
import { ConfirmacaoModal } from '../Common/ConfirmacaoModal';
import { useToast } from '../../contexts/ToastContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const Produtos: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEdicao, setProdutoEdicao] = useState<Produto | null>(null);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<Produto | null>(null);
  const [termoBusca, setTermoBusca] = useState('');

  const { addToast } = useToast();
  const { isOnline } = useOnlineStatus();

  const carregarProdutos = async () => {
    setLoading(true);
    try {
      const data = await produtosService.listar(isOnline);
      setProdutos(data);
    } catch (error: any) {
      addToast('Erro ao carregar produtos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarProdutos(); }, [isOnline]);

  const handleProdutoSalvo = () => {
    carregarProdutos();
    setModalAberto(false);
    setProdutoEdicao(null);
  };

  const handleConfirmarExclusao = async () => {
    if (!produtoParaExcluir) return;
    try {
      // CORREÇÃO: Método 'deletar' (era remover)
      await produtosService.deletar(isOnline, produtoParaExcluir.id);
      addToast('Produto excluído.', 'success');
      carregarProdutos();
    } catch (error: any) {
      addToast('Erro ao excluir produto.', 'error');
    } finally {
      setModalExcluirAberto(false);
    }
  };

  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => p.nome.toLowerCase().includes(termoBusca.toLowerCase()));
  }, [produtos, termoBusca]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2"><Package className="text-indigo-600"/> Produtos</h1>
        <button onClick={() => { setProdutoEdicao(null); setModalAberto(true); }} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex items-center gap-2">
            <Plus size={20} /> Novo Produto
        </button>
      </div>
      
      <div className="bg-white p-4 rounded-xl border mb-6 relative">
         <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
         <input type="text" placeholder="Buscar produto..." className="w-full pl-12 pr-4 py-3 border rounded-xl outline-none focus:border-indigo-500" value={termoBusca} onChange={e => setTermoBusca(e.target.value)} />
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Produto</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Categoria</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Preço</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Estoque</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {produtosFiltrados.map(produto => (
                    <tr key={produto.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-slate-800">{produto.nome}</td>
                        <td className="px-6 py-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{produto.categoria}</span></td>
                        <td className="px-6 py-4 font-bold text-emerald-600">R$ {produto.preco.toFixed(2)}</td>
                        <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${produto.estoque <= 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-700'}`}>
                                <Box size={12} /> {produto.estoque}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <button onClick={() => { setProdutoEdicao(produto); setModalAberto(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 size={18}/></button>
                            <button onClick={() => { setProdutoParaExcluir(produto); setModalExcluirAberto(true); }} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={18}/></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {modalAberto && (
        <ProdutoModal 
            produto={produtoEdicao} // CORREÇÃO: prop correta
            onClose={() => setModalAberto(false)} 
            onProdutoSalvo={handleProdutoSalvo} // CORREÇÃO: prop correta
            isOnline={isOnline} 
        />
      )}
      
      <ConfirmacaoModal isOpen={modalExcluirAberto} onClose={() => setModalExcluirAberto(false)} onConfirm={handleConfirmarExclusao} title="Excluir" message="Confirma a exclusão?" tipo="perigo" />
    </div>
  );
};