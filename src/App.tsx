// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// --- COMPONENTES ---
import { Sidebar } from './components/Layout/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { PDV } from './components/PDV/PDV';
import { CaixaRapido } from './components/CaixaRapido/CaixaRapido';
import { Produtos } from './components/Produtos/Produtos';
import { Clientes } from './components/Clientes/Clientes';
import { Relatorios } from './components/Relatorios/Relatorios';
import LoginForm from './components/Auth/LoginForm';
import { PrivateRoute } from './components/Auth/PrivateRoute'; // Agora existe!

// --- CONTEXTOS (Providers) ---
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './auth/AuthContext';
import { CaixaProvider } from './contexts/CaixaContext';
import { SyncProvider } from './contexts/SyncContext';

const App: React.FC = () => {
  return (
    // 1. Toast (Notificações) fica por fora de tudo
    <ToastProvider>
      
      {/* 2. Auth (Login) envolve o sistema */}
      <AuthProvider>
        
        {/* 3. Sync (Sincronização) */}
        <SyncProvider>
          
          {/* 4. Caixa (Dados financeiros) */}
          <CaixaProvider>
            
            <BrowserRouter>
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
                        
                        {/* Área de Conteúdo com Scroll */}
                        <main className="flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300">
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/pdv" element={<PDV />} />
                            <Route path="/caixa-rapido" element={<CaixaRapido />} />
                            <Route path="/produtos" element={<Produtos />} />
                            <Route path="/clientes" element={<Clientes />} />
                            <Route path="/relatorios" element={<Relatorios />} />
                            
                            {/* Rota padrão para erros 404 */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </main>
                      </div>
                    </PrivateRoute>
                  }
                />
              </Routes>
            </BrowserRouter>

          </CaixaProvider>
        </SyncProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;