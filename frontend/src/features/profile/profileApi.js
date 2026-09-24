/**
 * Profil API uçları.
 *
 * Mevcut api nesnesine ekleniyor (injectEndpoints): ayrı bir createApi
 * açsaydık iki ayrı önbellek oluşur, etiketler birbirini tetikleyemezdi.
 */
import { api } from '../auth/authApi';

export const profileApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query({
      query: () => '/profile',
      providesTags: ['Profile'],
    }),

    getLocations: builder.query({
      query: () => '/profile/locations',
    }),

    createProfile: builder.mutation({
      query: (body) => ({ url: '/profile', method: 'POST', body }),
      invalidatesTags: ['Profile', 'Dashboard'],
    }),

    updateProfile: builder.mutation({
      query: (body) => ({ url: '/profile', method: 'PUT', body }),
      invalidatesTags: ['Profile', 'Dashboard'],
    }),

    deleteProfile: builder.mutation({
      query: () => ({ url: '/profile', method: 'DELETE' }),
      invalidatesTags: ['Profile', 'Dashboard'],
    }),

    // Gövde FormData (multipart/form-data). Content-Type elle yazılmıyor:
    // tarayıcı boundary değeriyle birlikte kendisi koyuyor.
    uploadPhoto: builder.mutation({
      query: (formData) => ({ url: '/profile/photo', method: 'POST', body: formData }),
      invalidatesTags: ['Profile', 'Dashboard', 'Session'],
    }),

    deletePhoto: builder.mutation({
      query: () => ({ url: '/profile/photo', method: 'DELETE' }),
      invalidatesTags: ['Profile', 'Dashboard', 'Session'],
    }),
  }),
});

export const {
  useGetProfileQuery,
  useGetLocationsQuery,
  useCreateProfileMutation,
  useUpdateProfileMutation,
  useDeleteProfileMutation,
  useUploadPhotoMutation,
  useDeletePhotoMutation,
} = profileApi;