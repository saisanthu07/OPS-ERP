require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../services/prisma');
const logger = require('./logger');

async function seed() {
  try {
    logger.info('Connected for seeding...');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password@123', salt);

    const users = [
      { name: 'Ananya Sharma', email: 'admin@opserp.com', password: 'Admin@12345', role: 'ADMIN' },
      { name: 'Rohan Patel', email: 'ops@opserp.com', password: 'Ops@12345', role: 'OPERATIONS', assignedLocation: 'Warehouse-A' },
      { name: 'Priya Gupta', email: 'sales@opserp.com', password: 'Sales@12345', role: 'SALES', assignedLocation: 'Warehouse-A' },
    ];

    for (const u of users) {
      const exists = await prisma.user.findUnique({ where: { email: u.email } });
      if (exists) {
        logger.info('User already exists: ' + u.email);
        continue;
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(u.password, salt);
      
      const { password, ...userData } = u;
      
      await prisma.user.create({
        data: { ...userData, passwordHash }
      });
      logger.info('Created user: ' + u.email + ' / ' + u.password + ' (' + u.role + ')');
    }

    const sampleInventory = [
      { item: 'Steel Rod 10mm', category: 'Raw Material', location: 'Warehouse-A', batch: 'B001', physicalQty: 100, reservedQty: 0 },
      { item: 'Steel Rod 10mm', category: 'Raw Material', location: 'Warehouse-B', batch: 'B002', physicalQty: 60, reservedQty: 0 },
      { item: 'Copper Wire 2mm', category: 'Raw Material', location: 'Warehouse-A', batch: 'B003', physicalQty: 200, reservedQty: 0 },
    ];

    for (const inv of sampleInventory) {
      const exists = await prisma.inventory.findUnique({
        where: {
          item_location_batch: { item: inv.item, location: inv.location, batch: inv.batch }
        }
      });
      if (!exists) {
        await prisma.inventory.create({ data: inv });
        logger.info('Created inventory: ' + inv.item + ' @ ' + inv.location + ' (' + inv.batch + ')');
      }
    }

    logger.info('Seeding complete.');
  } catch (error) {
    logger.error('Seed failed: ' + error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
