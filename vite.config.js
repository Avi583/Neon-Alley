import { defineConfig } from 'vite';

// base: './' makes every asset path relative, so the build works on
// GitHub Pages under any repository name (https://you.github.io/<repo>/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
