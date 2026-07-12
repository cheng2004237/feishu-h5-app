import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 本地开发时使用 `npm run dev:feishu` 启动 Vercel CLI（它会处理 api/* 和前端）
// 或使用 `npm run dev` 启动纯前端（api 调用会失败）
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
})