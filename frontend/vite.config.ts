import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/tax/',
  server: {
    port: 5173,
    proxy: {
      // In dev the frontend is served at /tax/ (base) and calls /tax/api/...
      // Strip the /tax prefix before forwarding to the local Worker on port 8787.
      '/tax/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/tax/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
