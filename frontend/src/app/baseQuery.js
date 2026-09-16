import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;
const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Access/refresh token'lar httpOnly; JS'in okuyabildiği tek cookie csrfToken.
function readCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

let csrfRequest = null;

// Aynı anda birden fazla istek tetiklense de tek ağ çağrısı yapılır.
async function ensureCsrfToken() {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;

  if (!csrfRequest) {
    csrfRequest = fetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.csrfToken ?? readCookie(CSRF_COOKIE))
      .finally(() => { csrfRequest = null; });
  }
  return csrfRequest;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  // Cookie'lerin farklı origin'deki backend'e gidip gelebilmesi için şart.
  credentials: 'include',
});

// Durum değiştiren isteklere CSRF başlığını ekler.
async function withCsrf(args) {
  const request = typeof args === 'string' ? { url: args } : { ...args };
  const method = (request.method || 'GET').toUpperCase();

  if (SAFE_METHODS.has(method)) {
    return request;
  }

  const csrfToken = await ensureCsrfToken();
  request.headers = { ...(request.headers || {}), [CSRF_HEADER]: csrfToken ?? '' };
  return request;
}

// Birden fazla istek aynı anda 401 alırsa tek bir yenileme yapılır.
let refreshRequest = null;

function refreshSession(api, extraOptions) {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const csrfToken = await ensureCsrfToken();
      const result = await rawBaseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          headers: { [CSRF_HEADER]: csrfToken ?? '' },
        },
        api,
        extraOptions
      );
      return !result.error;
    })().finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

const NO_RETRY_ENDPOINTS = new Set(['/auth/refresh', '/auth/login', '/auth/register', '/auth/google']);

// Access token süresi dolduğunda bir kez yenilenir ve istek tekrarlanır.
export async function baseQueryWithReauth(args, api, extraOptions) {
  const request = await withCsrf(args);
  let result = await rawBaseQuery(request, api, extraOptions);

  const url = typeof request === 'string' ? request : request.url;
  const shouldTryRefresh = result.error?.status === 401 && !NO_RETRY_ENDPOINTS.has(url);

  if (shouldTryRefresh) {
    const refreshed = await refreshSession(api, extraOptions);
    if (refreshed) {
      result = await rawBaseQuery(await withCsrf(args), api, extraOptions);
    }
  }

  return result;
}

export { API_BASE_URL, ensureCsrfToken, readCookie };
