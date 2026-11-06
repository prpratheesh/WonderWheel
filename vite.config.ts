import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ClassSpin uses hash-based routing and a relative base path ("./"), so the
 * build works from any GitHub Pages repository path (e.g. /my-repo/) without
 * hardcoding the repository name. Set VITE_BASE to override if needed.
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [
    react(),
    {
      // GitHub Pages serves 404.html for unknown paths; mirror index.html so
      // any deep link still boots the SPA.
      name: 'classspin-spa-404',
      apply: 'build',
      closeBundle() {
        const dist = resolve(process.cwd(), 'dist');
        const index = resolve(dist, 'index.html');
        if (existsSync(index)) copyFileSync(index, resolve(dist, '404.html'));
      },
    },
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
