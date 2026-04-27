import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '',
  server: {
    origin: 'http://localhost:5173',
    cors: true,
  },
  plugins: [
    react(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    manifest: true,
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    }
  }
});
