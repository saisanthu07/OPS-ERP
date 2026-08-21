const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Transfer = require('../models/Transfer');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const { protect } = require('../middleware/auth');
const { requireRole, restrictToAssignedLocation } = require('../middleware/roles');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }
  next();
}

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const transfers = await Transfer.find(filter)
      .populate('requestedBy', 'name email')
      .populate('dispatchedBy', 'name email')
      .populate('receivedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ transfers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const transfer = await Transfer.findById(req.params.id);
    if (!transfer) throw new AppError('Transfer not found', 404);
    res.json({ transfer });
  } catch (err) {
    next(err);
  }
});

// Request a transfer (Operations/Admin)
router.post(
  '/',
  requireRole('ADMIN', 'OPERATIONS'),
  [
    body('sourceLocation').trim().notEmpty(),
    body('destinationLocation').trim().notEmpty(),
    body('item').trim().notEmpty(),
    body('batch').trim().notEmpty(),
    body('quantity').isFloat({ gt: 0 }),
    body('workOrder').optional().isMongoId(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { sourceLocation, destinationLocation, item, batch, quantity, workOrder } = req.body;
      if (sourceLocation === destinationLocation) {
        throw new AppError('Source and destination location must differ', 400);
      }

      const sourceInv = await Inventory.findOne({ item, location: sourceLocation, batch });
      if (!sourceInv || sourceInv.physicalQty - sourceInv.reservedQty < Number(quantity)) {
        throw new AppError('Insufficient available quantity at source location for this transfer', 400);
      }

      const transfer = await Transfer.create({
        sourceLocation,
        destinationLocation,
        item,
        batch,
        quantity,
        requestedBy: req.user._id,
        workOrder: workOrder || undefined,
      });

      res.status(201).json({ transfer });
    } catch (err) {
      next(err);
    }
  }
);

// Dispatch: atomically reduce source inventory, guarded against over-transfer.
// (Test 2: cannot transfer more than available inventory)
router.post(
  '/:id/dispatch',
  requireRole('ADMIN', 'OPERATIONS'),
  [body('idempotencyKey').optional().isString()],
  validate,
  async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
      const idempotencyKey = req.body.idempotencyKey || uuidv4();

      let result;
      await session.withTransaction(async () => {
        const transfer = await Transfer.findById(req.params.id).session(session);
        if (!transfer) throw new AppError('Transfer not found', 404);
        if (transfer.status !== 'REQUESTED') {
          throw new AppError(`Transfer cannot be dispatched from status '${transfer.status}'`, 400);
        }

        const existingTx = await InventoryTransaction.findOne({ idempotencyKey }).session(session);
        if (existingTx) {
          result = transfer;
          return;
        }

        // Atomic guarded decrement: only succeeds if enough available (unreserved) stock exists
        const sourceInv = await Inventory.findOneAndUpdate(
          {
            item: transfer.item,
            location: transfer.sourceLocation,
            batch: transfer.batch,
            $expr: {
              $gte: [{ $subtract: ['$physicalQty', '$reservedQty'] }, transfer.quantity],
            },
          },
          { $inc: { physicalQty: -transfer.quantity } },
          { new: true, session }
        );

        if (!sourceInv) {
          throw new AppError('Insufficient available quantity at source location for this transfer', 400);
        }

        await InventoryTransaction.create(
          [
            {
              idempotencyKey,
              type: 'TRANSFER_DISPATCH',
              inventory: sourceInv._id,
              quantity: -transfer.quantity,
              performedBy: req.user._id,
              reference: { transferId: transfer._id },
            },
          ],
          { session }
        );

        transfer.status = 'DISPATCHED';
        transfer.dispatchedBy = req.user._id;
        transfer.dispatchedAt = new Date();
        await transfer.save({ session });
        result = transfer;
      });

      res.json({ transfer: result });
    } catch (err) {
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// Receive (full or partial). Destination inventory increases only here — never before.
// (Test 3: destination stock increases only after receipt. Test 4: cannot receive twice.)
router.post(
  '/:id/receive',
  requireRole('ADMIN', 'OPERATIONS'),
  [body('quantity').optional().isFloat({ gt: 0 }), body('idempotencyKey').optional().isString()],
  validate,
  async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
      const idempotencyKey = req.body.idempotencyKey || uuidv4();

      let result;
      await session.withTransaction(async () => {
        const transfer = await Transfer.findById(req.params.id).session(session);
        if (!transfer) throw new AppError('Transfer not found', 404);

        if (!['DISPATCHED', 'RECEIVED_PARTIAL'].includes(transfer.status)) {
          throw new AppError(
            `Transfer cannot be received from status '${transfer.status}'. It must be dispatched first, and cannot be received twice.`,
            400
          );
        }

        const remaining = transfer.quantity - transfer.quantityReceived;
        const receiveQty = req.body.quantity != null ? Number(req.body.quantity) : remaining;

        if (receiveQty <= 0 || receiveQty > remaining) {
          throw new AppError(
            `Invalid receive quantity. Remaining quantity to receive is ${remaining}.`,
            400
          );
        }

        const existingTx = await InventoryTransaction.findOne({ idempotencyKey }).session(session);
        if (existingTx) {
          result = transfer;
          return;
        }

        let destInv = await Inventory.findOne({
          item: transfer.item,
          location: transfer.destinationLocation,
          batch: transfer.batch,
        }).session(session);

        if (!destInv) {
          const created = await Inventory.create(
            [
              {
                item: transfer.item,
                category: 'TRANSFERRED', // category unknown at destination if first arrival; operator can update later
                location: transfer.destinationLocation,
                batch: transfer.batch,
                physicalQty: 0,
                reservedQty: 0,
              },
            ],
            { session }
          );
          destInv = created[0];
        }

        destInv.physicalQty += receiveQty;
        await destInv.save({ session });

        await InventoryTransaction.create(
          [
            {
              idempotencyKey,
              type: 'TRANSFER_RECEIPT',
              inventory: destInv._id,
              quantity: receiveQty,
              performedBy: req.user._id,
              reference: { transferId: transfer._id },
            },
          ],
          { session }
        );

        transfer.quantityReceived += receiveQty;
        transfer.status = transfer.quantityReceived >= transfer.quantity ? 'RECEIVED' : 'RECEIVED_PARTIAL';
        transfer.receivedBy = req.user._id;
        transfer.receivedAt = new Date();
        await transfer.save({ session });

        result = transfer;
      });

      res.json({ transfer: result });
    } catch (err) {
      next(err);
    } finally {
      session.endSession();
    }
  }
);

module.exports = router;
