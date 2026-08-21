const mongoose = require('mongoose');

const TX_TYPES = [
  'STOCK_IN',
  'DAMAGE',
  'TRANSFER_DISPATCH',
  'TRANSFER_RECEIPT',
  'RESERVATION',
  'RESERVATION_RELEASE',
];

const inventoryTransactionSchema = new mongoose.Schema(
  {
    // idempotencyKey prevents the same logical transaction from being applied twice
    // (e.g. double-submit, retried request, duplicate transfer receipt)
    idempotencyKey: { type: String, required: true, unique: true },
    type: { type: String, enum: TX_TYPES, required: true },
    inventory: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    quantity: { type: Number, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reference: { type: mongoose.Schema.Types.Mixed }, // e.g. { workOrderId, transferId, orderId }
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
module.exports.TX_TYPES = TX_TYPES;
