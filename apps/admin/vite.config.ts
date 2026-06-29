import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
       '@/lib/format' : path.resolve(__dirname, './packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 3002,
    strictPort: true,
    host: true,
    // Bind mount Docker sous Windows: inotify ne traverse pas le mount,
    // le HMR ne se déclenche pas sans polling. Évite un docker restart à chaque modif.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
