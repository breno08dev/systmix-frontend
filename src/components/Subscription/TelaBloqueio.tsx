// src/components/Subscription/TelaBloqueio.tsx
import React from 'react';
import { Lock, AlertTriangle, Copy, Check } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface TelaBloqueioProps {
  mensagem: string;
  chavePix: string;
}

export const TelaBloqueio: React.FC<TelaBloqueioProps> = ({ mensagem, chavePix }) => {
  const [copiado, setCopiado] = React.useState(false);
  const { addToast } = useToast();

  const handleCopiarPix = () => {
    navigator.clipboard.writeText(chavePix);
    setCopiado(true);
    addToast('Chave PIX copiada!', 'success');
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-900/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 blur-[120px] rounded-full" />

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-[32px] shadow-2xl text-center relative z-10">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
          <Lock size={40} />
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">Acesso Suspenso</h1>
        
        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl mb-8">
          <p className="text-slate-400 text-sm leading-relaxed">
            {mensagem}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pagamento via PIX</p>
          
          <button 
            onClick={handleCopiarPix}
            className="w-full group flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-rose-500/50 transition-all"
          >
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Chave PIX</span>
              <span className="text-white font-mono truncate w-full">{chavePix}</span>
            </div>
            <div className="p-2 bg-slate-900 rounded-lg text-rose-500">
              {copiado ? <Check size={18} /> : <Copy size={18} />}
            </div>
          </button>

          <div className="flex items-center gap-2 justify-center text-amber-500 bg-amber-500/5 py-3 rounded-xl border border-amber-500/10">
            <AlertTriangle size={16} />
            <span className="text-xs font-medium">Após pagar, o sistema libera automaticamente em instantes.</span>
          </div>
        </div>
      </div>
    </div>
  );
};