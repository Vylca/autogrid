import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'src'),
  base: './',
  plugins: [vue()],
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    target: 'chrome130',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        print: resolve(__dirname, 'src/print.html'),
      },
    },
  },
});
