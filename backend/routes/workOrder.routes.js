const express = require('express');
const { body, validationResult } = require('express-validator');
const WorkOrder = require('../models/WorkOrder');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
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

// Computes total available quantity for an item at a location, across all batches
async function computeAvailableAtLocation(item, location) {
  const records = await Inventory.find({ item, location });
  return records.reduce((sum, r) => sum + (r.physicalQty - r.reservedQty), 0);
}

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.location) filter.location = req.query.location;

    const workOrders = await WorkOrder.find(filter)
      .populate('assignedUser', 'name email role')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ workOrders });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const wo = await WorkOrder.findById(req.params.id)
      .populate('assignedUser', 'name email role')
      .populate('createdBy', 'name email');
    if (!wo) throw new AppError('Work order not found', 404);
    res.json({ workOrder: wo });
  } catch (err) {
    next(err);
  }
});

// Only Admin can create Work Orders (per spec)
router.post(
  '/',
  requireRole('ADMIN'),
  restrictToAssignedLocation('location'),
  [
    body('location').trim().notEmpty(),
    body('item').trim().notEmpty(),
    body('requiredQty').isFloat({ gt: 0 }),
    body('assignedUser').isMongoId(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { location, item, requiredQty, assignedUser } = req.body;

      const user = await User.findById(assignedUser);
      if (!user || !user.isActive) throw new AppError('Assigned user not found or inactive', 400);

      const availableAtLocation = await computeAvailableAtLocation(item, location);
      const shortage = Math.max(0, Number(requiredQty) - availableAtLocation);

      const workOrder = await WorkOrder.create({
        location,
        item,
        requiredQty,
        assignedUser,
        createdBy: req.user._id,
        stockCheck: { availableAtLocation, shortage },
      });

      const populated = await workOrder.populate('assignedUser', 'name email role');
      res.status(201).json({ workOrder: populated });
    } catch (err) {
      next(err);
    }
  }
);

// Re-run the stock check on demand (e.g. after a transfer completes)
router.get('/:id/stock-check', async (req, res, next) => {
  try {
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) throw new AppError('Work order not found', 404);

    const availableAtLocation = await computeAvailableAtLocation(wo.item, wo.location);
    const shortage = Math.max(0, wo.requiredQty - availableAtLocation);

    wo.stockCheck = { availableAtLocation, shortage };
    await wo.save();

    res.json({ stockCheck: wo.stockCheck });
  } catch (err) {
    next(err);
  }
});

// Update status. Admin or the assigned Operations user may progress it.
router.patch(
  '/:id/status',
  requireRole('ADMIN', 'OPERATIONS'),
  [body('status').isIn(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'])],
  validate,
  async (req, res, next) => {
    try {
      const wo = await WorkOrder.findById(req.params.id);
      if (!wo) throw new AppError('Work order not found', 404);

      if (req.user.role === 'OPERATIONS' && String(wo.assignedUser) !== String(req.user._id)) {
        throw new AppError('You can only update work orders assigned to you', 403);
      }

      wo.status = req.body.status;
      await wo.save();
      res.json({ workOrder: wo });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
