import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Bolt preview serves the app at `/`; GitHub Pages serves it under `/bolt/`.
  base: command === 'build' ? '/bolt/' : '/'
}));
