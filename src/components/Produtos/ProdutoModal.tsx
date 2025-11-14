import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { produtosService } from '../../services/produtos';
import { Produto } from '../../types';
import { useToast } from '../../contexts/ToastContext'; 
// 1. NÃO PRECISAMOS MAIS DO 'useSync' AQUI
// import { useSync } from '../../contexts/SyncContext'; 

interface ProdutoModalProps {
  produto: Produto | null;
  onClose: () => void;
  onProdutoSalvo: () => void;
  isOnline: boolean; // 2. O modal RECEBE 'isOnline'
}

export const ProdutoModal: React.FC<ProdutoModalProps> = ({
  produto,
  onClose,
  onProdutoSalvo,
  isOnline // 3. A prop é recebida aqui
}) => {
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    preco: '',
    ativo: true
  });
  
  const { addToast } = useToast(); 
  const [carregando, setCarregando] = useState(false);
  
  // 4. REMOVIDO: Não precisamos mais do 'addPendingAction'
  // const { addPendingAction } = useSync(); 

  const categoriasSugeridas = [
    'Bebidas',
    'Cervejas',
    'Vinhos',
    'Destilados',
    'Refrigerantes',
    'Lanches',
    'Porções',
    'Pratos Principais',
    'Sobremesas',
    'Petiscos'
  ];

  useEffect(() => {
    if (produto) {
      setFormData({
        nome: produto.nome,
        categoria: produto.categoria,
        preco: produto.preco.toString(),
        ativo: produto.ativo
      });
    }
  }, [produto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    
    try {
      const produtoData = {
        nome: formData.nome,
        categoria: formData.categoria,
        preco: parseFloat(formData.preco),
        ativo: formData.ativo
      };

      // 5. CORREÇÃO: Usamos 'isOnline' como primeiro argumento.
      // O serviço decide se salva online ou offline.
      if (produto) {
        await produtosService.atualizar(isOnline, produto.id, produtoData);
      } else {
        await produtosService.criar(isOnline, produtoData);
      }

      addToast(`Produto salvo ${isOnline ? 'com sucesso' : 'localmente'}!`, 'success');
      onProdutoSalvo();
      
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      addToast(error.message || 'Não foi possível salvar o produto.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {produto ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            disabled={carregando}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Produto
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary"
              required
              disabled={carregando}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <input
              type="text"
              list="categorias"
              value={formData.categoria}
              onChange={(e) => handleChange('categoria', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary"
              required
              disabled={carregando}
            />
            <datalist id="categorias">
              {categoriasSugeridas.map(categoria => (
                <option key={categoria} value={categoria} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preço (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.preco}
              onChange={(e) => handleChange('preco', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-secondary"
              required
              disabled={carregando}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={formData.ativo}
              onChange={(e) => handleChange('ativo', e.target.checked)}
              className="rounded border-gray-300 focus:ring-secondary"
              disabled={carregando}
            />
            <label htmlFor="ativo" className="text-sm font-medium text-gray-700">
              Produto ativo
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={carregando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400"
              disabled={carregando}
            >
              {carregando ? 'Salvando...' : (produto ? 'Salvar' : 'Criar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};