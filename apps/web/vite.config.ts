import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API_PROXY_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:8000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/v1': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    proxy: {
      '/v1': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
