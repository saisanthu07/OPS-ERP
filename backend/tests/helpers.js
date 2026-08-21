const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { signAccessToken } = require('../utils/tokens');

async function createUser({ name, email, role, assignedLocation = null, password = 'Password@123' }) {
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, role, passwordHash, assignedLocation });
  const token = signAccessToken(user);
  return { user, token };
}

async function createInventory(overrides = {}) {
  return Inventory.create({
    item: 'Test Item',
    category: 'General',
    location: 'Warehouse-A',
    batch: 'BATCH-1',
    physicalQty: 100,
    reservedQty: 0,
    ...overrides,
  });
}

module.exports = { createUser, createInventory };
