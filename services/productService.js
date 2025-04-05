const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');
const { startSession } = mongoose;

class ProductService {
  /**
   * Create a new product listing
   */
  async createProduct(productData) {
    const { sellerId, sku, totalQuantity, expiryTime } = productData;
    
    try {
        // Validate product data (e.g., check for duplicates, valid expiry time)
        if (!sku || !totalQuantity || !expiryTime) {
            throw new Error('Invalid product data');
        }
        if (totalQuantity <= 0) {
            throw new Error('Total quantity must be greater than zero');
        }
        if (expiryTime <= new Date()) {
            throw new Error('Expiry time must be in the future');
        }
        const exitProduct = await Product.findOne({ sku }).lean();
        if (exitProduct) {
            throw new Error('Product with this SKU already exists');
        }
        // Create product instance and save to database

      const product = new Product({
        sellerId,
        sku,
        totalQuantity,
        reservedQuantity: 0,
        expiryTime
      });
      
      await product.save();
      return product;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Product with this SKU already exists');
      }
      throw error;
    }
  }
  
  /**
   * Check if enough quantity is available for reservation
   */
  async checkAvailability(sku, requestedQuantity) {
    const product = await Product.findOne({ 
      sku, 
      expiryTime: { $gt: new Date() } 
    });
    
    if (!product) {
      throw new Error('Product not found or expired');
    }
    
    const availableQuantity = product.totalQuantity - product.reservedQuantity;
    
    return {
      isAvailable: availableQuantity >= requestedQuantity,
      availableQuantity,
      product
    };
  }
  
  /**
   * Reserve product quantity with optimistic concurrency control
   */
  async reserveQuantity(sku, quantity, buyerId) {
    const session = await startSession();
    
    try {
      session.startTransaction();
      
      // Find product with sufficient available quantity using atomic query
            const product = await Product.findOneAndUpdate(
        { 
          sku, 
          expiryTime: { $gt: new Date() },
          $expr: { $gte: ["$totalQuantity", { $add: [quantity, "$reservedQuantity"] }] }
        },
        { 
          $inc: { 
            reservedQuantity: quantity,
            version: 1 
          }
        },
        { 
          new: true, 
          session,
          runValidators: true
        }
      );
      
      if (!product) {
        await session.abortTransaction();
        throw new Error('Insufficient quantity available or product not found/expired');
      }
     
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes expiry
      
      const reservation = new Reservation({
        productId: product._id,
        sku,
        quantity,
        buyerId,
        status: 'PENDING',
        expiresAt
      });      
      await reservation.save({ session });
      
      await session.commitTransaction();
      return { product, reservation };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Release reserved quantity (when reservation expires or is cancelled)
   */
  async releaseReservedQuantity(sku, quantity, options = {}) {
    return await Product.findOneAndUpdate(
      { sku },
      { 
        $inc: { 
          reservedQuantity: -quantity,
          version: 1 
        }
      },
      { new: true, ...options }
    );
  }
  
  /**
   * Convert reserved quantity to sold when reservation is confirmed
   * (just decrement total quantity but leave reserved quantity as is)
   */
  async confirmReservation(sku, quantity, options = {}) {
    return await Product.findOneAndUpdate(
      { sku },
      { 
        $inc: { 
          totalQuantity: -quantity,
          version: 1 
        }
      },
      { new: true, ...options }
    );
  }
  
  /**
   * Clean up expired product listings
   */
  async cleanupExpiredProducts() {  
    // Archive or mark as expired instead of deletion (Option but just for better data retention)
    return await Product.updateMany(
      { expiryTime: { $lt: new Date() } },
      { $set: { isExpired: true } }
    );
  }
}

module.exports = new ProductService();