export async function fetchWithAutoRefresh(url, options = {}) {
  options.credentials = 'include';
  let response = await fetch(url, options);

  // Eğer 401 veya 403 dönerse access token muhtemelen expired, refresh dene!
  if (response.status === 401 || response.status === 403) {
    // Refresh token endpointine isteği atıyoruz
    const apiUrl = import.meta.env.VITE_API_URL;
    const refreshRes = await fetch(`${apiUrl}/refresh-token`, {
      method: 'POST',
      credentials: 'include'
    });
    if (refreshRes.ok) {
      // Refresh başarılı olduysa orijinal isteği tekrar et
      response = await fetch(url, options);
      return response;
    } else {
      // Refresh da başarısızsa logout veya login yönlendirmesi yapılabilir
      throw new Error('Oturumunuz sona erdi. Lütfen tekrar giriş yapınız.');
    }
  }

  // 401/403 değilse cevabı döndür
  return response;
}