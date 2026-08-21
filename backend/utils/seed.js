require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const logger = require('./logger');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info('Connected for seeding...');

  const users = [
    { name: 'Alice Admin', email: 'admin@opserp.com', password: 'Admin@12345', role: 'ADMIN' },
    {
      name: 'Oscar Operations',
      email: 'ops@opserp.com',
      password: 'Ops@12345',
      role: 'OPERATIONS',
      assignedLocation: 'Warehouse-A',
    },
    {
      name: 'Sara Sales',
      email: 'sales@opserp.com',
      password: 'Sales@12345',
      role: 'SALES',
      assignedLocation: 'Warehouse-A',
    },
  ];

  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      logger.info(`User already exists: ${u.email}`);
      continue;
    }
    const passwordHash = await User.hashPassword(u.password);
    await User.create({ ...u, passwordHash });
    logger.info(`Created user: ${u.email} / ${u.password} (${u.role})`);
  }

  const sampleInventory = [
    { item: 'Steel Rod 10mm', category: 'Raw Material', location: 'Warehouse-A', batch: 'B001', physicalQty: 100, reservedQty: 0 },
    { item: 'Steel Rod 10mm', category: 'Raw Material', location: 'Warehouse-B', batch: 'B002', physicalQty: 60, reservedQty: 0 },
    { item: 'Copper Wire 2mm', category: 'Raw Material', location: 'Warehouse-A', batch: 'B003', physicalQty: 200, reservedQty: 0 },
  ];

  for (const inv of sampleInventory) {
    const exists = await Inventory.findOne({ item: inv.item, location: inv.location, batch: inv.batch });
    if (!exists) {
      await Inventory.create(inv);
      logger.info(`Created inventory: ${inv.item} @ ${inv.location} (${inv.batch})`);
    }
  }

  logger.info('Seeding complete.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
