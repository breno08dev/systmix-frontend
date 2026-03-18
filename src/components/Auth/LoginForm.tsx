import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import logoConect from '../../assets/conectnew.logo.png';
import { Lock, Mail, ArrowRight, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LoginForm: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 🔥 aqui está a correção
      await signIn(email, password);

      // Sucesso
      navigate('/');

    } catch (err: any) {
      console.error(err);

      if (err?.message?.includes('Invalid login credentials')) {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(err?.message || 'Erro ao conectar ao servidor.');
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/50 to-transparent -z-10" />

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 md:p-12 w-full max-w-md border border-slate-100">
        <div className="text-center mb-10">
          <div className="bg-slate-50 w-24 h-24 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-inner border border-slate-100">
            <img 
              src={logoConect}
              alt="Logo ConectNew" 
              className="w-20 h-auto object-contain" 
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bem-vindo de volta</h1>
          <p className="text-slate-500 mt-2">Acesse sua conta para gerenciar o sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">E-mail</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="••••••••"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-sm text-rose-600">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                Validando...
              </>
            ) : (
              <>
                Entrar no Sistema
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            &copy; 2026 ConectNew. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
