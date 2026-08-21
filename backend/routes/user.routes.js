const express = require('express');
const prisma = require('../services/prisma');
const bcrypt = require('bcryptjs');
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

router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role, assignedLocation } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, assignedLocation }
    });
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, role, assignedLocation, isActive, password } = req.body;
    
    // Prevent admin from disabling themselves
    if (req.params.id === req.user.id && isActive === false) {
      return res.status(400).json({ message: 'You cannot disable your own account' });
    }

    const data = { name, email, role, assignedLocation, isActive };
    
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(password, salt);
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data
    });
    res.json({ message: 'User updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
