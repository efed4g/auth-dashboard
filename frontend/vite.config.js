import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // loadEnv, mode'a göre .env.development veya .env.production dosyasını okur.
  // Üçüncü parametre boş dize: normalde yalnızca VITE_ ile başlayanlar gelir,
  // burada yapılandırma dosyasının kendisi için hepsine erişmek istiyoruz.
  // Port değerini buradan almak, adreslerin tek yerden yönetilmesini sağlıyor.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_PORT || 3000),
      // strictPort: port doluysa Vite sessizce başka bir porta kaymasın.
      // Kayarsa backend'in CORS izin listesindeki adres tutmaz ve hata
      // "CORS sorunu" gibi görünüp asıl sebebi gizler.
      strictPort: true,
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT || env.VITE_PORT || 3000),
    },
    build: {
      outDir: 'dist',
      // Source map yalnızca development/preview için. Production paketinde
      // kaynak kodun tamamını yayınlamanın gereği yok.
      sourcemap: mode !== 'production',
    },
  };
});
