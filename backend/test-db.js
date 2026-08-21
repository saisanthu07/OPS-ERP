const prisma = require('./services/prisma');
async function test() {
  try {
    const users = await prisma.user.findMany();
    console.log('SUCCESS: Users found:', users.length);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
