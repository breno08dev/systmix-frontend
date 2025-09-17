// src/App.tsx
import React from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { PDV } from './components/PDV/PDV';
import { Produtos } from './components/Produtos/Produtos';
import { Clientes } from './components/Clientes/Clientes';
import { Relatorios } from './components/Relatorios/Relatorios';
import { LoginForm } from './components/Auth/LoginForm';
import { ToastProvider } from './contexts/ToastContext';

function AppContent() {
  const { user, signOut, loading } = useAuth();
  const [activeSection, setActiveSection] = React.useState('dashboard');

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

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;