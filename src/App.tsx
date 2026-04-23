// src/App.tsx
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout e Autenticação
import { Sidebar } from './components/Layout/Sidebar';
import LoginForm from './components/Auth/LoginForm';
import { PrivateRoute } from './components/Auth/PrivateRoute';

// Componentes de Páginas
import { Dashboard } from './components/Dashboard/Dashboard';
import { PDV } from './components/PDV/PDV';
import { CaixaRapido } from './components/CaixaRapido/CaixaRapido';
import { Produtos } from './components/Produtos/Produtos';
import { Clientes } from './components/Clientes/Clientes';
import { Relatorios } from './components/Relatorios/Relatorios';
import { Historico } from './components/Historico/Historico';
import { Crediario } from './Crediario/Crediario';
import { LogsSistema } from './components/Logs/LogsSistema';

// Contextos
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './auth/AuthContext';
import { CaixaProvider } from './contexts/CaixaContext';
import { SyncProvider } from './contexts/SyncContext';

// Sistema de Assinatura e Realtime
import { assinaturaService, StatusAssinatura } from './services/assinatura';
import { TelaBloqueio } from './components/Subscription/TelaBloqueio';
import { supabase } from './lib/supabaseClient';

// --- COMPONENTE DE LAYOUT PROTEGIDO (Verifica a Assinatura em Tempo Real) ---
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assinatura, setAssinatura] = useState<StatusAssinatura | null>(null);
  const [checando, setChecando] = useState(true);

  useEffect(() => {
    // 1. Procura o status atual ao carregar
    const verificar = async () => {
      const status = await assinaturaService.verificarStatus();
      setAssinatura(status);
      setChecando(false);
    };
    verificar();

    // 2. Subscreve no canal Realtime para mudanças instantâneas no banco
    const assinaturaSubscription = supabase
      .channel('mudancas-assinatura')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'controle_assinatura' 
        },
        (payload) => {
          console.log('🔄 Status da assinatura alterado:', payload.new);
          setAssinatura(payload.new as StatusAssinatura);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assinaturaSubscription);
    };
  }, []);

  return (
    <>
      {/* Bloqueio sobrepõe tudo se a assinatura não estiver paga */}
      {!checando && assinatura && !assinatura.pago && (
        <TelaBloqueio 
          mensagem={assinatura.mensagem_bloqueio} 
          chavePix={assinatura.chave_pix} 
        />
      )}
      {children}
    </>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <SyncProvider>
          <CaixaProvider>
            <Router>
              <Routes>
                {/* Rota Pública */}
                <Route path="/login" element={<LoginForm />} />

                {/* Rotas Privadas e Protegidas */}
                <Route
                  path="/*"
                  element={
                    <PrivateRoute>
                      <AppLayout>
                        <div className="flex h-screen bg-black overflow-hidden selection:bg-blue-500/30">
                          <Sidebar />
                          
                          <main className="flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 relative">
                            <Routes>
                              <Route path="/" element={<Dashboard />} />
                              <Route path="/caixa-rapido" element={<CaixaRapido />} />
                              <Route path="/pdv" element={<PDV />} />
                              <Route path="/produtos" element={<Produtos />} />
                              <Route path="/clientes" element={<Clientes />} />
                              <Route path="/relatorios" element={<Relatorios />} />
                              <Route path="/historico" element={<Historico />} />
                              <Route path="/crediario" element={<Crediario />} /> 
                              <Route path="/logs" element={<LogsSistema />} />
                              
                              {/* Redirecionamento de rotas inexistentes */}
                              <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                          </main>
                        </div>
                      </AppLayout>
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