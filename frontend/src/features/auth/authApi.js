/**
 * API uçlarının tanımı (RTK Query).
 *
 * Bileşenler fetch çağırmıyor; buradan üretilen hook'ları kullanıyorlar.
 * RTK Query yükleniyor/hata durumlarını ve önbelleği kendisi yönettiği için
 * her sayfada aynı useState/useEffect kalıbını tekrar yazmaya gerek kalmıyor.
 *
 * Tag mantığı: query'ler bir etiket "sağlıyor", mutation'lar aynı etiketi
 * "geçersiz kılıyor". Örneğin giriş yapıldığında Session etiketi geçersiz
 * olunca /auth/me kendiliğinden yeniden çekiliyor; hangi veriyi ne zaman
 * tazeleyeceğimizi elle takip etmemiz gerekmiyor.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../app/baseQuery';

export const api = createApi({
  reducerPath: 'api',
  // CSRF ve otomatik oturum yenileme bu katmanda hallediliyor.
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Session', 'Dashboard', 'Users'],
  endpoints: (builder) => ({
    // Oturumdaki kullanıcı. Uygulama açılışında çağrılıyor.
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['Session'],
    }),

    // Kayıt oturum açmıyor (e-posta doğrulaması gerekiyor), bu yüzden
    // geçersiz kılınacak bir önbellek de yok.
    register: builder.mutation({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),

    login: builder.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      invalidatesTags: ['Session', 'Dashboard'],
    }),

    loginWithGoogle: builder.mutation({
      query: (idToken) => ({ url: '/auth/google', method: 'POST', body: { idToken } }),
      invalidatesTags: ['Session', 'Dashboard'],
    }),

    // Çıkışta Users da geçersiz kılınıyor: admin çıkış yapıp başka bir
    // hesapla girdiğinde önceki kullanıcı listesi ekranda kalmasın.
    logout: builder.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Session', 'Dashboard', 'Users'],
    }),

    logoutAll: builder.mutation({
      query: () => ({ url: '/auth/logout-all', method: 'POST' }),
      invalidatesTags: ['Session', 'Dashboard', 'Users'],
    }),

    forgotPassword: builder.mutation({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),

    resetPassword: builder.mutation({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
      invalidatesTags: ['Session'],
    }),

    // Google ile açılmış hesaba şifre ekler, şifresi olanda değiştirir.
    // Session geçersiz kılınıyor çünkü hasPassword bilgisi değişiyor ve
    // arayüz buna göre farklı form gösteriyor.
    setPassword: builder.mutation({
      query: (body) => ({ url: '/auth/set-password', method: 'POST', body }),
      invalidatesTags: ['Session'],
    }),

    getDashboard: builder.query({
      query: () => '/dashboard',
      providesTags: ['Dashboard'],
    }),

    getAdminUsers: builder.query({
      query: () => '/admin/users',
      providesTags: ['Users'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useRegisterMutation,
  useLoginMutation,
  useLoginWithGoogleMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useSetPasswordMutation,
  useGetDashboardQuery,
  useGetAdminUsersQuery,
} = api;
