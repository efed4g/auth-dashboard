import { configureStore, isRejectedWithValue } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from '../features/auth/authApi';
import authReducer, { sessionCleared } from '../features/auth/authSlice';

/**
 * Oturumu sonlandıran hataları yakalayan middleware.
 *
 * Bu noktaya ulaşan bir 401, baseQuery'nin yenileme denemesinin de
 * başarısız olduğu anlamına geliyor; yapılacak tek şey oturumu temizlemek.
 * Böylece ProtectedRoute kullanıcıyı giriş ekranına alıyor.
 *
 * 403 bilerek kapsam dışı: normal bir kullanıcının admin ucuna erişememesi
 * de 403 dönüyor ve bu bir oturum sorunu değil. Dahil edilseydi kullanıcı
 * yetkisi olmayan bir sayfaya girmeye çalıştığında sistemden atılırdı.
 */
const sessionExpiryMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  if (isRejectedWithValue(action) && action.payload?.status === 401) {
    // Durum kontrolü gereksiz dispatch'i önlüyor: zaten oturumu olmayan bir
    // kullanıcı için her 401'de state'i tekrar temizlemek yeniden render
    // tetiklerdi.
    if (store.getState().auth.status === 'authenticated') {
      store.dispatch(sessionCleared());
    }
  }

  return result;
};

export const store = configureStore({
  reducer: {
    // API önbelleği ve oturum durumu ayrı tutuluyor: biri sunucudan gelen
    // veriyi yönetiyor, diğeri yalnızca "kim giriş yapmış" bilgisini.
    [api.reducerPath]: api.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware, sessionExpiryMiddleware),
});

// Sekme yeniden odaklandığında veya bağlantı geri geldiğinde RTK Query'nin
// veriyi tazeleyebilmesi için gerekli.
setupListeners(store.dispatch);
