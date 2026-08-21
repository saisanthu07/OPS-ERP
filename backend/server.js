require('dotenv').config();
const app = require('./app');
const prisma = require('./services/prisma');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await prisma.$connect();
    console.log('Connected to PostgreSQL via Prisma');
    
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.error(err);
  prisma.$disconnect().then(() => process.exit(1));
});
