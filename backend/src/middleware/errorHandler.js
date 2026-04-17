function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message, err.stack);

  const statusCode = err.statusCode || 500;
  const response = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
    }
  };

  // Always include safe fallback for runtime endpoints
  if (req.path.startsWith('/api/runtime')) {
    response.error.safeFallback = {
      type: 'transfer',
      value: 'operator_transfer',
      label: 'General Operator'
    };
  }

  res.status(statusCode).json(response);
}

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = { errorHandler, AppError };
