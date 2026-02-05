import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

// Configuração para __dirname em módulos ES (Necessário no Node moderno)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  // 1. Caminho Base Relativo: CRUCIAL para Electron (evita tela branca)
  base: './',

  plugins: [
    react(),
    electron({
      main: {
        // Entrada do processo principal
        entry: 'electron/main.ts',
      },
      preload: {
        // Entrada do script de preload
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                // 2. Forçar formato CJS (CommonJS) para o Preload
                // O Electron tem suporte limitado a ESM no preload em alguns casos.
                // Usar .cjs resolve erros de "require is not defined" ou falhas de carregamento.
                format: 'cjs',
                entryFileNames: 'preload.cjs', 
              },
            },
          },
        },
      },
      // Habilita a integração no processo de renderização (React)
      renderer: {},
    }),
  ],

  resolve: {
    alias: {
      // Atalho para importar arquivos da pasta src (ex: '@/components/...')
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    // Configurações de build do Vite (Front-end)
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Dependências que não devem ser empacotadas pelo Vite (geralmente nativas)
      external: [
        'better-sqlite3', // Se você usar banco local nativo no futuro
        // 'serialport', // Exemplo: se usar impressora térmica via serial
      ],
    },
  },
});