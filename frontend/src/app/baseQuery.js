/**
 * RTK Query'nin kullandığı özel baseQuery.
 *
 * Bütün API istekleri buradan geçiyor; CSRF başlığı ve oturum yenileme tek
 * noktada hallediliyor ki yeni bir uç eklendiğinde unutulmasın.
 */
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;
const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Access ve refresh cookie'leri httpOnly; JavaScript'in okuyabildiği tek
// cookie csrfToken ve bu bilinçli bir tercih.
function readCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

let csrfRequest = null;

/**
 * CSRF token'ının hazır olduğundan emin olur. Cookie varsa ağa çıkılmıyor;
 * yoksa promise saklanıyor, böylece aynı anda tetiklenen istekler tek bir
 * token çağrısını bekliyor.
 */
async function ensureCsrfToken() {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;

  if (!csrfRequest) {
    csrfRequest = fetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      // Gövde okunamazsa cookie'ye bakılıyor: sunucu token'ı oraya da yazıyor.
      .then((data) => data?.csrfToken ?? readCookie(CSRF_COOKIE))
      // Referans her durumda temizleniyor, yoksa başarısız bir istek sonsuza
      // dek önbellekte kalırdı.
      .finally(() => { csrfRequest = null; });
  }
  return csrfRequest;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  // Bu seçenek olmadan tarayıcı farklı origin'deki backend'e cookie göndermez.
  credentials: 'include',
});

// GET istekleri sunucu tarafında da muaf, gereksiz yere token beklenmiyor.
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

/**
 * Devam eden yenileme isteği.
 *
 * Access token süresi dolduğunda sayfadaki tüm sorgular birden 401 alıyor.
 * Bu referans olmasaydı her biri ayrı /auth/refresh çağırır, rotasyon
 * nedeniyle ikinciler eski token'la gider ve backend bunu "token çalındı"
 * sayıp bütün oturumu kapatırdı.
 */
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

// Bu uçlardaki 401 "oturum doldu" değil "bilgiler hatalı" demek. Ayrıca
// /auth/refresh kendi kendini çağırırsa sonsuz döngü oluşurdu.
const NO_RETRY_ENDPOINTS = new Set(['/auth/refresh', '/auth/login', '/auth/register', '/auth/google']);

/**
 * Asıl baseQuery: CSRF başlığı eklenir → istek atılır → 401 gelirse bir kez
 * yenileme denenir → başarılıysa istek tekrarlanır. Yenileme başarısızsa
 * sonuç olduğu gibi dönüyor, store'daki middleware oturumu temizliyor.
 *
 * Tekrar yalnızca BİR kez: döngü kurulsaydı kalıcı 401'de istemci sonsuza
 * dek istek atardı.
 */
export async function baseQueryWithReauth(args, api, extraOptions) {
  const request = await withCsrf(args);
  let result = await rawBaseQuery(request, api, extraOptions);

  // args hem adres dizesi hem nesne olabiliyor (RTK Query ikisine de izin veriyor).
  const url = typeof request === 'string' ? request : request.url;
  const shouldTryRefresh = result.error?.status === 401 && !NO_RETRY_ENDPOINTS.has(url);

  if (shouldTryRefresh) {
    const refreshed = await refreshSession(api, extraOptions);
    if (refreshed) {
      // İstek yeniden hazırlanıyor: yenilemede CSRF token'ı da tazelendi,
      // eski başlıkla tekrar denemek 403 verirdi.
      result = await rawBaseQuery(await withCsrf(args), api, extraOptions);
    }
  }

  return result;
}

export { API_BASE_URL, ensureCsrfToken, readCookie };
