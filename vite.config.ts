import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 在开发模式下,将 chatkit 指向本地构建的 dist 目录
      'chatkit': path.resolve(__dirname, './dist/chatkit.es.js'),
    },
  },
  server: {
    proxy: {
      // 将本地 /data-agent 前缀的请求代理到 Data Agent 服务,解决本地开发时的 CORS
      '/data-agent': {
        target: 'https://dip.aishu.cn:443/api/agent-app/v1',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/data-agent/, ''),
      },
      // 将本地 /api 前缀的请求代理到 AISHU 服务,用于 agent-factory API
      '/api': {
        target: 'https://dip.aishu.cn:443',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
