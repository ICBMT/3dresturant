import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    fs: { strict: false },
    headers: {
      // keep preview embedding happy
      'Access-Control-Allow-Origin': '*',
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0, // never inline the 27 MB glb
    chunkSizeWarningLimit: 4096,
  },
});
