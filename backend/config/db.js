const mongoose = require('mongoose');
const logger = require('../utils/logger');

let memoryServer = null;

async function connectDB() {
  const uri = process.env.MONGO_URI;

  try {
    await mongoose.connect(uri);
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    throw err;
  }

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB runtime error: ${err.message}`);
  });

  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDB, disconnectDB };
