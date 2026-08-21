const prisma = require('../services/prisma');
const { signAccessToken } = require('../utils/tokens');
const bcrypt = require('bcryptjs');

async function createUser({ name, email, role, assignedLocation = null, password = 'Password@123' }) {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  const user = await prisma.user.create({ 
    data: { name, email, role, passwordHash, assignedLocation } 
  });
  
  const token = signAccessToken(user);
  return { user, token };
}

async function createInventory(overrides = {}) {
  return prisma.inventory.create({
    data: {
      item: 'Test Item',
      category: 'General',
      location: 'Warehouse-A',
      batch: 'BATCH-1',
      physicalQty: 100,
      reservedQty: 0,
      ...overrides,
    }
  });
}

module.exports = { createUser, createInventory };
