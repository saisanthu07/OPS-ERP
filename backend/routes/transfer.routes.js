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
    const transfers = await prisma.transfer.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ transfers });
  } catch (err) {
    next(err);
  }
});

router.post('/request', requireRole('ADMIN', 'OPERATIONS'), [
  body('sourceLocation').trim().notEmpty(),
  body('destinationLocation').trim().notEmpty(),
  body('item').trim().notEmpty(),
  body('batch').trim().notEmpty(),
  body('quantity').isFloat({ gt: 0 })
], validate, async (req, res, next) => {
  try {
    const { sourceLocation, destinationLocation, item, batch, quantity, workOrderId } = req.body;
    const transfer = await prisma.transfer.create({
      data: {
        transferCode: 'TRF-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        sourceLocation, destinationLocation, item, batch, quantity: Number(quantity),
        workOrderId: workOrderId || null,
        status: 'REQUESTED', requestedById: req.user.id
      }
    });
    res.status(201).json({ message: 'Transfer requested', transfer });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/dispatch', requireRole('ADMIN', 'OPERATIONS'), async (req, res, next) => {
  try {
    const idempotencyKey = req.body.idempotencyKey || uuidv4();
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({ where: { id: req.params.id } });
      if (!transfer) throw new AppError('Transfer not found', 404);
      if (transfer.status !== 'REQUESTED') throw new AppError('Only REQUESTED transfers can be dispatched', 400);

      const existingTx = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) return transfer;

      const lockedInvArray = await tx.$queryRaw`
        SELECT * FROM "Inventory" 
        WHERE "item" = ${transfer.item} AND "location" = ${transfer.sourceLocation} AND "batch" = ${transfer.batch} 
        FOR UPDATE
      `;

      if (!lockedInvArray || lockedInvArray.length === 0) {
        throw new AppError('Not enough available stock to dispatch this transfer', 400);
      }

      const inv = lockedInvArray[0];
      if (inv.physicalQty - inv.reservedQty < transfer.quantity) {
        throw new AppError('Not enough available stock to dispatch this transfer', 400);
      }

      await tx.inventory.update({
        where: { id: inv.id },
        data: { physicalQty: { decrement: transfer.quantity } }
      });

      await tx.inventoryTransaction.create({
        data: {
          idempotencyKey, type: 'TRANSFER_DISPATCH', inventoryId: inv.id, quantity: -transfer.quantity,
          performedById: req.user.id, reference: { transferId: transfer.id }
        }
      });

      return tx.transfer.update({
        where: { id: transfer.id },
        data: { status: 'DISPATCHED', dispatchedById: req.user.id }
      });
    });

    res.json({ message: 'Transfer dispatched', transfer: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/receive', requireRole('ADMIN', 'OPERATIONS'), [
  body('quantity').optional().isFloat({ gt: 0 })
], validate, async (req, res, next) => {
  try {
    const idempotencyKey = req.body.idempotencyKey || uuidv4();
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({ where: { id: req.params.id } });
      if (!transfer) throw new AppError('Transfer not found', 404);
      if (transfer.status !== 'DISPATCHED' && transfer.status !== 'RECEIVED_PARTIAL') {
        throw new AppError('Transfer is not in a receivable state', 400);
      }

      const existingTx = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey } });
      if (existingTx) return transfer;

      const remainingToReceive = transfer.quantity - transfer.quantityReceived;
      const rcvQty = req.body.quantity ? Number(req.body.quantity) : remainingToReceive;

      if (rcvQty > remainingToReceive) {
        throw new AppError(`Cannot receive more than the remaining dispatched quantity (${remainingToReceive})`, 400);
      }

      const sourceInv = await tx.inventory.findUnique({
        where: { item_location_batch: { item: transfer.item, location: transfer.sourceLocation, batch: transfer.batch } }
      });

      const destInv = await tx.inventory.upsert({
        where: { item_location_batch: { item: transfer.item, location: transfer.destinationLocation, batch: transfer.batch } },
        update: { physicalQty: { increment: rcvQty } },
        create: {
          item: transfer.item, category: sourceInv ? sourceInv.category : 'Unknown',
          location: transfer.destinationLocation, batch: transfer.batch, physicalQty: rcvQty
        }
      });

      await tx.inventoryTransaction.create({
        data: {
          idempotencyKey, type: 'TRANSFER_RECEIPT', inventoryId: destInv.id, quantity: rcvQty,
          performedById: req.user.id, reference: { transferId: transfer.id }
        }
      });

      const newRcv = transfer.quantityReceived + rcvQty;
      const status = newRcv >= transfer.quantity ? 'RECEIVED' : 'RECEIVED_PARTIAL';

      return tx.transfer.update({
        where: { id: transfer.id },
        data: { quantityReceived: newRcv, status, receivedById: req.user.id }
      });
    });

    res.json({ message: 'Transfer receipt processed', transfer: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
