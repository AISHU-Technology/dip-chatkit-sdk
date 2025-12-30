import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

/**
 * Vite 配置 - 用于构建 ChatKit 组件库
 *
 * 此配置用于将 ChatKit 组件库构建为可发布的 npm 包
 * CSS 会自动内联到 JS 中，使用者无需单独引入 CSS 文件
 */
export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      // 入口文件
      entry: resolve(__dirname, 'src/index.ts'),
      // 库名称
      name: 'ChatKit',
      // 输出文件名格式
      fileName: (format) => `chatkit.${format}.js`,
      // 输出格式
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: ['react', 'react-dom', 'react-markdown', 'rehype-highlight', 'remark-gfm'],
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    // 输出目录
    outDir: 'dist',
    // 清空输出目录
    emptyOutDir: true,
    // CSS 配置：将 CSS 内联到 JS 中，这样使用者无需单独引入 CSS
    cssCodeSplit: false,
    cssMinify: true,
  },
});
