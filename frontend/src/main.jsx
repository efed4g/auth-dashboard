/**
 * React uygulamasının giriş noktası.
 *
 * Provider en dışta duruyor ki uygulamanın her yerinden store'a erişilebilsin.
 *
 * StrictMode geliştirmede efektleri iki kez çalıştırıyor. Bu, oturum yenileme
 * akışında gerçek bir soruna yol açtı: aynı refresh token iki kez gönderilince
 * ikinci istek "çalınmış token" sanılıyordu. Çözümü StrictMode'u kapatmak
 * değil, backend tarafında paralel yenilemeleri tolere etmek oldu
 * (bkz. session.service.js). Böylece hata gerçek dünyada da ortaya çıkabilecek
 * bir yarış durumu olarak düzeltilmiş oldu.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './app/store';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);
