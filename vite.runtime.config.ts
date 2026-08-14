import {defineConfig} from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/runtime.ts',
      formats: ['iife'],
      name: 'TMPoseBrowserRuntime',
      fileName: () => 'runtime.js'
    },
    minify: 'esbuild',
    sourcemap: false,
    target: 'es2022'
  }
});
