const express = require('express');
const prisma = require('../services/prisma');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

router.use(protect);
router.use(requireRole('ADMIN'));

router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, assignedLocation: true, isActive: true },
      orderBy: { name: 'asc' }
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
