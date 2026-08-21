const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
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

// Stricter rate limit on auth endpoints to slow brute-force / credential stuffing
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

// Only Admin can create new users (bootstrap handled via seed script)
router.post(
  '/register',
  protect,
  requireRole('ADMIN'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['ADMIN', 'OPERATIONS', 'SALES']).withMessage('Invalid role'),
    body('assignedLocation').optional({ nullable: true }).trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password, role, assignedLocation } = req.body;
      const existing = await User.findOne({ email });
      if (existing) throw new AppError('A user with this email already exists', 409);

      const passwordHash = await User.hashPassword(password);
      const user = await User.create({
        name,
        email,
        passwordHash,
        role,
        assignedLocation: assignedLocation || null,
      });

      res.status(201).json({ user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+passwordHash');

      // Generic message to avoid leaking whether the email exists
      if (!user || !user.isActive) {
        throw new AppError('Invalid email or password', 401);
      }

      const match = await user.comparePassword(password);
      if (!match) {
        throw new AppError('Invalid email or password', 401);
      }

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);

      res.cookie('refreshToken', refreshToken, refreshCookieOptions());
      res.json({ accessToken, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw new AppError('No refresh token provided', 401);

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive || user.refreshTokenVersion !== decoded.v) {
      throw new AppError('Refresh token no longer valid', 401);
    }

    const accessToken = signAccessToken(user);
    // Rotate refresh token
    const newRefreshToken = signRefreshToken(user);
    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions());

    res.json({ accessToken, user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', protect, async (req, res, next) => {
  try {
    // Bump refresh token version to invalidate any outstanding refresh tokens
    req.user.refreshTokenVersion += 1;
    await req.user.save();
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', protect, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = router;
