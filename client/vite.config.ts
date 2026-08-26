import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @pierre/diffs の worker.js は ESM のため module worker として出力する
  worker: { format: 'es' },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
