// src/components/Clientes/Clientes.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit, Trash2, Users, Phone, Mail, Loader2, User, Calendar } from 'lucide-react';
import { clientesService } from '../../services/clientes';
import { Cliente } from '../../types';
import { ClienteModal } from './ClienteModal';
import { useToast } from '../../contexts/ToastContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ConfirmacaoModal } from '../Common/ConfirmacaoModal';

// Função simples para formatar a data de criação
const formatarData = (dataISO?: string) => {
    if (!dataISO) return 'Data não informada';
    try {
        return new Date(dataISO).toLocaleDateString('pt-BR');
    } catch (e) {
        return 'Data inválida';
    }
};

export const Clientes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clienteParaDeletar, setClienteParaDeletar] = useState<string | null>(null);

  const { addToast } = useToast();
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    carregarClientes();
  }, [isOnline]);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const data = await clientesService.listar(isOnline);
      setClientes(data);
    } catch (error) {
      console.error(error);
      addToast('Erro ao carregar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNovoCliente = () => {
    setClienteSelecionado(null);
    setIsModalOpen(true);
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setClienteSelecionado(cliente);
    setIsModalOpen(true);
  };

  const handleDeletarCliente = async () => {
    if (!clienteParaDeletar) return;
    try {
      await clientesService.deletar(isOnline, clienteParaDeletar);
      setClientes(prev => prev.filter(c => c.id !== clienteParaDeletar));
      addToast('Cliente removido com sucesso!', 'success');
    } catch (error) {
      addToast('Erro ao remover cliente.', 'error');
    } finally {
      setClienteParaDeletar(null);
    }
  };

  const clientesFiltrados = useMemo(() => {
    const termo = termoBusca.toLowerCase();
    return clientes.filter(c => 
      c.nome.toLowerCase().includes(termo) ||
      (c.telefone && c.telefone.includes(termo)) ||
      (c.email && c.email.toLowerCase().includes(termo))
    );
  }, [clientes, termoBusca]);

  return (
    <div className="p-4 md:p-6 max-w-[1920px] mx-auto min-h-screen flex flex-col gap-6">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="text-indigo-600" size={28} />
            Carteira de Clientes
          </h1>
          <p className="text-slate-500 text-sm">Gerencie contatos e histórico.</p>
        </div>
        
        <button 
          onClick={handleNovoCliente}
          className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      {/* BARRA DE BUSCA */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="Buscar por nome, telefone ou e-mail..." 
                value={termoBusca}
                onChange={e => setTermoBusca(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-base"
            />
        </div>
      </div>

      {/* LISTA DE CARDS */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-slate-400">
            <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
            <p className="font-medium">Carregando contatos...</p>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] bg-white rounded-3xl border border-slate-200 border-dashed p-8">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                <Users size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">Nenhum cliente encontrado</h3>
            <p className="text-slate-500 text-sm text-center max-w-xs">
                {termoBusca ? 'Verifique o termo digitado.' : 'Cadastre clientes para agilizar suas vendas.'}
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {clientesFiltrados.map(cliente => (
                <div 
                    key={cliente.id} 
                    className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 transition-all group flex flex-col h-full relative"
                >
                    {/* Topo: Ícone e Ações */}
                    <div className="flex items-start justify-between mb-4">
                        {/* Ícone Padrão (Sem iniciais) */}
                        <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                            <User size={24} />
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => handleEditarCliente(cliente)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Editar"
                            >
                                <Edit size={18} />
                            </button>
                            <button 
                                onClick={() => setClienteParaDeletar(cliente.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Excluir"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Dados Principais */}
                    <div className="mb-4">
                        <h3 className="text-base font-bold text-slate-800 truncate mb-1" title={cliente.nome}>
                            {cliente.nome}
                        </h3>
                        {cliente.criado_em && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                                <Calendar size={12} />
                                <span>Cliente desde {formatarData(cliente.criado_em)}</span>
                            </div>
                        )}
                    </div>

                    {/* Detalhes de Contato */}
                    <div className="space-y-3 pt-2 border-t border-slate-50">
                        <div className="flex items-center gap-3 text-slate-600 text-sm">
                            <Phone size={16} className="text-slate-400 shrink-0" />
                            <span className="truncate font-medium">{cliente.telefone || 'Sem telefone'}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-slate-600 text-sm">
                            <Mail size={16} className="text-slate-400 shrink-0" />
                            <span className="truncate">{cliente.email || 'Sem e-mail'}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      {isModalOpen && (
        <ClienteModal
            clienteInicial={clienteSelecionado || undefined}
            onClose={() => setIsModalOpen(false)}
            onSalvar={() => {
                setIsModalOpen(false);
                carregarClientes();
            }}
            isOnline={isOnline}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO */}
      <ConfirmacaoModal
        isOpen={!!clienteParaDeletar}
        onClose={() => setClienteParaDeletar(null)}
        onConfirm={handleDeletarCliente}
        title="Excluir Cliente"
        message="Tem certeza que deseja remover este cliente? A ação é irreversível."
        tipo="perigo"
      />
    </div>
  );
};