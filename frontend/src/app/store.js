import { configureStore, isRejectedWithValue } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from '../features/auth/authApi';
import authReducer, { sessionCleared } from '../features/auth/authSlice';

/**
 * 401 gelirse otomatik yenileme de başarısız olmuştur, oturum temizlenir.
 * 403 kapsam dışı: normal kullanıcının admin ucuna erişememesi de 403'tür.
 */
const sessionExpiryMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  if (isRejectedWithValue(action) && action.payload?.status === 401) {
    if (store.getState().auth.status === 'authenticated') {
      store.dispatch(sessionCleared());
    }
  }

  return result;
};

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware, sessionExpiryMiddleware),
});

setupListeners(store.dispatch);
