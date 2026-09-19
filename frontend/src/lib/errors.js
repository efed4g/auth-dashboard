/**
 * Hata nesnelerini kullanıcıya gösterilebilir metne çevirir.
 *
 * RTK Query hataları tek biçimde gelmiyor: sunucunun döndüğü { error, code }
 * gövdesi olabileceği gibi, ağ hatası veya çözümlenemeyen cevap da olabilir.
 * Bu ayrımı her sayfada tekrar yapmamak için tek bir yardımcıda topladım.
 *
 * @param {object} error      RTK Query hata nesnesi
 * @param {string} [fallback] Hiçbir şey çözülemezse gösterilecek metin
 * @returns {string}          Ekranda gösterilecek mesaj
 */
export function getErrorMessage(error, fallback = 'Beklenmeyen bir hata oluştu.') {
  if (!error) return fallback;

  // Sunucuya hiç ulaşılamadı. "Bir hata oluştu" demek yerine muhtemel sebebi
  // söylemek, geliştirme sırasında en çok karşılaşılan durumu hızlı çözüyor.
  if (error.status === 'FETCH_ERROR') {
    return 'Sunucuya ulaşılamadı. Backend çalışıyor mu?';
  }
  if (error.status === 'PARSING_ERROR') {
    return 'Sunucudan beklenmeyen bir yanıt geldi.';
  }

  // Öncelik sunucunun yazdığı mesajda: kullanıcıya gösterilmek üzere
  // hazırlanmış olan o. Bulunamazsa sırayla diğer olasılıklara düşülüyor.
  return error.data?.error || error.error || fallback;
}

// Mesaj metnine göre dallanmak kırılgan olurdu (metin değişince mantık bozulur).
// Bunun yerine backend'in gönderdiği sabit kod kullanılıyor, ör. EMAIL_NOT_VERIFIED.
export function getErrorCode(error) {
  return error?.data?.code;
}
