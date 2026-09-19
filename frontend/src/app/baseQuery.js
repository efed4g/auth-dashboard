/**
 * RTK Query'nin kullandığı özel baseQuery.
 *
 * Bütün API istekleri buradan geçiyor ve iki ortak iş burada hallediliyor:
 * CSRF başlığının eklenmesi ve süresi dolan oturumun sessizce yenilenmesi.
 * Her endpoint'e tek tek yazmak yerine tek noktada çözmek, yeni bir uç
 * eklendiğinde bu adımların unutulmasını engelliyor.
 */
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Adres env'den geliyor; kodda sabit bir sunucu adresi yok.
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;
const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Access ve refresh cookie'leri httpOnly olduğu için JavaScript bunları
// göremiyor; okunabilen tek cookie csrfToken ve bu bilinçli bir tercih.
function readCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

// Devam eden CSRF isteği burada tutuluyor.
let csrfRequest = null;

/**
 * CSRF token'ının hazır olduğundan emin olur.
 *
 * Cookie zaten varsa ağa hiç çıkılmıyor. Yoksa istek atılıyor ve promise
 * saklanıyor: sayfa açılışında birkaç istek aynı anda tetiklendiğinde hepsi
 * aynı promise'i bekliyor, art arda birkaç kez token istenmiyor.
 */
async function ensureCsrfToken() {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;

  if (!csrfRequest) {
    csrfRequest = fetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      // Cevap gövdesi okunamazsa cookie'ye bakılıyor: sunucu token'ı
      // zaten cookie olarak da yazıyor, ikinci bir şans.
      .then((data) => data?.csrfToken ?? readCookie(CSRF_COOKIE))
      // Başarılı da olsa başarısız da olsa referans temizleniyor, aksi halde
      // bir kez başarısız olan istek sonsuza dek önbelleğe takılı kalırdı.
      .finally(() => { csrfRequest = null; });
  }
  return csrfRequest;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  // Bu seçenek olmadan tarayıcı farklı origin'deki backend'e cookie
  // göndermez; oturum kurulsa bile sonraki istekler kimliksiz gider.
  credentials: 'include',
});

// Yalnızca durum değiştiren isteklere CSRF başlığı ekleniyor; GET istekleri
// sunucu tarafında da muaf tutulduğu için gereksiz yere token beklemiyoruz.
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
 * Sayfada aynı anda birkaç sorgu varsa access token süresi dolduğunda hepsi
 * birden 401 alıyor. Bu referans olmasaydı her biri ayrı bir /auth/refresh
 * çağırırdı; rotasyon nedeniyle ilki token'ı değiştirir, kalanlar eski
 * token'la gelir ve backend bunu "token çalındı" sayıp bütün oturumu kapatırdı.
 * Tek bir yenileme yapıp hepsinin onu beklemesi bu sorunu kökten çözüyor.
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

/**
 * Yenileme denemesinden muaf uçlar.
 *
 * Bu uçlardan gelen 401 "oturumun süresi doldu" değil "bilgiler hatalı"
 * anlamına geliyor. Yenilemeye çalışmak hem anlamsız hem de yanlış: hatalı
 * şifre giren kullanıcı için gereksiz bir istek atılır, /auth/refresh kendi
 * kendini çağırırsa sonsuz döngü oluşurdu.
 */
const NO_RETRY_ENDPOINTS = new Set(['/auth/refresh', '/auth/login', '/auth/register', '/auth/google']);

/**
 * Asıl baseQuery: isteği hazırlar, 401 durumunda oturumu tazeleyip tekrar dener.
 *
 * Akış: CSRF başlığı eklenir -> istek atılır -> 401 gelirse bir kez yenileme
 * denenir -> başarılıysa istek tekrarlanır. Yenileme başarısızsa sonuç olduğu
 * gibi dönüyor; store'daki middleware bunu görüp oturumu temizliyor.
 *
 * Tekrar yalnızca BİR kez deneniyor. Döngü kurulsaydı, sunucu kalıcı olarak
 * 401 döndüğünde istemci sonsuza dek istek atmaya devam ederdi.
 */
export async function baseQueryWithReauth(args, api, extraOptions) {
  const request = await withCsrf(args);
  let result = await rawBaseQuery(request, api, extraOptions);

  // args hem düz bir adres dizesi hem de nesne olabiliyor (RTK Query ikisine
  // de izin veriyor); karşılaştırma için adresi bu şekilde çıkarıyoruz.
  const url = typeof request === 'string' ? request : request.url;
  const shouldTryRefresh = result.error?.status === 401 && !NO_RETRY_ENDPOINTS.has(url);

  if (shouldTryRefresh) {
    const refreshed = await refreshSession(api, extraOptions);
    if (refreshed) {
      // İstek yeniden hazırlanıyor, çünkü yenileme sırasında CSRF token'ı da
      // tazelendi; eski başlıkla tekrar denemek 403 ile sonuçlanırdı.
      result = await rawBaseQuery(await withCsrf(args), api, extraOptions);
    }
  }

  return result;
}

export { API_BASE_URL, ensureCsrfToken, readCookie };
