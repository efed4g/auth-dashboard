/**
 * Async controller'ları Express'in hata zincirine bağlar: reddedilen promise
 * next(err)'e dönüşür, istek errorHandler'a düşer. Her fonksiyona try/catch
 * yazma ihtiyacını ortadan kaldırıyor.
 *
 * @param   {Function} fn (req, res, next) alan async controller
 * @returns {Function}    Express'e verilebilecek middleware
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
