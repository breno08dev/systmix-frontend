import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { produtosService } from '../../services/produtos';
import { Produto } from '../../types';

interface ProdutoModalProps {
  produto: Produto | null;
  onClose: () => void;
  onProdutoSalvo: () => void;
}

export const ProdutoModal: React.FC<ProdutoModalProps> = ({
  produto,
  onClose,
  onProdutoSalvo
}) => {
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    preco: '',
    ativo: true
  });

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
    
    try {
      const produtoData = {
        nome: formData.nome,
        categoria: formData.categoria,
        preco: parseFloat(formData.preco),
        ativo: formData.ativo
      };

      if (produto) {
        await produtosService.atualizar(produto.id, produtoData);
      } else {
        await produtosService.criar(produtoData);
      }

      onProdutoSalvo();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
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
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={formData.ativo}
              onChange={(e) => handleChange('ativo', e.target.checked)}
              className="rounded border-gray-300 focus:ring-secondary"
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
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
            >
              {produto ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};