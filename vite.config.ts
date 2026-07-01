import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  if (mode === 'plugin') {
    return {
      plugins: [],
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'src/plugin/main.ts'),
          name: 'main',
          fileName: 'main',
          formats: ['iife'],
        },
        rollupOptions: {
          output: {
            entryFileNames: 'main.js',
          },
        },
      },
    }
  }

  return {
    plugins: [react(), viteSingleFile()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
  }
})
