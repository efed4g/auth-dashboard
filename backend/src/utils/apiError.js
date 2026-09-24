/**
 * Uygulamanın kendi hata tipi.
 *
 * Controller'lar res.status().json() yerine bu hatayı fırlatıyor; cevabın
 * biçimini tek bir yer (error.middleware.js) belirliyor. Ayrıca bir controller
 * hata dönüp fonksiyondan çıkmayı unutsa bile akış kazara devam edemiyor.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode     HTTP durum kodu
   * @param {string} message        Kullanıcıya gösterilebilecek mesaj
   * @param {string} [options.code] Frontend'in davranış değiştirmesi için
   *                                makine okunur kod (ör. TOKEN_EXPIRED);
   *                                mesaj metnine göre dallanmak kırılgan olurdu.
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    // Alan bazlı doğrulama hataları: { firstName: 'mesaj', phone: 'mesaj' }
    this.fields = options.fields;
    // Beklenen iş kuralı hatalarını programlama hatalarından ayırır.
    this.isOperational = true;
    // Stack'in ilk satırı hatanın fırlatıldığı yer olsun.
    Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message, options) { return new ApiError(400, message, options); }
  static unauthorized(message, options) { return new ApiError(401, message, options); }
  static forbidden(message, options) { return new ApiError(403, message, options); }
  static notFound(message, options) { return new ApiError(404, message, options); }
  static conflict(message, options) { return new ApiError(409, message, options); }
  static tooManyRequests(message, options) { return new ApiError(429, message, options); }
  static serviceUnavailable(message, options) { return new ApiError(503, message, options); }
}

module.exports = ApiError;
