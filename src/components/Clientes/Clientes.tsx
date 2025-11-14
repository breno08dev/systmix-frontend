// src/components/Clientes/Clientes.tsx (HÍBRIDO)
import React, { useState, useEffect } from 'react';
import { Plus, Users, Phone, Calendar, Trash2 } from 'lucide-react';
import { clientesService } from '../../services/clientes';
import { Cliente } from '../../types';
import { ClienteModal } from './ClienteModal';
import { ConfirmacaoModal } from '../Common/ConfirmacaoModal';
import { useToast } from '../../contexts/ToastContext'; // Importe o Toast
// === IMPORTS DOS NOVOS HOOKS ===
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useSync } from '../../contexts/SyncContext';

export const Clientes: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEdicao, setClienteEdicao] = useState<Cliente | null>(null);
  const [busca, setBusca] = useState('');
  
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null);

  // === NOVOS HOOKS ===
  const { addToast } = useToast();
  const { isSyncing } = useSync();
  const { isOnline } = useOnlineStatus();

  // Carrega na montagem e quando o status online/sync muda
  useEffect(() => {
    carregarClientes();
  }, [isOnline, isSyncing]);

  const carregarClientes = async () => {
    try {
      // 1. CORREÇÃO: Passa 'isOnline' para o serviço
      const data = await clientesService.listar(isOnline);
      setClientes(data);
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      addToast(error.message || 'Erro ao carregar clientes.', 'error');
    }
  };

  const handleClienteSalvo = () => {
    carregarClientes();
    setModalAberto(false);
    setClienteEdicao(null);
  };

  const editarCliente = (cliente: Cliente) => {
    setClienteEdicao(cliente);
    setModalAberto(true);
  };

  const handleAbrirModalExcluir = (evento: React.MouseEvent, cliente: Cliente) => {
    evento.stopPropagation();
    setClienteParaExcluir(cliente);
    setModalExcluirAberto(true);
  };

  const handleConfirmarExclusao = async () => {
    if (!clienteParaExcluir) return;
    try {
      // 2. CORREÇÃO: Passa 'isOnline' e o 'id'. O serviço cuida da fila.
      await clientesService.deletar(isOnline, clienteParaExcluir.id);
      addToast(`Cliente excluído ${isOnline ? '' : 'localmente.'}`, 'success');
      carregarClientes();
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error);
      addToast(error.message || 'Não foi possível excluir o cliente.', 'error');
    } finally {
      setModalExcluirAberto(false);
      setClienteParaExcluir(null);
    }
  };

  const clientesFiltrados = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(busca.toLowerCase()) ||
    cliente.telefone?.includes(busca)
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Clientes</h1>
            <p className="text-gray-600">Gerencie sua base de clientes</p>
          </div>
          <button
            onClick={() => {
              setClienteEdicao(null);
              setModalAberto(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
          >
            <Plus size={20} />
            Novo Cliente
          </button>
        </div>

        <div className="max-w-md">
          <input
            type="text"
            placeholder="Buscar cliente por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6">
          {clientesFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">{busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clientesFiltrados.map(cliente => (
                <div
                  key={cliente.id}
                  onClick={() => editarCliente(cliente)}
                  className="group border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-secondary hover:bg-gray-50 transition-colors relative"
                >
                  <button
                    onClick={(e) => handleAbrirModalExcluir(e, cliente)}
                    className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Excluir cliente"
                  >
                    <Trash2 size={16} />
                  </button>

                  <h3 className="font-bold text-gray-900 pr-8">{cliente.nome}</h3>
                  {cliente.telefone && (
                    <div className="flex items-center gap-1 text-gray-600 mt-1">
                      <Phone size={14} /><span className="text-sm">{cliente.telefone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-gray-500 mt-2">
                    <Calendar size={14} />
                    <span className="text-xs">Cadastrado em {new Date(cliente.criado_em).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-100 mt-3">
                    <p className="text-sm text-gray-500">Clique para editar</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalAberto && (
        <ClienteModal
          cliente={clienteEdicao}
          onClose={() => { setModalAberto(false); setClienteEdicao(null); }}
          onClienteSalvo={handleClienteSalvo}
          isOnline={isOnline} // 3. PASSA O STATUS PARA O MODAL
        />
      )}

      {modalExcluirAberto && clienteParaExcluir && (
        <ConfirmacaoModal
          titulo="Excluir Cliente"
          mensagem={`Tem certeza que deseja excluir "${clienteParaExcluir.nome}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleConfirmarExclusao}
          onClose={() => setModalExcluirAberto(false)}
        />
      )}
    </div>
  );
};