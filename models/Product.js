const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sku: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  totalQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  expiryTime: {
    type: Date,
    required: true,
    index: true
  },
  version: {
    type: Number,
    default: 0
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now 
  }
},{timestamps: true,});

// Compound index for efficient querying of active products
ProductSchema.index({ expiryTime: 1, sku: 1 });

module.exports = mongoose.model('Product', ProductSchema);