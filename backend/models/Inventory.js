const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    item: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    physicalQty: { type: Number, required: true, min: 0, default: 0 },
    reservedQty: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

// One record per item+location+batch combination
inventorySchema.index({ item: 1, location: 1, batch: 1 }, { unique: true });

// Available quantity is always derived, never stored, so it can never drift out of sync
inventorySchema.virtual('availableQty').get(function () {
  return this.physicalQty - this.reservedQty;
});

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

// Guard: physicalQty must never be less than reservedQty (DB-level invariant, checked on every save)
inventorySchema.pre('save', function (next) {
  if (this.physicalQty < 0 || this.reservedQty < 0) {
    return next(new Error('Quantities cannot be negative'));
  }
  if (this.reservedQty > this.physicalQty) {
    return next(new Error('Reserved quantity cannot exceed physical quantity'));
  }
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema);
