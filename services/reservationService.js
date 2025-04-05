const Reservation = require('../models/Reservation');
const ProductService = require('./productService');
const mongoose = require('mongoose');
const { RESERVATION_STATUS } = require('../constants');
const { startSession } = mongoose;

class ReservationService {
  /**
   * Create a new reservation
   */
  async createReservation(buyerId, sku, quantity) {
    // This is delegated to ProductService.reserveQuantity which handles
    // both the product update and reservation creation atomically
    return await ProductService.reserveQuantity(sku, quantity, buyerId);
  }
  
  /**
   * Confirm a reservation (convert to sale)
   */
  async confirmReservation(reservationId, buyerId) {
    const session = await startSession();
    
    try {
      session.startTransaction();
      
      // Find and update reservation atomically
      const reservation = await Reservation.findOneAndUpdate(
        {
          _id: reservationId,
          buyerId,
          status: RESERVATION_STATUS.PENDING,
          expiresAt: { $gt: new Date() }
        },
        {
          $set: {
            status: RESERVATION_STATUS.CONFIRMED,
            confirmedAt: new Date()
          }
        },
        {
          new: true,
          session
        }
      );
      
      if (!reservation) {
        await session.abortTransaction();
        throw new Error('Reservation not found, expired, or already processed');
      }
      
      // Update product inventory (confirm reservation)
      await ProductService.confirmReservation(
        reservation.sku, 
        reservation.quantity,
        { session }
      );
      
      await session.commitTransaction();
      return reservation;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Cancel a reservation
   */
  async cancelReservation(reservationId, buyerId) {
    const session = await startSession();
    
    try {
      session.startTransaction();
      
      // Find and update reservation atomically
      const reservation = await Reservation.findOneAndUpdate(
        {
          _id: reservationId,
          buyerId,
          status: RESERVATION_STATUS.PENDING
        },
        {
          $set: { status: RESERVATION_STATUS.CANCELLED }
        },
        {
          new: true,
          session
        }
      );
      
      if (!reservation) {
        await session.abortTransaction();
        throw new Error('Reservation not found or already processed');
      }
      
      // Release the reserved quantity
      await ProductService.releaseReservedQuantity(
        reservation.sku, 
        reservation.quantity,       
        { session }
      );
      
      await session.commitTransaction();
      return reservation;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Process expired reservations to release inventory
   */
  async processExpiredReservations() {
    const now = new Date();
    
    // Find all expired PENDING reservations
    const expiredReservations = await Reservation.find({
      status: RESERVATION_STATUS.PENDING,
      expiresAt: { $lt: now }
    });
    
    console.log(`Found ${expiredReservations.length} expired reservations to process`);
    
    // Process each expired reservation
    const results = await Promise.allSettled(
      expiredReservations.map(async (reservation) => {
        const session = await startSession();
        
        try {
          session.startTransaction();
          
          // Update reservation status to EXPIRED
          const updated = await Reservation.findOneAndUpdate(
            {
              _id: reservation._id,
              status: RESERVATION_STATUS.PENDING  // Double-check it's still PENDING
            },
            {
              $set: { status: RESERVATION_STATUS.EXPIRED }
            },
            {
              session,
              new: true
            }
          );
          
          if (!updated) {
            await session.abortTransaction();
            return { success: false, id: reservation._id, reason: 'Reservation status changed' };
          }
          
          // Release the reserved quantity
          await ProductService.releaseReservedQuantity(
            reservation.sku,
            reservation.quantity,         
            { session }
          );
          
          await session.commitTransaction();
          return { success: true, id: reservation._id };
        } catch (error) {
          await session.abortTransaction();
          return { success: false, id: reservation._id, error };
        } finally {
          session.endSession();
        }
      })
    );
    
    return {
      processed: expiredReservations.length,
      results
    };
  }
}

module.exports = new ReservationService();