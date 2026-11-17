import { defineConfig } from 'vite';

// Front end: Vite dev server on :5173, proxies /api to the Node API server on :8787.
export default defineConfig({
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: { manualChunks: { supabase: ['@supabase/supabase-js'] } },
    },
  },
});
