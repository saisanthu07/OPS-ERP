const express = require('express');
const prisma = require('../services/prisma');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();
router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    
    let filter = {};
    if (search) {
      filter = {
        OR: [
          { item: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [items, total] = await Promise.all([
      prisma.inventory.findMany({ where: filter, orderBy: { item: 'asc' }, skip, take }),
      prisma.inventory.count({ where: filter })
    ]);

    res.json({
      items,
      meta: {
        total,
        page: Number(page),
        limit: take,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('ADMIN', 'OPERATIONS'), async (req, res, next) => {
  try {
    const { item, category, location, batch, physicalQty, idempotencyKey } = req.body;
    
    await prisma.$transaction(async (tx) => {
      const existingTx = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) return; 

      let inv = await tx.inventory.findUnique({
        where: { item_location_batch: { item, location, batch } }
      });

      if (inv) {
        inv = await tx.inventory.update({
          where: { id: inv.id },
          data: { physicalQty: { increment: physicalQty } }
        });
      } else {
        inv = await tx.inventory.create({
          data: { item, category, location, batch, physicalQty }
        });
      }

      await tx.inventoryTransaction.create({
        data: {
          idempotencyKey,
          type: 'STOCK_IN',
          inventoryId: inv.id,
          quantity: physicalQty,
          performedById: req.user.id
        }
      });
    });

    res.status(201).json({ message: 'Inventory updated' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/damage', requireRole('ADMIN', 'OPERATIONS'), async (req, res, next) => {
  try {
    const { quantity, idempotencyKey } = req.body;
    
    await prisma.$transaction(async (tx) => {
      const existingTx = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) return;

      const lockedInvArray = await tx.$queryRaw`
        SELECT * FROM "Inventory" WHERE id = ${req.params.id} FOR UPDATE
      `;
      if (!lockedInvArray || lockedInvArray.length === 0) throw new Error('Inventory not found');

      const inv = lockedInvArray[0];
      if (inv.physicalQty - inv.reservedQty < quantity) {
        throw new Error('Insufficient available quantity to mark as damaged');
      }

      await tx.inventory.update({
        where: { id: inv.id },
        data: { physicalQty: { decrement: quantity } }
      });

      await tx.inventoryTransaction.create({
        data: {
          idempotencyKey,
          type: 'DAMAGE',
          inventoryId: inv.id,
          quantity,
          performedById: req.user.id
        }
      });
    });

    res.json({ message: 'Damage recorded' });
  } catch (err) {
    if (err.message.includes('Insufficient')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
});

module.exports = router;
