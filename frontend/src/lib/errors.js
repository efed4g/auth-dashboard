/**
 * RTK Query hatalarını kullanıcıya gösterilebilir metne çevirir. Hata tek
 * biçimde gelmiyor: sunucunun { error, code } gövdesi, ağ hatası veya
 * çözümlenemeyen cevap olabilir.
 *
 * @param {object} error      RTK Query hata nesnesi
 * @param {string} [fallback] Hiçbir şey çözülemezse gösterilecek metin
 * @returns {string}
 */
export function getErrorMessage(error, fallback = 'Beklenmeyen bir hata oluştu.') {
  if (!error) return fallback;

  if (error.status === 'FETCH_ERROR') {
    return 'Sunucuya ulaşılamadı. Backend çalışıyor mu?';
  }
  if (error.status === 'PARSING_ERROR') {
    return 'Sunucudan beklenmeyen bir yanıt geldi.';
  }

  // Öncelik sunucunun mesajında: kullanıcıya gösterilmek üzere hazırlanan o.
  return error.data?.error || error.error || fallback;
}

// Mesaj metnine göre dallanmak kırılgan olurdu; backend'in sabit kodu
// kullanılıyor (ör. EMAIL_NOT_VERIFIED).
export function getErrorCode(error) {
  return error?.data?.code;
}
