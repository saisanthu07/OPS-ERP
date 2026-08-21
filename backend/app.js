const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(hpp());

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/work-orders', require('./routes/workOrder.routes'));
app.use('/api/transfers', require('./routes/transfer.routes'));
app.use('/api/orders', require('./routes/order.routes'));

app.use(errorHandler);

module.exports = app;
