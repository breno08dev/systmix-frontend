import React, { useState, useEffect } from 'react';
import Modal from '../Shared/Modal';
import { Cliente } from '../../types';
import { clientesService } from '../../services/clientes';
import { useToast } from '../../contexts/ToastContext';
import { User, Phone, Mail, CheckCircle, Loader2 } from 'lucide-react';

interface ClienteModalProps {
  clienteInicial?: Cliente;
  onClose: () => void;
  onSalvar: () => void;
  isOnline: boolean;
}

export const ClienteModal: React.FC<ClienteModalProps> = ({ 
  clienteInicial, 
  onClose, 
  onSalvar, 
  isOnline 
}) => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { addToast } = useToast();

  useEffect(() => {
    if (clienteInicial) {
      setNome(clienteInicial.nome || '');
      setTelefone(clienteInicial.telefone || '');
      setEmail(clienteInicial.email || '');
    } else {
      setNome('');
      setTelefone('');
      setEmail('');
    }
  }, [clienteInicial]);

  const handleSalvar = async () => {
    if (!nome.trim()) {
      return addToast('O nome do cliente é obrigatório.', 'error');
    }

    setLoading(true);

    try {
      // CORREÇÃO AQUI: Usar undefined em vez de null para campos opcionais
      const dadosCliente = {
        nome: nome.trim(),
        telefone: telefone.trim() ? telefone.trim() : undefined,
        email: email.trim() ? email.trim() : undefined
      };

      if (clienteInicial) {
        await clientesService.atualizar(isOnline, clienteInicial.id, dadosCliente);
        addToast('Cliente atualizado com sucesso!', 'success');
      } else {
        await clientesService.criar(isOnline, dadosCliente);
        addToast('Cliente cadastrado com sucesso!', 'success');
      }

      onSalvar();
    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Erro ao salvar cliente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <button 
        onClick={onClose} 
        className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
        disabled={loading}
      >
        Cancelar
      </button>
      <button 
        onClick={handleSalvar} 
        disabled={loading}
        className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
        {clienteInicial ? 'Salvar Alterações' : 'Cadastrar Cliente'}
      </button>
    </>
  );

  return (
    <Modal
      title={clienteInicial ? 'Editar Cliente' : 'Novo Cliente'}
      onClose={onClose}
      footer={footer}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        
        {/* Campo Nome */}
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Completo *</label>
            <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 transition-all outline-none"
                    placeholder="Ex: João da Silva"
                    autoFocus
                />
            </div>
        </div>

        {/* Campo Telefone */}
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
            <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 transition-all outline-none"
                    placeholder="(00) 00000-0000"
                />
            </div>
        </div>

        {/* Campo Email */}
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">E-mail</label>
            <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 transition-all outline-none"
                    placeholder="cliente@email.com"
                />
            </div>
        </div>

      </div>
    </Modal>
  );
};