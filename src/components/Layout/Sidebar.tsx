import React from 'react';
import {
  Home,
  Receipt,
  Package,
  Users,
  BarChart3,
  LogOut,
  Wallet
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
  onLogout
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'caixa-rapido', label: 'Caixa Rápido', icon: Wallet },
    { id: 'pdv', label: 'Comandas', icon: Receipt },
    { id: 'produtos', label: 'Produtos', icon: Package },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  ];
  
  return (
    <aside className="w-72 bg-slate-900 text-white h-screen flex flex-col shadow-2xl z-10 sticky top-0">
      <div className="p-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
                C
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Conect New</h1>
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={`group w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 translate-x-1'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                  }`}
                >
                  <Icon 
                    size={20} 
                    className={`transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-slate-800 mx-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all duration-200 group"
        >
          <LogOut size={20} className="group-hover:text-red-400" />
          <span className="font-medium text-sm">Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
};