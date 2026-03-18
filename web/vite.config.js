import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0
      },
      '/uploads': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0
      }
    }
  }
});
