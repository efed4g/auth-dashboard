import { configureStore, isRejectedWithValue } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from '../features/auth/authApi';
import authReducer, { sessionCleared } from '../features/auth/authSlice';

/**
 * Oturumu sonlandıran hataları yakalayan middleware.
 *
 * Buraya ulaşan 401, baseQuery'nin yenileme denemesinin de başarısız olduğu
 * anlamına geliyor. 403 bilerek kapsam dışı: normal kullanıcının admin ucuna
 * erişememesi de 403 dönüyor ve bu bir oturum sorunu değil.
 */
const sessionExpiryMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  if (isRejectedWithValue(action) && action.payload?.status === 401) {
    // Durum kontrolü gereksiz dispatch'i ve yeniden render'ı önlüyor.
    if (store.getState().auth.status === 'authenticated') {
      store.dispatch(sessionCleared());
    }
  }

  return result;
};

export const store = configureStore({
  reducer: {
    // API önbelleği ve oturum durumu ayrı: biri sunucu verisini, diğeri
    // yalnızca "kim giriş yapmış" bilgisini yönetiyor.
    [api.reducerPath]: api.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware, sessionExpiryMiddleware),
});

// Sekme yeniden odaklandığında veya bağlantı geri geldiğinde veriyi tazelemek için.
setupListeners(store.dispatch);
