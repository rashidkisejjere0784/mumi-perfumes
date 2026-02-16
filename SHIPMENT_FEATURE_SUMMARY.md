# Stock Shipment Feature - Implementation Summary

## What Changed

The POS system has been upgraded to support **shipment-based stock management**, allowing you to add multiple perfumes in a single purchase while sharing common expenses like transport costs.

## Key Changes

### 1. Database Schema Updates

#### New Table: `stock_shipments`
```sql
CREATE TABLE stock_shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_name TEXT,                      -- Optional name for the shipment
  transport_cost REAL DEFAULT 0,           -- Shared transport cost
  other_expenses REAL DEFAULT 0,           -- Other shared expenses
  total_additional_expenses REAL DEFAULT 0, -- Sum of transport + other
  purchase_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Updated Table: `stock_groups`
**Before:**
- `perfume_id`, `quantity`, `buying_cost_per_bottle`, `additional_expenses`, `total_cost`, `purchase_date`, `remaining_quantity`

**After:**
- `shipment_id` (new) - References stock_shipments
- `perfume_id` - References perfumes
- `quantity` - Number of bottles
- `buying_cost_per_bottle` - Cost per bottle
- `subtotal_cost` (new) - quantity × buying_cost_per_bottle (no shared expenses)
- `remaining_quantity` - Current stock
- Removed: `additional_expenses`, `total_cost`, `purchase_date` (now in shipments table)

### 2. Updated Files

#### `/lib/database.ts`
- Added `stock_shipments` table creation
- Updated `stock_groups` table schema
- Added index for `stock_shipments(purchase_date)`
- Added index for `stock_groups(shipment_id)`

#### `/lib/types.ts`
- Added `StockShipment` interface
- Updated `StockGroup` interface (added `shipment_id`, `subtotal_cost`, removed `additional_expenses`, `total_cost`, `purchase_date`)
- Updated `CreateStockGroupRequest` to accept shipment data with items array
- Updated `StockWithDetails` to include shipment information

#### `/app/api/stock/route.ts`
Complete rewrite:
- **POST**: Now creates a shipment with multiple perfumes
- **GET**: Returns stock with shipment details (purchase_date, transport_cost, etc.)
- Joins with `stock_shipments` table
- Creates decant_tracking for each stock group

#### `/app/inventory/page.tsx`
Major UI overhaul:
- **StockModal**: Completely redesigned to support multiple perfumes
  - Shipment information section (name, date, costs)
  - Dynamic perfume items (add/remove)
  - Real-time subtotal calculations
  - Total summary showing perfume cost + shared expenses
- **Stock table**: Updated to show shipment names and adjusted columns
- Changed "Stock Groups" to "Stock Shipments"
- Updated table columns to show `subtotal_cost` instead of `total_cost`

### 3. New Files

#### `/scripts/migrate-to-shipments.js`
Migration script that:
- Backs up existing stock_groups data
- Creates new tables
- Migrates old stock groups to individual shipments
- Maintains referential integrity with sales and tracking
- Can be run manually or automatically on startup

#### `/SHIPMENT_MANAGEMENT.md`
Comprehensive documentation covering:
- Overview and benefits
- Database structure
- UI usage guide
- API endpoints
- Example scenarios
- Financial calculations
- Migration process

### 4. Updated Documentation

#### `/README.md`
- Added shipment-based stock management to features
- Added reference to `SHIPMENT_MANAGEMENT.md`

## Benefits of the New System

1. **Accurate Cost Tracking**: Transport costs are shared across all perfumes in a shipment, not duplicated
2. **Simplified Entry**: Add 5 perfumes with shared transport in one form instead of 5 separate entries
3. **Better Organization**: Group related purchases (e.g., "Dubai Import Feb 2024")
4. **Historical Context**: See which perfumes were ordered together
5. **Flexible**: Still works for single-perfume purchases (just add one item)

## Example Use Case

**Before (Old System):**
- Add Perfume A: 10 bottles + 50,000 UGX transport
- Add Perfume B: 20 bottles + 50,000 UGX transport
- Add Perfume C: 5 bottles + 50,000 UGX transport
- **Problem**: Transport cost counted 3 times! (150,000 instead of 50,000)

**After (New System):**
- Create Shipment: "Dubai Order"
  - Transport: 50,000 UGX (shared)
  - Perfume A: 10 bottles @ 100,000/bottle
  - Perfume B: 20 bottles @ 80,000/bottle
  - Perfume C: 5 bottles @ 120,000/bottle
- **Total**: (10×100k + 20×80k + 5×120k) + 50k = 3,250,000 UGX ✓

## Migration Strategy

The system includes automatic migration:
1. On first run with new code, database tables are created/updated
2. Existing stock groups are converted to individual shipments
3. Each old stock group becomes a shipment with one perfume
4. Referential integrity maintained (sales, decants still work)
5. No data loss

You can also manually run:
```bash
node scripts/migrate-to-shipments.js
```

## Backward Compatibility

- ✅ All existing sales data preserved
- ✅ Decant tracking still works
- ✅ Financial calculations remain accurate
- ✅ Old stock groups accessible (migrated to shipments)
- ✅ No manual data entry required

## API Changes

### POST /api/stock

**Old Request:**
```json
{
  "perfume_id": 1,
  "quantity": 10,
  "buying_cost_per_bottle": 100000,
  "additional_expenses": 50000,
  "purchase_date": "2024-01-15"
}
```

**New Request:**
```json
{
  "shipment_name": "Dubai Order",
  "transport_cost": 50000,
  "other_expenses": 0,
  "purchase_date": "2024-01-15",
  "items": [
    {
      "perfume_id": 1,
      "quantity": 10,
      "buying_cost_per_bottle": 100000
    },
    {
      "perfume_id": 2,
      "quantity": 5,
      "buying_cost_per_bottle": 80000
    }
  ]
}
```

**Old Response:**
```json
{
  "id": 123,
  "perfume_id": 1,
  "perfume_name": "Oud Royal",
  "quantity": 10,
  "buying_cost_per_bottle": 100000,
  "additional_expenses": 50000,
  "total_cost": 1050000,
  "purchase_date": "2024-01-15",
  ...
}
```

**New Response:**
```json
{
  "shipment_id": 456,
  "stocks": [
    {
      "id": 789,
      "shipment_id": 456,
      "perfume_id": 1,
      "perfume_name": "Oud Royal",
      "quantity": 10,
      "buying_cost_per_bottle": 100000,
      "subtotal_cost": 1000000,
      "remaining_quantity": 10,
      "purchase_date": "2024-01-15",
      "transport_cost": 50000,
      "other_expenses": 0,
      "shipment_name": "Dubai Order"
    },
    ...
  ]
}
```

## UI Changes

### Inventory Page - Stock Modal

**Before:**
- Single perfume selection
- Quantity and cost fields
- One "Additional Expenses" field
- Simple form

**After:**
- Shipment information section
- Multiple perfume items (dynamic add/remove)
- Separate transport and other expenses
- Real-time subtotal per perfume
- Total summary with breakdown
- More comprehensive form

### Stock Table

**Before:**
- Simple list of stock groups
- Total cost column (including expenses)

**After:**
- Grouped by shipment
- Shows shipment name with 📦 icon
- Subtotal column (per perfume, excluding shared expenses)
- More compact display (e.g., "5b, 12d" instead of "5 bottles, 12 decants")

## Testing Checklist

- [x] Database migration runs successfully
- [x] New stock shipments can be created
- [x] Multiple perfumes can be added to one shipment
- [x] Transport costs calculated correctly
- [x] Stock table displays shipment information
- [x] Existing sales data still accessible
- [x] Financial calculations remain accurate
- [x] Single-perfume shipments still work
- [x] View mode displays all details correctly

## Future Enhancements

Potential improvements:
1. Bulk edit shipment details
2. Shipment-level analytics (cost per shipment)
3. Supplier tracking (link shipments to suppliers)
4. Import history/timeline view
5. Shipment-based profit analysis
6. Export shipment reports

## Questions & Answers

**Q: What happens to my existing stock?**
A: All existing stock is automatically migrated. Each old stock group becomes a shipment with one perfume. No data is lost.

**Q: Can I still add stock one perfume at a time?**
A: Yes! Just create a shipment with one perfume. Set transport to 0 if there's no transport cost.

**Q: How do I group multiple perfumes?**
A: Click "Add Stock Shipment", fill in shared info, then click "Add Another Perfume" to add more items.

**Q: What if I forget transport cost when creating?**
A: Stock can't be edited after creation (for audit purposes). You'll need to delete and recreate. In the future, we may add shipment editing.

**Q: Do financial calculations change?**
A: No, they remain accurate. Total investment now correctly includes transport costs without duplication.

## Summary

This update transforms the stock management system from individual stock entries to shipment-based organization, providing:
- ✅ More accurate cost tracking
- ✅ Better bulk purchase management
- ✅ Organized stock history
- ✅ Easier data entry
- ✅ Backward compatibility

All existing functionality is preserved while adding powerful new capabilities.
