/**
 * Uygulamanın kendi hata tipi.
 *
 * Controller'lar res.status(...).json(...) çağırmak yerine bu hatayı fırlatıyor;
 * cevabın biçimini tek bir yer (error.middleware.js) belirliyor. Fayda şu:
 * hata formatı değiştiğinde tek dosya güncelleniyor ve bir controller hata
 * dönüp fonksiyondan çıkmayı unutsa bile akış kazara devam edemiyor.
 *
 * statusCode hatayla birlikte taşınıyor, böylece middleware "bu ne tür bir
 * hataydı" diye tahmin yürütmek zorunda kalmıyor.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode      HTTP durum kodu
   * @param {string} message         Kullanıcıya gösterilebilecek mesaj
   * @param {string} [options.code]  Frontend'in davranış değiştirmesi için
   *                                 makine tarafından okunabilir kod
   *                                 (ör. TOKEN_EXPIRED). Mesaj metnine göre
   *                                 dallanmak kırılgan olurdu.
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    // Beklenen (iş kuralı) hataları programlama hatalarından ayırmak için.
    this.isOperational = true;
    // Stack'te bu yapıcı görünmesin; ilk satır hatanın fırlatıldığı yer olsun.
    Error.captureStackTrace(this, ApiError);
  }

  // Sık kullanılan durum kodları için kısayollar: çağrı yerinde sayı yerine
  // niyeti okumak (ApiError.conflict) hem daha anlaşılır hem yazım hatasına kapalı.
  static badRequest(message, options) { return new ApiError(400, message, options); }
  static unauthorized(message, options) { return new ApiError(401, message, options); }
  static forbidden(message, options) { return new ApiError(403, message, options); }
  static notFound(message, options) { return new ApiError(404, message, options); }
  static conflict(message, options) { return new ApiError(409, message, options); }
  static tooManyRequests(message, options) { return new ApiError(429, message, options); }
  static serviceUnavailable(message, options) { return new ApiError(503, message, options); }
}

module.exports = ApiError;
