/**
 * React uygulamasının giriş noktası.
 *
 * StrictMode geliştirmede efektleri iki kez çalıştırıyor ve bu, aynı refresh
 * token'ın iki kez gönderilmesine yol açmıştı. Çözüm StrictMode'u kapatmak
 * değil, backend'de paralel yenilemeleri tolere etmek oldu
 * (bkz. session.service.js).
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
