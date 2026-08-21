const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

const workOrderSchema = new mongoose.Schema(
  {
    workOrderCode: { type: String, required: true, unique: true, default: () => `WO-${uuidv4().slice(0, 8).toUpperCase()}` },
    location: { type: String, required: true, trim: true },
    item: { type: String, required: true, trim: true },
    requiredQty: { type: Number, required: true, min: 1 },
    assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: STATUSES, default: 'ASSIGNED' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Snapshot of stock check computed at creation time (informational; live check is recomputed on demand)
    stockCheck: {
      availableAtLocation: { type: Number, default: 0 },
      shortage: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WorkOrder', workOrderSchema);
module.exports.STATUSES = STATUSES;
