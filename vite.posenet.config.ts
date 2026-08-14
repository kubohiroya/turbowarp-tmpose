import {defineConfig} from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/posenet.ts',
      formats: ['es'],
      fileName: () => 'posenet.js'
    },
    minify: false,
    sourcemap: false,
    target: 'es2022'
  }
});
