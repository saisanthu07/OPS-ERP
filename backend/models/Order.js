const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const STATUSES = ['RESERVED', 'FULFILLED', 'CANCELLED'];

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, required: true, unique: true, default: () => `ORD-${uuidv4().slice(0, 8).toUpperCase()}` },
    customerName: { type: String, required: true, trim: true },
    item: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: STATUSES, default: 'RESERVED' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = STATUSES;
