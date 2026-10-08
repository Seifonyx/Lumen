import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  server: {
    // During local development, forward API calls to a separately running API server.
    proxy: { '/api': 'http://localhost:5174' },
  },
});
