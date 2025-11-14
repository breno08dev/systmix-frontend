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
import { SyncProvider } from './contexts/SyncContext';
import { CaixaProvider } from './contexts/CaixaContext'; 
import { CaixaRapido } from './components/CaixaRapido/CaixaRapido'; // NOVO: Importar

// Componente interno que renderiza o conteúdo principal da aplicação
function AppContent() {
  const { user, signOut, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard />;
      case 'caixa-rapido': return <CaixaRapido />; // NOVO: Adicionar a rota
      case 'pdv': return <PDV />;
      case 'produtos': return <Produtos />;
      case 'clientes': return <Clientes />;
      case 'relatorios': return <Relatorios />;
      default: return <Dashboard />;
    }
  };

  if (loading) {
    // ... (tela de loading)
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
    <ToastProvider>
      <AuthProvider>
        <CaixaProvider>
          <SyncProvider>
            <AppContent />
          </SyncProvider>
        </CaixaProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;