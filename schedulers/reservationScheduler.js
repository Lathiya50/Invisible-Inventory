
const ReservationService = require('../services/reservationService');
const ProductService = require('../services/productService');

class ReservationScheduler {
  constructor(intervalMs = 60000) { // Default: run every minute
    this.intervalMs = intervalMs;
    this.schedulerInterval = null;
  }
  
  /**
   * Start the reservation cleanup scheduler
   */
  start() {
    if (this.schedulerInterval) {
      console.warn('Scheduler is already running');
      return;
    }
    
    console.log('Starting reservation scheduler...');
    
    // Run immediately on startup
    this.processExpiredItems();
    
    // Then schedule periodic execution
    this.schedulerInterval = setInterval(() => {
      this.processExpiredItems();
    }, this.intervalMs);
    
    return this;
  }
  
  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.schedulerInterval) {
      console.warn('Scheduler is not running');
      return;
    }
    
    clearInterval(this.schedulerInterval);
    this.schedulerInterval = null;
    
    console.log('Reservation scheduler stopped');
    return this;
  }
  
  /**
   * Process expired reservations and product listings
   */
  async processExpiredItems() {
    try {
      console.log('Running scheduled cleanup job at:', new Date());
      
      // Process expired reservations first
      const reservationResults = await ReservationService.processExpiredReservations();
      console.log(`Processed ${reservationResults.processed} expired reservations`);
      
      // Then clean up expired product listings
      const productResults = await ProductService.cleanupExpiredProducts();
      console.log('Expired products cleanup completed');
      
      return {
        reservationResults,
        productResults
      };
    } catch (error) {
      console.error('Error in scheduled cleanup job:', error);
    }
  }
}

module.exports = new ReservationScheduler();