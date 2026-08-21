const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const prisma = require('../services/prisma');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshCookieOptions,
} = require('../utils/tokens');
const { protect } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }
  next();
}

function toSafeJSON(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

router.post('/register', protect, requireRole('ADMIN'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['ADMIN', 'OPERATIONS', 'SALES']).withMessage('Invalid role'),
  body('assignedLocation').optional({ nullable: true }).trim(),
], validate, async (req, res, next) => {
  try {
    const { name, email, password, role, assignedLocation } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('A user with this email already exists', 409);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, assignedLocation: assignedLocation || null }
    });

    res.status(201).json({ user: toSafeJSON(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
], validate, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw new AppError('Invalid email or password', 401);
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new AppError('Invalid email or password', 401);
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.cookie('refreshToken', refreshToken, refreshCookieOptions());
    res.json({ accessToken, user: toSafeJSON(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new AppError('No refresh token provided', 401);

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      res.clearCookie('refreshToken');
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) {
      res.clearCookie('refreshToken');
      throw new AppError('User no longer exists or is inactive', 401);
    }

    if (decoded.v !== user.refreshTokenVersion) {
      res.clearCookie('refreshToken');
      throw new AppError('Refresh token revoked', 401);
    }

    const accessToken = signAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

router.post('/revoke-sessions', protect, async (req, res, next) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshTokenVersion: { increment: 1 } }
    });
    res.clearCookie('refreshToken');
    res.json({ message: 'All sessions revoked' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new AppError('User not found', 404);
    res.json({ user: toSafeJSON(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
