/**
 * Oturum durumu.
 *
 * Token burada TUTULMUYOR, tutulamaz da: httpOnly cookie'de ve JavaScript'in
 * erişimine kapalı. Saklanan şey kullanıcı bilgisi ve oturumun aşaması.
 *
 * status dört değerli çünkü "kullanıcı yok" ile "henüz bilmiyoruz" farklı:
 *   idle → henüz sorulmadı, loading → cevap bekleniyor,
 *   authenticated → geçerli oturum, anonymous → oturum yok
 */
import { createSlice } from '@reduxjs/toolkit';
import { api } from './authApi';

const initialState = {
  user: null,
  status: 'idle',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Oturumun dışarıdan (store middleware'i) sonlandırılması için.
    sessionCleared(state) {
      state.user = null;
      state.status = 'anonymous';
    },
  },
  // Durum API sonuçlarından türetiliyor: her bileşende elle güncellemek
  // yerine matcher'larla tek yerden dinleniyor.
  extraReducers: (builder) => {
    builder
      // Yalnızca ilk sorguda loading: sonraki tazelemelerde de geçseydi arka
      // planda veri yenilenirken ekran boşalırdı.
      .addMatcher(api.endpoints.getMe.matchPending, (state) => {
        if (state.status === 'idle') state.status = 'loading';
      })
      .addMatcher(api.endpoints.getMe.matchFulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.status = 'authenticated';
      })
      // baseQuery yenilemeyi de denedi ve olmadı: oturum gerçekten yok.
      .addMatcher(api.endpoints.getMe.matchRejected, (state) => {
        state.user = null;
        state.status = 'anonymous';
      })
      .addMatcher(api.endpoints.login.matchFulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.status = 'authenticated';
      })
      .addMatcher(api.endpoints.loginWithGoogle.matchFulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.status = 'authenticated';
      })
      .addMatcher(api.endpoints.logout.matchFulfilled, (state) => {
        state.user = null;
        state.status = 'anonymous';
      })
      .addMatcher(api.endpoints.logoutAll.matchFulfilled, (state) => {
        state.user = null;
        state.status = 'anonymous';
      });
  },
});

export const { sessionCleared } = authSlice.actions;

export const selectUser = (state) => state.auth.user;
export const selectAuthStatus = (state) => state.auth.status;
export const selectIsAuthenticated = (state) => state.auth.status === 'authenticated';

export default authSlice.reducer;
