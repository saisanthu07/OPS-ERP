const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.use(protect);

// Admin needs this to pick an "Assigned User" when creating a Work Order
router.get('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.role) filter.role = req.query.role;
    const users = await User.find(filter).select('name email role assignedLocation');
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
