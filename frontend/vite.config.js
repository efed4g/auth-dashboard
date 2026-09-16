import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Port sabit yazılmak yerine .env.<mode> dosyasından okunur.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_PORT || 3000),
      strictPort: true,
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT || env.VITE_PORT || 3000),
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
  };
});
