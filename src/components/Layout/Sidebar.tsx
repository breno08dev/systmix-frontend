import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart2, 
  LogOut, 
  Monitor, 
  Lock, 
  Unlock 
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useCaixa } from '../../contexts/CaixaContext';
import { ConfirmacaoModal } from '../Common/ConfirmacaoModal';

// Importação da Logo
import logo from '../../assets/logo-bar.png';

export const Sidebar: React.FC = () => {
  const { signOut, session } = useAuth();
  const { caixaAberto } = useCaixa();
  const navigate = useNavigate();
  const [modalSairOpen, setModalSairOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/caixa-rapido', icon: ShoppingCart, label: 'Caixa Rápido' },
    { path: '/pdv', icon: Monitor, label: 'Comandas / Mesas' },
    { path: '/produtos', icon: Package, label: 'Produtos' },
    { path: '/clientes', icon: Users, label: 'Clientes' },
    { path: '/relatorios', icon: BarChart2, label: 'Relatórios' },
  ];

  return (
    <>
      <aside className="w-64 bg-slate-900 h-screen flex flex-col text-slate-300 transition-all duration-300 shadow-xl z-20 hidden md:flex">
        
        {/* Logo / Header Centralizado */}
        <div className="p-8 flex flex-col items-center justify-center border-b border-slate-800">
          <img 
            src={logo} 
            alt="Logo Sistema" 
            className="w-24 h-24 rounded-2xl object-cover shadow-2xl shadow-indigo-900/50 bg-slate-800 mb-4 hover:scale-105 transition-transform duration-300"
          />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest text-center">
            Gestão Comercial
          </p>
        </div>

        {/* Status do Caixa (Widget) */}
        <div className="px-6 py-4">
          <div className={`p-3 rounded-xl border flex items-center gap-3 ${
            caixaAberto 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            <div className={`p-1.5 rounded-lg ${caixaAberto ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
               {caixaAberto ? <Unlock size={16} /> : <Lock size={16} />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Status do Caixa</p>
              <p className="text-sm font-bold text-white">{caixaAberto ? 'ABERTO' : 'FECHADO'}</p>
            </div>
          </div>
        </div>

        {/* Menu de Navegação */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar-dark py-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium
                ${isActive 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 translate-x-1' 
                  : 'hover:bg-slate-800 hover:text-white'
                }
              `}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Rodapé / User Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
           <button 
             onClick={() => setModalSairOpen(true)}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all group"
           >
             <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
             <div className="flex-1 text-left">
                 <p className="text-sm font-medium text-slate-200 group-hover:text-rose-400">Sair do Sistema</p>
                 <p className="text-xs text-slate-500 truncate max-w-[120px]">{session?.user?.email || 'Usuario'}</p>
             </div>
           </button>
        </div>
      </aside>

      {/* Modal de Confirmação de Logout */}
      <ConfirmacaoModal
        isOpen={modalSairOpen}
        onClose={() => setModalSairOpen(false)}
        onConfirm={handleLogout}
        title="Sair do Sistema"
        message="Tem certeza que deseja encerrar sua sessão?"
        tipo="perigo"
      />
    </>
  );
};