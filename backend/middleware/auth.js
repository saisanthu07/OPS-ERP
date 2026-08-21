const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated. No token provided.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User no longer exists or is inactive.' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { protect };
