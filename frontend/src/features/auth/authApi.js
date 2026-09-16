import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '../../app/baseQuery';

// Tag'ler sayesinde login/logout sonrası oturum ve dashboard verisi tazelenir.
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Session', 'Dashboard', 'Users'],
  endpoints: (builder) => ({
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['Session'],
    }),

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
