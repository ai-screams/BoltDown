import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import pkg from './package.json' with { type: 'json' }

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  // Path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },

  // Development server
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },

  // Production build
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          // Code splitting for better caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-codemirror': [
            '@codemirror/view',
            '@codemirror/state',
            '@codemirror/lang-markdown',
          ],
          'vendor-ui': ['clsx', 'lucide-react', 'react-arborist', 'zustand'],
          'vendor-prism': ['prismjs'],
          'vendor-sanitize': ['dompurify'],
          'vendor-markdown': ['markdown-it', 'katex'],
          'vendor-mermaid': ['mermaid'], // Lazy loaded
        },
      },
    },
    // Chunk size warning limit (500kb)
    chunkSizeWarningLimit: 1000,
  },

  // Environment variables
  envPrefix: ['VITE_', 'TAURI_'],

  // Clear screen on rebuild
  clearScreen: false,
})
