// src/components/PDV/AbrirComandaModal.tsx (CORRIGIDO)
import React, { useState } from 'react';
import { X, UserPlus, Search } from 'lucide-react';
import { Cliente } from '../../types';
import { clientesService } from '../../services/clientes';
import { useToast } from '../../contexts/ToastContext'; 

interface AbrirComandaModalProps {
  numeroComanda: number;
  clientes: Cliente[];
  onClose: () => void;
  // MUDANÇA: Agora passa o objeto Cliente completo (opcional)
  onComandaAberta: (numero: number, idCliente?: string, clientObject?: Cliente) => void;
  isOnline: boolean; 
}

export const AbrirComandaModal: React.FC<AbrirComandaModalProps> = ({
  numeroComanda,
  clientes,
  onClose,
  onComandaAberta,
  isOnline 
}) => {
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');
  const [modoNovoCliente, setModoNovoCliente] = useState(false);
  const { addToast } = useToast(); 

  const clientesFiltrados = clientes.filter(c => 
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
    c.telefone?.includes(buscaCliente)
  );

  const handleAbrirComanda = async () => {
    let clienteParaPassar: Cliente | undefined = clienteSelecionado || undefined;

    if (modoNovoCliente) {
      if (!novoClienteNome) {
        addToast('O nome do novo cliente é obrigatório.', 'error');
        return;
      }
      try {
        const novoCliente = await clientesService.criar(isOnline, {
          nome: novoClienteNome,
          telefone: novoClienteTelefone || undefined,
        });
        
        // Se a criação foi bem-sucedida, usamos o objeto retornado
        clienteParaPassar = novoCliente as Cliente; 

      } catch (error: any) {
        console.error("Erro ao criar novo cliente:", error);
        addToast(error.message || "Não foi possível criar o novo cliente.", 'error');
        return; // Sai da função em caso de erro
      }
    }
    
    // Passa o ID do cliente e o objeto completo para o PDV
    onComandaAberta(numeroComanda, clienteParaPassar?.id, clienteParaPassar);
  };
  
  // ... (JSX restante)
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Abrir Comanda {numeroComanda}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        {!modoNovoCliente ? (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar Cliente (Opcional)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Nome ou telefone..."
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  className="w-full p-3 pl-10 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto border rounded-lg mb-4">
              {clientesFiltrados.map(cliente => (
                <div
                  key={cliente.id}
                  onClick={() => setClienteSelecionado(cliente)}
                  className={`p-3 cursor-pointer hover:bg-gray-100 ${clienteSelecionado?.id === cliente.id ? 'bg-gray-200' : ''}`}
                >
                  <p className="font-medium">{cliente.nome}</p>
                  <p className="text-sm text-gray-500">{cliente.telefone}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setModoNovoCliente(true)}
              className="w-full flex items-center justify-center gap-2 py-2 mb-4 border border-dashed border-gray-400 text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <UserPlus size={16} />
              Cadastrar Novo Cliente
            </button>
          </div>
        ) : (
          <div className="space-y-4 mb-4">
            <h3 className="font-semibold text-gray-800">Novo Cliente</h3>
            <input
              type="text"
              placeholder="Nome do Cliente *"
              value={novoClienteNome}
              onChange={(e) => setNovoClienteNome(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
              required
            />
            <input
              type="text"
              placeholder="Telefone (Opcional)"
              value={novoClienteTelefone}
              onChange={(e) => setNovoClienteTelefone(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => setModoNovoCliente(false)}
              className="text-sm text-secondary hover:underline"
            >
              Voltar para busca
            </button>
          </div>
        )}

        <div className="flex gap-4 pt-4 border-t">
          <button
            type="button"
            onClick={() => onComandaAberta(numeroComanda)}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Abrir sem Cliente
          </button>
          <button
            onClick={handleAbrirComanda}
            className="flex-1 py-3 bg-primary text-white rounded-lg hover:bg-secondary font-medium"
          >
            {modoNovoCliente ? 'Criar e Abrir' : 'Abrir Comanda'}
          </button>
        </div>
      </div>
    </div>
  );
};