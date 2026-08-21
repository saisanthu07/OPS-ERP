const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
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
    const orders = await Order.find(filter).populate('createdBy', 'name email').sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError('Order not found', 404);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// Create order & reserve stock. Sales/Admin only.
// This is THE critical concurrency point (Test 1 + the "two users reserve" race).
// The guard is enforced as a single atomic MongoDB update, not read-then-write,
// so it is safe under concurrent requests regardless of application-level locking.
router.post(
  '/',
  requireRole('ADMIN', 'SALES'),
  restrictToAssignedLocation('location'),
  [
    body('customerName').trim().notEmpty(),
    body('item').trim().notEmpty(),
    body('location').trim().notEmpty(),
    body('batch').trim().notEmpty(),
    body('quantity').isFloat({ gt: 0 }),
    body('idempotencyKey').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
      const { customerName, item, location, batch, quantity } = req.body;
      const qty = Number(quantity);
      const idempotencyKey = req.body.idempotencyKey || uuidv4();

      let createdOrder;
      await session.withTransaction(async () => {
        const existingTx = await InventoryTransaction.findOne({ idempotencyKey }).session(session);
        if (existingTx) {
          createdOrder = await Order.findOne({ item, location, batch, customerName, quantity: qty })
            .sort({ createdAt: -1 })
            .session(session);
          return;
        }

        // Atomic guarded increment of reservedQty: filter re-checks availability at
        // write time, so two concurrent requests can never both succeed past capacity.
        const inv = await Inventory.findOneAndUpdate(
          {
            item,
            location,
            batch,
            $expr: { $gte: [{ $subtract: ['$physicalQty', '$reservedQty'] }, qty] },
          },
          { $inc: { reservedQty: qty } },
          { new: true, session }
        );

        if (!inv) {
          throw new AppError('Cannot reserve more than the available inventory quantity.', 400);
        }

        await InventoryTransaction.create(
          [
            {
              idempotencyKey,
              type: 'RESERVATION',
              inventory: inv._id,
              quantity: qty,
              performedBy: req.user._id,
            },
          ],
          { session }
        );

        const orderDocs = await Order.create(
          [
            {
              customerName,
              item,
              location,
              batch,
              quantity: qty,
              createdBy: req.user._id,
            },
          ],
          { session }
        );
        createdOrder = orderDocs[0];
      });

      res.status(201).json({ order: createdOrder });
    } catch (err) {
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// Live-Verification "Change 3": cancel an order and correctly release its reserved inventory.
router.post(
  '/:id/cancel',
  requireRole('ADMIN', 'SALES'),
  [body('idempotencyKey').optional().isString()],
  validate,
  async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
      const idempotencyKey = req.body.idempotencyKey || uuidv4();

      let result;
      await session.withTransaction(async () => {
        const order = await Order.findById(req.params.id).session(session);
        if (!order) throw new AppError('Order not found', 404);

        if (req.user.role === 'SALES' && String(order.createdBy) !== String(req.user._id)) {
          throw new AppError('You can only cancel orders you created', 403);
        }

        if (order.status !== 'RESERVED') {
          throw new AppError(`Order cannot be cancelled from status '${order.status}'`, 400);
        }

        const existingTx = await InventoryTransaction.findOne({ idempotencyKey }).session(session);
        if (existingTx) {
          result = order;
          return;
        }

        const inv = await Inventory.findOneAndUpdate(
          {
            item: order.item,
            location: order.location,
            batch: order.batch,
            reservedQty: { $gte: order.quantity },
          },
          { $inc: { reservedQty: -order.quantity } },
          { new: true, session }
        );

        if (!inv) {
          throw new AppError('Inventory reservation state is inconsistent; cannot release.', 409);
        }

        await InventoryTransaction.create(
          [
            {
              idempotencyKey,
              type: 'RESERVATION_RELEASE',
              inventory: inv._id,
              quantity: -order.quantity,
              performedBy: req.user._id,
              reference: { orderId: order._id },
            },
          ],
          { session }
        );

        order.status = 'CANCELLED';
        order.cancelledBy = req.user._id;
        order.cancelledAt = new Date();
        await order.save({ session });
        result = order;
      });

      res.json({ order: result });
    } catch (err) {
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// Mark an order fulfilled (ships out the reserved stock physically: reduce physical & reserved together)
router.post('/:id/fulfill', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw new AppError('Order not found', 404);
      if (order.status !== 'RESERVED') {
        throw new AppError(`Order cannot be fulfilled from status '${order.status}'`, 400);
      }

      const inv = await Inventory.findOneAndUpdate(
        {
          item: order.item,
          location: order.location,
          batch: order.batch,
          reservedQty: { $gte: order.quantity },
          physicalQty: { $gte: order.quantity },
        },
        { $inc: { reservedQty: -order.quantity, physicalQty: -order.quantity } },
        { new: true, session }
      );

      if (!inv) throw new AppError('Inventory state inconsistent; cannot fulfill.', 409);

      order.status = 'FULFILLED';
      await order.save({ session });
      result = order;
    });

    res.json({ order: result });
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
});

module.exports = router;
