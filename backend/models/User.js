const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['ADMIN', 'OPERATIONS', 'SALES'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'SALES' },
    // Used for Change 4 (live verification): restrict user to assigned location
    assignedLocation: { type: String, default: null, trim: true },
    isActive: { type: Boolean, default: true },
    refreshTokenVersion: { type: Number, default: 0 }, // bump to invalidate all refresh tokens
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = async function (plain) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    assignedLocation: this.assignedLocation,
    isActive: this.isActive,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
