const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Statuses: RECEIVED_PARTIAL supports Live-Verification Change 2 (partial receipt)
const STATUSES = ['REQUESTED', 'DISPATCHED', 'RECEIVED_PARTIAL', 'RECEIVED'];

const transferSchema = new mongoose.Schema(
  {
    transferCode: { type: String, required: true, unique: true, default: () => `TR-${uuidv4().slice(0, 8).toUpperCase()}` },
    sourceLocation: { type: String, required: true, trim: true },
    destinationLocation: { type: String, required: true, trim: true },
    item: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 }, // total requested quantity
    quantityReceived: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: STATUSES, default: 'REQUESTED' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dispatchedAt: { type: Date },
    receivedAt: { type: Date },
    workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' },
  },
  { timestamps: true }
);

transferSchema.pre('validate', function (next) {
  if (this.sourceLocation === this.destinationLocation) {
    return next(new Error('Source and destination location must differ'));
  }
  next();
});

module.exports = mongoose.model('Transfer', transferSchema);
module.exports.STATUSES = STATUSES;
