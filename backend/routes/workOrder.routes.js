const express = require('express');
const { body, validationResult } = require('express-validator');
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
    const workOrders = await prisma.workOrder.findMany({
      where: filter,
      include: {
        assignedUser: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
        transfers: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ workOrders });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('ADMIN'), restrictToAssignedLocation('location'), [
  body('location').trim().notEmpty(),
  body('item').trim().notEmpty(),
  body('requiredQty').isFloat({ gt: 0 }),
  body('assignedUserId').trim().notEmpty()
], validate, async (req, res, next) => {
  try {
    const { location, item, requiredQty, assignedUserId } = req.body;
    
    // Auto-calculate shortage
    const inventory = await prisma.inventory.findMany({
      where: { item, location }
    });
    
    // Sum availableQty virtual logic (physicalQty - reservedQty)
    const availableAtLocation = inventory.reduce((sum, inv) => sum + (inv.physicalQty - inv.reservedQty), 0);
    const required = Number(requiredQty);
    const shortage = required > availableAtLocation ? required - availableAtLocation : 0;

    const workOrder = await prisma.workOrder.create({
      data: {
        workOrderCode: 'WO-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        location, item, requiredQty: required, assignedUserId, createdById: req.user.id,
        stockCheck_availableAtLocation: availableAtLocation,
        stockCheck_shortage: shortage
      }
    });

    res.status(201).json({ message: 'Work Order created', workOrder });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/status', requireRole('ADMIN', 'OPERATIONS'), [
  body('status').isIn(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'])
], validate, async (req, res, next) => {
  try {
    const workOrder = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: { status: req.body.status }
    });
    res.json({ message: 'Work order status updated', workOrder });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/check-shortage', requireRole('ADMIN', 'OPERATIONS'), async (req, res, next) => {
  try {
    const workOrder = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!workOrder) throw new AppError('Work Order not found', 404);

    const inventory = await prisma.inventory.findMany({
      where: { item: workOrder.item, location: workOrder.location }
    });
    
    const availableAtLocation = inventory.reduce((sum, inv) => sum + (inv.physicalQty - inv.reservedQty), 0);
    const shortage = workOrder.requiredQty > availableAtLocation ? workOrder.requiredQty - availableAtLocation : 0;

    const updated = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: { stockCheck_availableAtLocation: availableAtLocation, stockCheck_shortage: shortage }
    });

    res.json({ message: 'Shortage re-calculated', workOrder: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
