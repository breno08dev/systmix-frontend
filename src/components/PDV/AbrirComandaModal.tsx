// src/components/PDV/AbrirComandaModal.tsx
import React, { useState, useMemo } from 'react';
import Modal from '../Shared/Modal'; // Usando o componente compartilhado
import { Cliente } from '../../types';
import { clientesService } from '../../services/clientes';
import { useToast } from '../../contexts/ToastContext';
import { UserPlus, Search, CheckCircle, Loader2, User } from 'lucide-react';

interface AbrirComandaModalProps {
  numeroComanda: number;
  clientes: Cliente[];
  onClose: () => void;
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
  const [loading, setLoading] = useState(false);
  
  const { addToast } = useToast(); 

  // Filtro otimizado
  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente) return clientes.slice(0, 10);
    const termo = buscaCliente.toLowerCase();
    return clientes.filter(c => 
      c.nome.toLowerCase().includes(termo) ||
      c.telefone?.includes(termo)
    );
  }, [clientes, buscaCliente]);

  const handleAbrirComanda = async () => {
    setLoading(true);
    let clienteParaPassar: Cliente | undefined = clienteSelecionado || undefined;

    try {
      if (modoNovoCliente) {
        if (!novoClienteNome) {
          addToast('O nome do novo cliente é obrigatório.', 'error');
          setLoading(false);
          return;
        }
        
        const novoCliente = await clientesService.criar(isOnline, {
          nome: novoClienteNome,
          telefone: novoClienteTelefone || undefined,
        });
        
        clienteParaPassar = novoCliente as Cliente; 
      }
      
      // Chama a função do pai (PDV)
      onComandaAberta(numeroComanda, clienteParaPassar?.id, clienteParaPassar);
      // O fechamento do modal geralmente é feito pelo pai após sucesso, mas podemos forçar aqui se necessário
      // onClose(); 
      
    } catch (error: any) {
      console.error("Erro ao processar:", error);
      addToast(error.message || "Erro ao abrir comanda.", 'error');
    } finally {
        setLoading(false);
    }
  };

  // Footer customizado
  const modalFooter = (
    <>
      <button
        onClick={onClose}
        className="px-5 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
        disabled={loading}
      >
        Cancelar
      </button>
      
      {!modoNovoCliente && !clienteSelecionado ? (
          <button
            onClick={() => onComandaAberta(numeroComanda)}
            className="px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 flex items-center gap-2 transition-all"
            disabled={loading}
          >
            Abrir sem Cliente
          </button>
      ) : (
          <button
            onClick={handleAbrirComanda}
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
            {modoNovoCliente ? 'Cadastrar e Abrir' : 'Confirmar Abertura'}
          </button>
      )}
    </>
  );
  
  return (
    <Modal
      title={`Abrir Comanda #${numeroComanda}`}
      onClose={onClose}
      footer={modalFooter}
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        
        {/* Toggle Mode */}
        {!modoNovoCliente ? (
          <div className="space-y-4 animate-[fade-in_0.2s]">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Vincular Cliente
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista de Resultados */}
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50 p-1">
              {clientesFiltrados.length === 0 ? (
                  <p className="text-center text-slate-400 py-4 text-sm">Nenhum cliente encontrado.</p>
              ) : (
                  clientesFiltrados.map(cliente => (
                    <button
                      key={cliente.id}
                      onClick={() => setClienteSelecionado(cliente)}
                      className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                          clienteSelecionado?.id === cliente.id 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'hover:bg-white hover:shadow-sm text-slate-700'
                      }`}
                    >
                      <div>
                          <p className="font-bold text-sm">{cliente.nome}</p>
                          <p className={`text-xs ${clienteSelecionado?.id === cliente.id ? 'text-indigo-200' : 'text-slate-400'}`}>{cliente.telefone || 'Sem telefone'}</p>
                      </div>
                      {clienteSelecionado?.id === cliente.id && <CheckCircle size={16} />}
                    </button>
                  ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
                <button
                onClick={() => setModoNovoCliente(true)}
                className="w-full py-3 flex items-center justify-center gap-2 text-indigo-600 font-semibold bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-100"
                >
                <UserPlus size={18} />
                Cadastrar Novo Cliente
                </button>
            </div>
          </div>
        ) : (
          /* MODO CADASTRO */
          <div className="space-y-4 animate-[fade-in_0.2s]">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 mb-4 flex items-start gap-3">
                <div className="p-2 bg-white rounded-full text-indigo-600 shadow-sm">
                    <UserPlus size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-indigo-900">Novo Cadastro</h4>
                    <p className="text-sm text-indigo-700">Este cliente será salvo automaticamente.</p>
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                type="text"
                value={novoClienteNome}
                onChange={(e) => setNovoClienteNome(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Ex: João Silva"
                autoFocus
                />
            </div>
            
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Telefone (Opcional)</label>
                <input
                type="text"
                value={novoClienteTelefone}
                onChange={(e) => setNovoClienteTelefone(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="(00) 00000-0000"
                />
            </div>

            <button
              onClick={() => setModoNovoCliente(false)}
              className="text-sm text-slate-500 hover:text-slate-800 underline block mx-auto mt-2"
            >
              Voltar para a busca
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};