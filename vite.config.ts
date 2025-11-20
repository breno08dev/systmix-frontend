// breno08dev/systmix-frontend/systmix-frontend-471c97e712d63187dfb793f5e0f55f2a9dbba1d9/vite.config.ts (ATUALIZADO)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

// Define __dirname para o contexto ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
      // CORREÇÃO ESSENCIAL AQUI:
      // Altera o nome de saída para '.cjs' para forçar CommonJS e resolver o erro.
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs', // Define o nome do arquivo de saída
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      // Adiciona alias para caminhos relativos
      '@': resolve(__dirname, 'src'),
    },
  },
  // O código abaixo garante que os módulos do Electron sejam tratados corretamente no build
  build: {
    rollupOptions: {
      external: [
        'better-sqlite3',
        // Adicione outras dependências nativas se necessário
      ],
    },
  },
});