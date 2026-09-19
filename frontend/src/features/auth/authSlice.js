/**
 * Oturum durumu.
 *
 * Burada token TUTULMUYOR, tutulamaz da: token httpOnly cookie'de ve
 * JavaScript'in erişimine kapalı. Saklanan şey yalnızca sunucunun döndüğü
 * kullanıcı bilgisi (kim, hangi rol) ve oturumun hangi aşamada olduğu.
 *
 * status neden dört değerli: "kullanıcı yok" ile "henüz bilmiyoruz" farklı
 * durumlar. İkisi tek bir null ile temsil edilseydi, sayfa ilk açıldığında
 * cevap gelmeden kullanıcı giriş ekranına yönlendirilirdi.
 *   idle          -> henüz sorulmadı
 *   loading       -> soruldu, cevap bekleniyor
 *   authenticated -> geçerli oturum var
 *   anonymous     -> oturum yok
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
  /**
   * Durum, API isteklerinin sonucundan türetiliyor.
   *
   * Her bileşende "istek başarılıysa state'i güncelle" yazmak yerine
   * matcher'larla merkezi olarak dinlemek, bir yerde güncellemeyi unutma
   * ihtimalini ortadan kaldırıyor.
   */
  extraReducers: (builder) => {
    builder
      // Yalnızca ilk sorguda loading'e geçiliyor. Sonraki tazelemelerde de
      // geçseydi, arka planda veri yenilenirken ekran boşalırdı.
      .addMatcher(api.endpoints.getMe.matchPending, (state) => {
        if (state.status === 'idle') state.status = 'loading';
      })
      .addMatcher(api.endpoints.getMe.matchFulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.status = 'authenticated';
      })
      // /auth/me başarısız oldu: baseQuery yenilemeyi de denedi ve olmadı.
      // Bu noktada oturum gerçekten yok demektir.
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
