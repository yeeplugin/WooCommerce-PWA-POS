import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/sw.js',
      fileName: () => 'sw.js',
      formats: ['es']
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
