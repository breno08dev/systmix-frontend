// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './auth/AuthContext'
import { SyncProvider } from './contexts/SyncContext' // <--- Importante

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <SyncProvider> {/* <--- O SyncProvider deve envolver o App */}
          <App />
        </SyncProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>,
)