// src/components/Clientes/ClienteModal.tsx (HÍBRIDO)
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { clientesService } from '../../services/clientes';
import { Cliente } from '../../types';
import { useToast } from '../../contexts/ToastContext'; // Importe o Toast

interface ClienteModalProps {
  cliente: Cliente | null;
  onClose: () => void;
  onClienteSalvo: () => void;
  isOnline: boolean; // 1. DEFINIR A PROP AQUI
}

export const ClienteModal: React.FC<ClienteModalProps> = ({
  cliente,
  onClose,
  onClienteSalvo,
  isOnline // 2. RECEBER A PROP
}) => {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: ''
  });
  const [carregando, setCarregando] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (cliente) {
      setFormData({
        nome: cliente.nome,
        telefone: cliente.telefone || ''
      });
    }
  }, [cliente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    
    try {
      const clienteData = {
        nome: formData.nome,
        telefone: formData.telefone || undefined
      };

      // 3. USAR A PROP 'isOnline' PARA DECIDIR
      if (cliente) {
        await clientesService.atualizar(isOnline, cliente.id, clienteData);
      } else {
        await clientesService.criar(isOnline, clienteData);
      }
      
      addToast(`Cliente salvo ${isOnline ? 'com sucesso' : 'localmente'}!`, 'success');
      onClienteSalvo();
      
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      addToast(error.message || 'Não foi possível salvar os dados do cliente.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {cliente ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" disabled={carregando}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente *</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
              required
              disabled={carregando}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="tel"
              value={formData.telefone}
              onChange={(e) => handleChange('telefone', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
              placeholder="(11) 99999-9999"
              disabled={carregando}
            />
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
              {carregando ? 'Salvando...' : (cliente ? 'Salvar Alterações' : 'Criar Cliente')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};