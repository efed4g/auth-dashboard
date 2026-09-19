/**
 * Async controller'ları Express'in hata zincirine bağlar.
 *
 * Express 5 async fonksiyonlardan dönen reddedilmiş promise'leri kendiliğinden
 * yakalıyor, ama her controller'ı bu sarmalayıcıdan geçirmek davranışı açık
 * hale getiriyor ve her fonksiyona try/catch yazma ihtiyacını ortadan
 * kaldırıyor. Hata yakalandığında next(err) çağrılıyor, yani istek
 * errorHandler'a düşüyor; aksi halde cevapsız kalıp zaman aşımına uğrardı.
 *
 * @param   {Function} fn  (req, res, next) alan async controller
 * @returns {Function}     Express'e verilebilecek middleware
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
