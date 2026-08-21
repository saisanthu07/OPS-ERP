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
    if (req.query.status) filter.status = req.query.status;
    const orders = await prisma.order.findMany({
      where: filter,
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new AppError('Order not found', 404);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('ADMIN', 'SALES'), restrictToAssignedLocation('location'), [
  body('customerName').trim().notEmpty(),
  body('item').trim().notEmpty(),
  body('location').trim().notEmpty(),
  body('batch').trim().notEmpty(),
  body('quantity').isFloat({ gt: 0 }),
  body('idempotencyKey').optional().isString(),
], validate, async (req, res, next) => {
  try {
    const { customerName, item, location, batch, quantity } = req.body;
    const qty = Number(quantity);
    const idempotencyKey = req.body.idempotencyKey || uuidv4();

    const createdOrder = await prisma.$transaction(async (tx) => {
      const existingTx = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) {
        return tx.order.findFirst({
          where: { item, location, batch, customerName, quantity: qty },
          orderBy: { createdAt: 'desc' }
        });
      }

      // PostgreSQL Row-Level Lock: prevent race conditions by locking this specific inventory row
      // until the transaction completes. This guarantees sequential evaluation of physical vs reserved.
      const lockedInvArray = await tx.$queryRaw`
        SELECT * FROM "Inventory" 
        WHERE "item" = ${item} AND "location" = ${location} AND "batch" = ${batch} 
        FOR UPDATE
      `;
      
      if (!lockedInvArray || lockedInvArray.length === 0) {
        throw new AppError('Cannot reserve more than the available inventory quantity.', 400);
      }

      const inv = lockedInvArray[0];
      if (inv.physicalQty - inv.reservedQty < qty) {
        throw new AppError('Cannot reserve more than the available inventory quantity.', 400);
      }

      const updatedInv = await tx.inventory.update({
        where: { id: inv.id },
        data: { reservedQty: { increment: qty } }
      });

      const order = await tx.order.create({
        data: {
          orderCode: 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          customerName, item, location, batch, quantity: qty, status: 'RESERVED', createdById: req.user.id
        }
      });

      await tx.inventoryTransaction.create({
        data: {
          idempotencyKey, type: 'RESERVATION', inventoryId: inv.id, quantity: qty, performedById: req.user.id,
          reference: { orderId: order.id }
        }
      });

      return order;
    });

    res.status(201).json({ message: 'Order created & stock reserved', order: createdOrder });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const idempotencyKey = req.body.idempotencyKey || uuidv4();

    const cancelledOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new AppError('Order not found', 404);
      if (order.status !== 'RESERVED') throw new AppError('Only reserved orders can be cancelled', 400);

      const existingTx = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) return order;

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledById: req.user.id }
      });

      const inv = await tx.inventory.findUnique({
        where: { item_location_batch: { item: order.item, location: order.location, batch: order.batch } }
      });

      if (inv) {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { reservedQty: { decrement: order.quantity } }
        });
        await tx.inventoryTransaction.create({
          data: {
            idempotencyKey, type: 'RESERVATION_RELEASE', inventoryId: inv.id, quantity: -order.quantity,
            performedById: req.user.id, reference: { orderId: order.id }
          }
        });
      }

      return updatedOrder;
    });

    res.json({ message: 'Order cancelled, reservation released', order: cancelledOrder });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
