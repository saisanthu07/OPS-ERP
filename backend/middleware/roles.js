// Backend authorization is mandatory: this middleware is the single source of truth
// for role checks. The frontend hiding buttons is cosmetic only.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: role '${req.user.role}' cannot perform this action.`,
      });
    }
    next();
  };
}

// Live-Verification "Change 4": restrict Operations/Sales users to their assigned location.
// Admins are exempt. No-op if the user has no assignedLocation set.
function restrictToAssignedLocation(locationField = 'location') {
  return (req, res, next) => {
    if (req.user.role === 'ADMIN') return next();
    if (!req.user.assignedLocation) return next();

    const targetLocation =
      req.body[locationField] || req.query[locationField] || req.params[locationField];

    if (targetLocation && targetLocation !== req.user.assignedLocation) {
      return res.status(403).json({
        message: `Forbidden: you are restricted to location '${req.user.assignedLocation}'.`,
      });
    }
    next();
  };
}

module.exports = { requireRole, restrictToAssignedLocation };
