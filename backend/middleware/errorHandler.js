const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Prisma validation error
  if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid data provided';
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    statusCode = 409;
    const fields = err.meta?.target || 'unknown field';
    message = `Duplicate value for unique constraint on: ${fields}`;
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  }

  if (statusCode >= 500) {
    logger.error(err.stack || err.message);
  }

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, notFound, AppError };
