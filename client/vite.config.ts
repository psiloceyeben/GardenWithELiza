import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './', // subpath-safe (prometheus7.com/pons/)
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@content': fileURLToPath(new URL('../content', import.meta.url)),
    },
  },
  // Development is accessed through an SSH tunnel, not a public listener.
  server: { host: '127.0.0.1', port: 5173, fs: { allow: ['..'] } },
  build: { outDir: 'dist', assetsInlineLimit: 0, target: 'es2020' },
});
