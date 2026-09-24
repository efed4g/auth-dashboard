/**
 * API uçlarının tanımı (RTK Query). Bileşenler fetch çağırmıyor, buradan
 * üretilen hook'ları kullanıyor.
 *
 * Tag mantığı: query'ler etiket "sağlar", mutation'lar aynı etiketi
 * "geçersiz kılar". Giriş yapıldığında Session geçersiz olunca /auth/me
 * kendiliğinden yeniden çekiliyor.
 */
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../app/baseQuery';

export const api = createApi({
  reducerPath: 'api',
  // CSRF ve otomatik oturum yenileme bu katmanda.
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Session', 'Dashboard', 'Users', 'Profile'],
  endpoints: (builder) => ({
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['Session'],
    }),

    // Kayıt oturum açmıyor (e-posta doğrulaması gerekiyor), geçersiz
    // kılınacak önbellek de yok.
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

    // Users da geçersiz kılınıyor: admin çıkıp başka hesapla girdiğinde eski
    // kullanıcı listesi ekranda kalmasın.
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

    // Session geçersiz kılınıyor: hasPassword değişiyor ve arayüz buna göre
    // farklı form gösteriyor.
    setPassword: builder.mutation({
      query: (body) => ({ url: '/auth/set-password', method: 'POST', body }),
      invalidatesTags: ['Session'],
    }),

    // Arayüz isActive değişikliğini hemen görsün diye Session tazeleniyor.
    deactivateAccount: builder.mutation({
      query: (body) => ({ url: '/auth/deactivate', method: 'POST', body }),
      invalidatesTags: ['Session', 'Dashboard', 'Profile'],
    }),

    reactivateAccount: builder.mutation({
      query: () => ({ url: '/auth/reactivate', method: 'POST' }),
      invalidatesTags: ['Session', 'Dashboard', 'Profile'],
    }),

    // Kalıcı silme: geri dönüşü yok.
    deleteAccount: builder.mutation({
      query: (body) => ({ url: '/auth/delete-account', method: 'POST', body }),
      invalidatesTags: ['Session', 'Dashboard', 'Profile'],
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
  useDeactivateAccountMutation,
  useReactivateAccountMutation,
  useDeleteAccountMutation,
  useGetDashboardQuery,
  useGetAdminUsersQuery,
} = api;
