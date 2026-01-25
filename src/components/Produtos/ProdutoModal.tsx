// src/components/Produtos/ProdutoModal.tsx
import React, { useState, useEffect } from 'react';
import Modal from '../Shared/Modal';
import { Produto } from '../../types';
import { produtosService } from '../../services/produtos';
import { useToast } from '../../contexts/ToastContext';
import { Package, Tag, Box, Save } from 'lucide-react';

interface ProdutoModalProps {
  produto: Produto | null;
  onClose: () => void;
  onProdutoSalvo: () => void;
  isOnline: boolean;
}

export const ProdutoModal: React.FC<ProdutoModalProps> = ({
  produto,
  onClose,
  onProdutoSalvo,
  isOnline,
}) => {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [preco, setPreco] = useState('');
  const [estoque, setEstoque] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const { addToast } = useToast();

  useEffect(() => {
    if (produto) {
      setNome(produto.nome);
      setCategoria(produto.categoria);
      setPreco(produto.preco.toString());
      setEstoque(produto.estoque ? produto.estoque.toString() : '0');
      setAtivo(produto.ativo);
    } else {
      setNome('');
      setCategoria('');
      setPreco('');
      setEstoque('0');
      setAtivo(true);
    }
  }, [produto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim() || !categoria.trim() || !preco) {
        addToast('Preencha todos os campos.', 'error'); // CORREÇÃO
        return;
    }

    const precoNum = parseFloat(preco.replace(',', '.'));
    const estoqueNum = parseInt(estoque) || 0;

    if (isNaN(precoNum) || precoNum < 0) {
        addToast('Preço inválido.', 'error'); // CORREÇÃO
        return;
    }

    setLoading(true);
    try {
      const dados = { 
          nome, 
          categoria, 
          preco: precoNum, 
          estoque: estoqueNum, 
          ativo 
      };
      
      if (produto) {
          await produtosService.atualizar(isOnline, produto.id, dados);
          addToast('Produto atualizado!', 'success');
      } else {
          await produtosService.criar(isOnline, dados);
          addToast('Produto criado!', 'success');
      }
      
      onProdutoSalvo();
    } catch (e: any) {
      addToast(e.message || 'Erro ao salvar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <div className="grid grid-cols-2 gap-3 w-full">
        <button type="button" onClick={onClose} className="px-4 py-3 border rounded-xl hover:bg-slate-50" disabled={loading}>Cancelar</button>
        <button onClick={handleSubmit} disabled={loading} className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2">{loading ? 'Salvando...' : <><Save size={18}/> Salvar</>}</button>
    </div>
  );

  return (
    <Modal title={produto ? "Editar" : "Novo"} onClose={onClose} footer={footer} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <input value={nome} onChange={e => setNome(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Nome" required />
        <div className="grid grid-cols-2 gap-4">
            <input value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Categoria" list="cats" />
            <input type="number" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Preço" required />
        </div>
        <input type="number" value={estoque} onChange={e => setEstoque(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Estoque" />
      </form>
    </Modal>
  );
};