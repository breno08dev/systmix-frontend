// src/components/Produtos/CategoriaModal.tsx
import React, { useState } from 'react';
import Modal from '../Shared/Modal';
import { categoriasService } from '../../services/categorias';
import { useToast } from '../../contexts/ToastContext';
import { CheckCircle, Loader2, Tag } from 'lucide-react';

interface CategoriaModalProps {
  onClose: () => void;
  onCategoriaCriada: () => void;
  isOnline: boolean;
}

export const CategoriaModal: React.FC<CategoriaModalProps> = ({ onClose, onCategoriaCriada, isOnline }) => {
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSalvar = async () => {
    if (!nome.trim()) return addToast('O nome da categoria é obrigatório.', 'error');
    
    setLoading(true);
    try {
      await categoriasService.criar(isOnline, nome);
      addToast('Categoria criada com sucesso!', 'success');
      onCategoriaCriada(); // Atualiza a lista de quem chamou (se necessário)
      onClose();
    } catch (error: any) {
      console.error(error);
      addToast('Erro ao criar categoria.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
        Cancelar
      </button>
      <button 
        onClick={handleSalvar} 
        disabled={loading}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
        Salvar
      </button>
    </>
  );

  return (
    <Modal title="Nova Categoria" onClose={onClose} footer={footer} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="p-4 bg-indigo-50 rounded-xl flex items-center gap-3 text-indigo-800 border border-indigo-100">
            <Tag size={20} />
            <p className="text-sm font-medium">Cadastre categorias para organizar seu estoque.</p>
        </div>
        
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nome da Categoria</label>
            <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Ex: Bebidas, Lanches..."
                autoFocus
            />
        </div>
      </div>
    </Modal>
  );
};