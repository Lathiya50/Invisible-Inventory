const mongoose = require('mongoose');
const { RESERVATION_STATUS } = require('../constants');

const ReservationSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  sku: {
    type: String,
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: Object.values(RESERVATION_STATUS),
    default: RESERVATION_STATUS.PENDING
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  confirmedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ReservationSchema.index({ expiresAt: 1, status: 1 });

module.exports = mongoose.model('Reservation', ReservationSchema);