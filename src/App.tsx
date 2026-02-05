// src/App.tsx
import React from 'react';
// CORREÇÃO CRÍTICA: Usar HashRouter no lugar de BrowserRouter para Electron
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- COMPONENTES ---
import { Sidebar } from './components/Layout/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { PDV } from './components/PDV/PDV';
import { CaixaRapido } from './components/CaixaRapido/CaixaRapido';
import { Produtos } from './components/Produtos/Produtos';
import { Clientes } from './components/Clientes/Clientes';
import { Relatorios } from './components/Relatorios/Relatorios';
import LoginForm from './components/Auth/LoginForm';
import { PrivateRoute } from './components/Auth/PrivateRoute';

// --- CONTEXTOS (Providers) ---
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './auth/AuthContext';
import { CaixaProvider } from './contexts/CaixaContext';
import { SyncProvider } from './contexts/SyncContext';

const App: React.FC = () => {
  return (
    // 1. Toast (Notificações) envolve tudo para ser acessível globalmente
    <ToastProvider>
      
      {/* 2. Auth (Login) fornece o estado de autenticação */}
      <AuthProvider>
        
        {/* 3. Sync (Sincronização) gerencia o offline/online */}
        <SyncProvider>
          
          {/* 4. Caixa (Dados financeiros) */}
          <CaixaProvider>
            
            {/* CORREÇÃO: Router configurado para Hash (Compatível com .exe) */}
            <Router>
              <Routes>
                {/* Rota Pública: Login */}
                <Route path="/login" element={<LoginForm />} />

                {/* Rotas Privadas: Exigem Login */}
                <Route
                  path="/*"
                  element={
                    <PrivateRoute>
                      <div className="flex h-screen bg-slate-50 overflow-hidden">
                        {/* Sidebar Fixa */}
                        <Sidebar />
                        
                        {/* Área de Conteúdo com Scroll Independente */}
                        <main className="flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 relative">
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/pdv" element={<PDV />} />
                            <Route path="/caixa-rapido" element={<CaixaRapido />} />
                            <Route path="/produtos" element={<Produtos />} />
                            <Route path="/clientes" element={<Clientes />} />
                            <Route path="/relatorios" element={<Relatorios />} />
                            
                            {/* Redirecionamento para Dashboard se a rota não existir */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </main>
                      </div>
                    </PrivateRoute>
                  }
                />
              </Routes>
            </Router>

          </CaixaProvider>
        </SyncProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;