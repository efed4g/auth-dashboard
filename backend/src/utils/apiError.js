// Controller'lar bunu fırlatır, cevabın şeklini error middleware belirler.
class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    this.isOperational = true;
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
