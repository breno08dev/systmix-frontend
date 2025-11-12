
import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { PDV } from './components/PDV/PDV';
import { Produtos } from './components/Produtos/Produtos';
import { Clientes } from './components/Clientes/Clientes';
import { Relatorios } from './components/Relatorios/Relatorios';
import { LoginForm } from './components/Auth/LoginForm';
import { ToastProvider } from './contexts/ToastContext';

// Componente interno que renderiza o conteúdo principal da aplicação
function AppContent() {
  const { user, signOut, loading } = useAuth();
  // Corrigido para usar 'useState' diretamente, que é uma prática mais comum
  const [activeSection, setActiveSection] = useState('dashboard');

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'pdv': return <PDV />;
      case 'produtos': return <Produtos />;
      case 'clientes': return <Clientes />;
      case 'relatorios': return <Relatorios />;
      default: return <Dashboard />;
    }
  };

  // Tela de carregamento enquanto a sessão é verificada
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <LoginForm />
      ) : (
        <div className="flex h-screen bg-gray-100">
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onLogout={signOut}
          />
          <main className="flex-1 overflow-y-auto">
            {renderContent()}
          </main>
        </div>
      )}
    </>
  );
}

// Componente principal que organiza os Provedores de Contexto
function App() {
  return (
    // O ToastProvider deve envolver o AuthProvider para que as notificações
    // estejam disponíveis em toda a aplicação, incluindo na lógica de login.
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;