const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
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

// List / search inventory (all authenticated roles can view)
router.get(
  '/',
  [
    query('location').optional().trim(),
    query('item').optional().trim(),
    query('category').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.location) filter.location = req.query.location;
      if (req.query.item) filter.item = new RegExp(req.query.item, 'i');
      if (req.query.category) filter.category = req.query.category;

      const items = await Inventory.find(filter).sort({ location: 1, item: 1 });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', async (req, res, next) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) throw new AppError('Inventory record not found', 404);
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// Create or stock-in an inventory record. Operations/Admin only.
router.post(
  '/',
  requireRole('ADMIN', 'OPERATIONS'),
  restrictToAssignedLocation('location'),
  [
    body('item').trim().notEmpty(),
    body('category').trim().notEmpty(),
    body('location').trim().notEmpty(),
    body('batch').trim().notEmpty(),
    body('physicalQty').isFloat({ min: 0 }).withMessage('physicalQty must be >= 0'),
    body('idempotencyKey').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { item, category, location, batch, physicalQty } = req.body;
      const idempotencyKey = req.body.idempotencyKey || uuidv4();

      // Prevent duplicate submission of the same stock-in transaction
      const existingTx = await InventoryTransaction.findOne({ idempotencyKey });
      if (existingTx) {
        const inv = await Inventory.findById(existingTx.inventory);
        return res.status(200).json({ item: inv, message: 'Duplicate request ignored (idempotent)' });
      }

      let inv = await Inventory.findOne({ item, location, batch });
      if (inv) {
        inv.physicalQty += Number(physicalQty);
        await inv.save();
      } else {
        inv = await Inventory.create({ item, category, location, batch, physicalQty, reservedQty: 0 });
      }

      await InventoryTransaction.create({
        idempotencyKey,
        type: 'STOCK_IN',
        inventory: inv._id,
        quantity: Number(physicalQty),
        performedBy: req.user._id,
      });

      res.status(201).json({ item: inv });
    } catch (err) {
      next(err);
    }
  }
);

// Live-Verification "Change 1": mark stock as DAMAGED -> reduces physical (and thus available) qty
router.post(
  '/:id/damage',
  requireRole('ADMIN', 'OPERATIONS'),
  [body('quantity').isFloat({ gt: 0 }), body('idempotencyKey').optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      const { quantity } = req.body;
      const idempotencyKey = req.body.idempotencyKey || uuidv4();

      const existingTx = await InventoryTransaction.findOne({ idempotencyKey });
      if (existingTx) {
        const inv = await Inventory.findById(existingTx.inventory);
        return res.json({ item: inv, message: 'Duplicate request ignored (idempotent)' });
      }

      // Atomic guarded update: only succeeds if enough undamaged physical stock exists
      // beyond what's already reserved (can't damage reserved/committed stock away).
      const updated = await Inventory.findOneAndUpdate(
        {
          _id: req.params.id,
          $expr: { $gte: [{ $subtract: ['$physicalQty', '$reservedQty'] }, Number(quantity)] },
        },
        { $inc: { physicalQty: -Number(quantity) } },
        { new: true }
      );

      if (!updated) {
        throw new AppError(
          'Cannot mark more stock as damaged than is currently available (unreserved).',
          400
        );
      }

      await InventoryTransaction.create({
        idempotencyKey,
        type: 'DAMAGE',
        inventory: updated._id,
        quantity: -Number(quantity),
        performedBy: req.user._id,
      });

      res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id/transactions', async (req, res, next) => {
  try {
    const txs = await InventoryTransaction.find({ inventory: req.params.id })
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ transactions: txs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
