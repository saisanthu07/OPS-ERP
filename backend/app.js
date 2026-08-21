const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./routes/auth.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const workOrderRoutes = require('./routes/workOrder.routes');
const transferRoutes = require('./routes/transfer.routes');
const orderRoutes = require('./routes/order.routes');
const userRoutes = require('./routes/user.routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const swaggerDocument = require('./config/swagger.json');
const logger = require('./utils/logger');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // --- Security headers ---
  app.use(helmet());

  // --- CORS: only allow the configured client origin, with credentials for the refresh cookie ---
  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // --- Prevent NoSQL injection via operator-stripping on req.body/query/params ---
  app.use(mongoSanitize());

  // --- Prevent HTTP parameter pollution ---
  app.use(hpp());

  // --- General rate limiting (auth routes have their own stricter limiter) ---
  app.use(
    '/api/',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
  }

  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.use('/api/auth', authRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/work-orders', workOrderRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/users', userRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
