import { createSlice } from '@reduxjs/toolkit';
import { api } from './authApi';

// Token DEĞİL, sadece backend'in döndüğü kullanıcı bilgisi tutulur.
// status: 'idle' | 'loading' | 'authenticated' | 'anonymous'
const initialState = {
  user: null,
  status: 'idle',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionCleared(state) {
      state.user = null;
      state.status = 'anonymous';
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(api.endpoints.getMe.matchPending, (state) => {
        if (state.status === 'idle') state.status = 'loading';
      })
      .addMatcher(api.endpoints.getMe.matchFulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.status = 'authenticated';
      })
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
