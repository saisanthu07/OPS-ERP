const prisma = require('../services/prisma');

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
  process.env.JWT_ACCESS_EXPIRES = '15m';
  process.env.JWT_REFRESH_EXPIRES = '7d';
});

afterEach(async () => {
  // Clear the database tables after each test
  await prisma.inventoryTransaction.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.order.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
