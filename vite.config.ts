// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Arquivo principal do Electron (Main Process)
        entry: 'electron/main.ts',
      },
      {
        // Script de Preload
        entry: 'electron/preload.ts',
        onstart(options) {
          // Garante que o script de preload seja recarregado
          options.reload();
        },
      },
    ]),
    renderer(),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});