# Invisible Inventory Solution

## Problem Overview
In B2B resale platforms, inventory can appear available when it's already sold due to system delays, leading to "ghost inventory" and frustrated buyers. This solution provides a robust inventory reservation system that prevents overselling and manages inventory accurately.

## Solution Architecture

### Core Models
1. **Product**
   - Tracks total and reserved quantities
   - Includes expiry time for listings
   - Uses optimistic concurrency with version field

2. **Reservation**
   - States: `PENDING → CONFIRMED | EXPIRED | CANCELLED`
   - Auto-expires after 5 minutes
   - Linked to products via SKU and productId

### Key Features
- **Atomic Reservation**: Uses MongoDB transactions to ensure consistent updates
- **Concurrency Control**: Prevents race conditions with optimistic locking
- **Auto-Expiry**: Releases reserved inventory after 5 minutes if not confirmed
- **Efficient Queries**: Indexed for performance under high load

## How It Works

### Inventory Management Flow
1. **Seller Lists Product**
   ```
   totalQuantity = X
   reservedQuantity = 0
   ```

2. **Buyer Makes Reservation**
   ```
   totalQuantity = X (unchanged)
   reservedQuantity += quantity
   availableQuantity = totalQuantity - reservedQuantity
   ```

3. **Reservation Confirmed**
   ```
   totalQuantity -= quantity
   reservedQuantity = unchanged (items are now sold)
   ```

4. **Reservation Expired/Cancelled**
   ```
   totalQuantity = unchanged
   reservedQuantity -= quantity (items return to available pool)
   ```

### Technical Implementation
- MongoDB for persistence (survives restarts)
- Transaction-based updates for atomic operations
- Background job to clean up expired reservations
- Optimized for high-concurrency environments

## Preventing Overselling
The system prevents overselling through:
1. Atomic check-and-reserve operations
2. Isolation of database transactions
3. Managing reservation lifecycle with clear state transitions
4. Automatic cleanup of expired reservations

The solution handles high concurrency workloads while maintaining inventory accuracy and preventing "ghost inventory" issues.
