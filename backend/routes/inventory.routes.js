const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../services/prisma');
const { protect } = require('../middleware/auth');
const { requireRole, restrictToAssignedLocation } = require('../middleware/roles');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  next();
}

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.location) filter.location = req.query.location;
    if (req.query.item) filter.item = req.query.item;
    const items = await prisma.inventory.findMany({ where: filter, orderBy: { item: 'asc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('ADMIN', 'OPERATIONS'), restrictToAssignedLocation('location'), [
  body('item').trim().notEmpty(),
  body('category').trim().notEmpty(),
  body('location').trim().notEmpty(),
  body('batch').trim().notEmpty(),
  body('physicalQty').isFloat({ gt: 0 }),
  body('idempotencyKey').optional().isString(),
], validate, async (req, res, next) => {
  try {
    const { item, category, location, batch, physicalQty } = req.body;
    const qty = Number(physicalQty);
    const idempotencyKey = req.body.idempotencyKey || uuidv4();

    const result = await prisma.$transaction(async (tx) => {
      const existingTx = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) return tx.inventory.findUnique({ where: { item_location_batch: { item, location, batch } } });

      const inv = await tx.inventory.upsert({
        where: { item_location_batch: { item, location, batch } },
        update: { physicalQty: { increment: qty } },
        create: { item, category, location, batch, physicalQty: qty }
      });

      await tx.inventoryTransaction.create({
        data: { idempotencyKey, type: 'STOCK_IN', inventoryId: inv.id, quantity: qty, performedById: req.user.id }
      });

      return inv;
    });

    res.status(201).json({ message: 'Stock added successfully', inventory: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/damage', requireRole('ADMIN', 'OPERATIONS'), [
  body('quantity').isFloat({ gt: 0 }),
  body('idempotencyKey').optional().isString(),
], validate, async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const qty = Number(quantity);
    const idempotencyKey = req.body.idempotencyKey || uuidv4();

    const invId = req.params.id;

    const result = await prisma.$transaction(async (tx) => {
      const existingTx = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) return tx.inventory.findUnique({ where: { id: invId } });

      const inv = await tx.inventory.findUnique({ where: { id: invId } });
      if (!inv) throw new AppError('Inventory not found', 404);
      if (inv.physicalQty - inv.reservedQty < qty) throw new AppError('Cannot damage more than unreserved physical quantity', 400);

      const updated = await tx.inventory.update({
        where: { id: invId },
        data: { physicalQty: { decrement: qty } }
      });

      await tx.inventoryTransaction.create({
        data: { idempotencyKey, type: 'DAMAGE', inventoryId: inv.id, quantity: -qty, performedById: req.user.id }
      });

      return updated;
    });

    res.json({ message: 'Damaged stock recorded', inventory: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
