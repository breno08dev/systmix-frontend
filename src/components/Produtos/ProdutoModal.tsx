// src/components/Produtos/ProdutoModal.tsx
import { useState, useEffect } from 'react';
import Modal from '../Shared/Modal';
import { Produto, Categoria } from '../../types';
import { produtosService } from '../../services/produtos';
import { categoriasService } from '../../services/categorias';
import { useToast } from '../../contexts/ToastContext';
import { Package, CheckCircle, Loader2, DollarSign, Layers } from 'lucide-react';

interface ProdutoModalProps {
  produtoInicial?: Produto;
  onClose: () => void;
  onSalvar: () => void;
  isOnline: boolean;
}

export default function ProdutoModal({ produtoInicial, onClose, onSalvar, isOnline }: ProdutoModalProps) {
  const [nome, setNome] = useState(produtoInicial?.nome || '');
  const [preco, setPreco] = useState(produtoInicial?.preco?.toString() || '');
  const [estoque, setEstoque] = useState(produtoInicial?.estoque?.toString() || '');
  const [idCategoria, setIdCategoria] = useState(produtoInicial?.id_categoria || '');
  
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    carregarCategorias();
  }, [isOnline]);

  const carregarCategorias = async () => {
    try {
        const data = await categoriasService.listar(isOnline);
        setCategorias(data);
    } catch (error) {
        console.error("Erro ao carregar categorias", error);
    }
  };

  const handleSalvar = async () => {
    if (!nome.trim()) return addToast('O nome é obrigatório.', 'error');
    if (!preco) return addToast('O preço é obrigatório.', 'error');
    if (!estoque) return addToast('O estoque é obrigatório.', 'error');

    setLoading(true);
    
    try {
      const produtoDados = {
        nome,
        preco, 
        estoque,
        id_categoria: idCategoria,
        ativo: true
      };

      if (produtoInicial) {
        await produtosService.atualizar(isOnline, produtoInicial.id, produtoDados);
        addToast('Produto atualizado!', 'success');
      } else {
        await produtosService.criar(isOnline, produtoDados);
        addToast('Produto criado!', 'success');
      }
      
      onSalvar(); 
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes('descricao')) {
         addToast('Erro: Limpe o cache do navegador ou reinicie o servidor.', 'error');
      } else {
         addToast(`Erro ao salvar: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
        Cancelar
      </button>
      <button 
        onClick={handleSalvar} 
        disabled={loading}
        className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
        {produtoInicial ? 'Salvar' : 'Cadastrar'}
      </button>
    </>
  );

  return (
    <Modal
      title={produtoInicial ? 'Editar Produto' : 'Novo Produto'}
      onClose={onClose}
      footer={footer}
      maxWidth="max-w-2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Produto *</label>
                <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 transition-all"
                        placeholder="Ex: X-Bacon"
                        autoFocus
                    />
                </div>
            </div>

            <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">Categoria</label>
                 <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select
                        value={idCategoria}
                        onChange={(e) => setIdCategoria(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 bg-white appearance-none text-slate-700"
                    >
                        <option value="">Sem Categoria</option>
                        {categorias.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.nome}</option>
                        ))}
                    </select>
                 </div>
            </div>
        </div>

        <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Preço (R$) *</label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="number"
                            step="0.01"
                            value={preco}
                            onChange={(e) => setPreco(e.target.value)}
                            className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 font-medium"
                            placeholder="0.00"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Estoque *</label>
                    <input
                        type="number"
                        value={estoque}
                        onChange={(e) => setEstoque(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500"
                        placeholder="0"
                    />
                </div>
             </div>
             
             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
                <h4 className="text-sm font-bold text-slate-700 mb-2">Resumo</h4>
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Nome:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[150px]">{nome || '---'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Venda:</span>
                    <span className="font-bold text-emerald-600">
                        R$ {parseFloat(preco.toString().replace(',','.') || '0').toFixed(2)}
                    </span>
                </div>
             </div>
        </div>

      </div>
    </Modal>
  );
}