// src/hooks/useOnlineStatus.ts
import { useState, useEffect, useCallback } from 'react';

/**
 * Verifica se há conexão REAL com a internet.
 * Tenta fazer um ping leve. Se falhar (DNS, Timeout, Bloqueio), retorna false.
 */
export const checkConnection = async (timeout = 3000): Promise<boolean> => {
  // Se o navegador já diz nativamente que não tem rede, nem perdemos tempo tentando.
  if (!navigator.onLine) return false;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    // Ping leve no Google. 
    // mode: 'no-cors' é vital: evita erros de CORS em localhost/app:// e 
    // foca apenas se houve erro de REDE (catch) ou sucesso no transporte (try).
    await fetch('https://www.google.com/favicon.ico', { 
        method: 'HEAD', 
        signal: controller.signal,
        mode: 'no-cors',
        cache: 'no-store'
    });
    
    clearTimeout(id);
    return true;
  } catch (e) {
    // Se caiu aqui, é falha de DNS, Timeout ou Rede inalcançável.
    return false;
  }
};

export function useOnlineStatus() {
  // OFFLINE-FIRST: Inicia false para forçar renderização local imediata.
  const [isOnline, setIsOnline] = useState<boolean>(false);

  const verify = useCallback(async () => {
    const status = await checkConnection();
    // Só atualiza o estado se houver mudança real
    setIsOnline(prev => prev !== status ? status : prev);
  }, []);

  useEffect(() => {
    // 1. Verificação Imediata ao montar
    verify();

    // 2. Listeners Nativos (Reage rápido a cabo desconectado/conectado)
    const handleOnline = () => verify(); // Mesmo se o navegador disser que voltou, conferimos com ping
    const handleOffline = () => setIsOnline(false); // O evento offline do navegador é confiável

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Polling de Segurança (A cada 10s valida a conexão real)
    const interval = setInterval(verify, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [verify]);

  return { isOnline };
}