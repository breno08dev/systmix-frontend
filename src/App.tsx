// src/App.tsx
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { Sidebar } from './components/Layout/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { PDV } from './components/PDV/PDV';
import { CaixaRapido } from './components/CaixaRapido/CaixaRapido';
import { Produtos } from './components/Produtos/Produtos';
import { Clientes } from './components/Clientes/Clientes';
import { Relatorios } from './components/Relatorios/Relatorios';
import { Historico } from './components/Historico/Historico';
import LoginForm from './components/Auth/LoginForm';
import { PrivateRoute } from './components/Auth/PrivateRoute';

import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './auth/AuthContext';
import { CaixaProvider } from './contexts/CaixaContext';
import { SyncProvider } from './contexts/SyncContext';

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <SyncProvider>
          <CaixaProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<LoginForm />} />

                <Route
                  path="/*"
                  element={
                    <PrivateRoute>
                      {/* ALTERADO AQUI: bg-black para fundo geral escuro */}
                      <div className="flex h-screen bg-black overflow-hidden selection:bg-blue-500/30">
                        <Sidebar />
                        
                        <main className="flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 relative">
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/pdv" element={<PDV />} />
                            <Route path="/caixa-rapido" element={<CaixaRapido />} />
                            <Route path="/produtos" element={<Produtos />} />
                            <Route path="/clientes" element={<Clientes />} />
                            <Route path="/relatorios" element={<Relatorios />} />
                            <Route path="/historico" element={<Historico />} />
                            
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