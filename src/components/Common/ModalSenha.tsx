import React, { useState } from 'react';
import Modal from '../Shared/Modal';
import { Lock, AlertTriangle } from 'lucide-react';

interface ModalSenhaProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  titulo?: string;
  mensagem?: string;
}

export const ModalSenha: React.FC<ModalSenhaProps> = ({ 
  isOpen, onClose, onSuccess, titulo = 'Ação Restrita', mensagem = 'Digite a senha gerencial para continuar.' 
}) => {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);

  const handleConfirmar = () => {
    if (senha === '123321') {
      setSenha('');
      setErro(false);
      onSuccess();
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
        
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          className={`w-full p-3 bg-black border ${erro ? 'border-rose-500' : 'border-[#172554]'} text-white rounded-xl text-center text-2xl tracking-[0.5em] focus:border-blue-500 outline-none`}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleConfirmar()}
        />
        {erro && <p className="text-rose-500 text-xs mt-2 flex items-center gap-1"><AlertTriangle size={12}/> Senha incorreta!</p>}
        
        <div className="w-full flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-3 border border-[#172554] text-white font-medium rounded-xl hover:bg-[#172554]">
            Cancelar
          </button>
          <button onClick={handleConfirmar} className="flex-1 px-4 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700">
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
};