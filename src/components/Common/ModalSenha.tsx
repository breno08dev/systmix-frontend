// src/components/Common/ModalSenha.tsx
import React, { useState } from 'react';
import Modal from '../Shared/Modal';
import { Lock, AlertTriangle, UserCheck } from 'lucide-react';

interface ModalSenhaProps {
  isOpen: boolean;
  onClose: () => void;
  // Agora o sucesso retorna quem autorizou para podermos logar
  onSuccess: (usuario: { id: string; nome: string }) => void;
  titulo?: string;
  mensagem?: string;
}

// Configuração dos usuários conforme solicitado
const USUARIOS_GERENCIAIS = [
  { id: '001', nome: 'Giliard', senha: '2512' },
  { id: '002', nome: 'Miqueias', senha: '0012' }
];

export const ModalSenha: React.FC<ModalSenhaProps> = ({ 
  isOpen, onClose, onSuccess, titulo = 'Ação Restrita', mensagem = 'Selecione o usuário e digite a senha gerencial.' 
}) => {
  const [usuarioId, setUsuarioId] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);

  const handleConfirmar = () => {
    const user = USUARIOS_GERENCIAIS.find(u => u.id === usuarioId && u.senha === senha);
    
    if (user) {
      setSenha('');
      setUsuarioId('');
      setErro(false);
      onSuccess({ id: user.id, nome: user.nome });
      onClose();
    } else {
      setErro(true);
      setSenha('');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal title={titulo} onClose={onClose} maxWidth="max-w-sm">
      <div className="flex flex-col items-center p-4">
        <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mb-4">
          <Lock size={32} />
        </div>
        <p className="text-gray-300 text-center mb-6 text-sm">{mensagem}</p>
        
        <div className="w-full space-y-4">
          {/* Seletor de Usuário */}
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            className="w-full p-3 bg-black border border-[#172554] text-white rounded-xl focus:border-blue-500 outline-none"
          >
            <option value="">Selecione o Usuário</option>
            {USUARIOS_GERENCIAIS.map(u => (
              <option key={u.id} value={u.id}>{u.id} - {u.nome}</option>
            ))}
          </select>

          {/* Campo de Senha */}
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            className={`w-full p-3 bg-black border ${erro ? 'border-rose-500' : 'border-[#172554]'} text-white rounded-xl text-center text-2xl tracking-[0.5em] focus:border-blue-500 outline-none`}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmar()}
          />
        </div>

        {erro && (
          <p className="text-rose-500 text-xs mt-3 flex items-center gap-1">
            <AlertTriangle size={12}/> Credenciais incorretas!
          </p>
        )}
        
        <div className="w-full flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-3 border border-[#172554] text-white font-medium rounded-xl hover:bg-[#172554]">
            Cancelar
          </button>
          <button 
            onClick={handleConfirmar} 
            disabled={!usuarioId || !senha}
            className="flex-1 px-4 py-3 bg-rose-600 disabled:opacity-50 text-white font-bold rounded-xl hover:bg-rose-700"
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
};