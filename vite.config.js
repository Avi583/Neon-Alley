import { defineConfig } from 'vite';

// base: './' makes every asset path relative, so the build works on
// GitHub Pages under any repository name (https://you.github.io/<repo>/).
export default defineConfig({
  base: './',
  build: {
    // Output to docs/ so GitHub Pages can serve it straight from the main branch.
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
