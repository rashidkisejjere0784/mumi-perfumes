# Stock Shipment Management

## Overview

The POS system now supports **shipment-based stock management**, allowing you to add multiple perfumes in a single purchase/shipment while sharing common expenses like transport costs.

## How It Works

### Old System (Individual Stock)
Previously, each perfume had its own stock entry with individual additional expenses:
- Perfume A: 5 bottles + $50 transport
- Perfume B: 10 bottles + $50 transport (duplicate cost!)

### New System (Shipment-Based)
Now you can group multiple perfumes into one shipment with shared expenses:
- **Shipment:** "Dubai Order Jan 2024"
  - Transport: $50
  - Other Expenses: $20
  - **Perfume A:** 5 bottles @ $100/bottle
  - **Perfume B:** 10 bottles @ $80/bottle
  - **Perfume C:** 3 bottles @ $150/bottle

Total cost = (5×100 + 10×80 + 3×150) + 50 + 20 = $1,820

## Database Structure

### `stock_shipments` Table
Tracks bulk purchases/shipments:
- `id`: Unique shipment ID
- `shipment_name`: Optional name (e.g., "Dubai Shipment Jan 2024")
- `transport_cost`: Shared transport/shipping cost
- `other_expenses`: Other shared expenses (packaging, taxes, etc.)
- `total_additional_expenses`: Sum of transport and other expenses
- `purchase_date`: Date of purchase
- `created_at`: Timestamp

### `stock_groups` Table
Tracks individual perfumes within each shipment:
- `id`: Unique stock group ID
- `shipment_id`: References `stock_shipments.id`
- `perfume_id`: References `perfumes.id`
- `quantity`: Number of bottles
- `buying_cost_per_bottle`: Cost per bottle for this perfume
- `subtotal_cost`: quantity × buying_cost_per_bottle
- `remaining_quantity`: Bottles not yet sold
- `created_at`: Timestamp

## Using the UI

### Adding a Stock Shipment

1. Go to **Inventory Management**
2. Click **"Add Stock Shipment"**
3. Fill in **Shipment Information:**
   - Shipment Name (optional, e.g., "Dubai Order Feb 2024")
   - Purchase Date
   - Transport Cost (shared across all perfumes)
   - Other Expenses (shared across all perfumes)

4. Add **Perfumes:**
   - Select perfume from dropdown
   - Enter quantity (bottles)
   - Enter cost per bottle
   - Click **"Add Another Perfume"** to add more

5. Review the **Total Summary:**
   - Perfumes Cost: Sum of all perfume subtotals
   - Transport + Other: Shared expenses
   - **Total Shipment Cost:** Grand total

6. Click **"Add Shipment"**

### Viewing Stock

The Stock Shipments table shows:
- **Shipment / Perfume:** Perfume name with shipment name (if provided) shown below with 📦 icon
- **Purchase Date:** Date of purchase
- **Qty:** Initial quantity purchased
- **Remaining:** Current stock remaining
- **Cost/Bottle:** Buying cost per bottle
- **Subtotal:** Cost for this perfume only (excluding shared expenses)
- **Sold:** Bottles and decants sold (e.g., "5b, 12d")
- **Actions:** View details or delete

## API Endpoints

### POST `/api/stock`

Create a new stock shipment with multiple perfumes.

**Request Body:**
```json
{
  "shipment_name": "Dubai Order Jan 2024",
  "transport_cost": 50000,
  "other_expenses": 20000,
  "purchase_date": "2024-01-15",
  "items": [
    {
      "perfume_id": 1,
      "quantity": 5,
      "buying_cost_per_bottle": 100000
    },
    {
      "perfume_id": 2,
      "quantity": 10,
      "buying_cost_per_bottle": 80000
    }
  ]
}
```

**Response:**
```json
{
  "shipment_id": 123,
  "stocks": [
    {
      "id": 456,
      "shipment_id": 123,
      "perfume_id": 1,
      "perfume_name": "Oud Royal",
      "quantity": 5,
      "buying_cost_per_bottle": 100000,
      "subtotal_cost": 500000,
      "remaining_quantity": 5,
      "purchase_date": "2024-01-15",
      "transport_cost": 50000,
      "other_expenses": 20000,
      "shipment_name": "Dubai Order Jan 2024"
    },
    ...
  ]
}
```

### GET `/api/stock`

Retrieve all stock groups with shipment details.

**Query Parameters:**
- `perfume_id` (optional): Filter by perfume ID

**Response:**
```json
[
  {
    "id": 456,
    "shipment_id": 123,
    "perfume_id": 1,
    "perfume_name": "Oud Royal",
    "quantity": 5,
    "buying_cost_per_bottle": 100000,
    "subtotal_cost": 500000,
    "remaining_quantity": 3,
    "purchase_date": "2024-01-15",
    "transport_cost": 50000,
    "other_expenses": 20000,
    "shipment_name": "Dubai Order Jan 2024",
    "decants_sold": 10,
    "bottles_sold": 2
  },
  ...
]
```

## Benefits

1. **Accurate Cost Tracking:** Transport costs are shared proportionally among all perfumes in a shipment
2. **Simplified Entry:** Add multiple perfumes at once instead of entering each separately
3. **Better Organization:** Group related purchases together (e.g., by supplier or date)
4. **Historical Context:** Track which perfumes were ordered together
5. **Prevents Duplicate Costs:** No more accidentally adding transport cost to each perfume

## Migration

Existing databases are automatically migrated when the application starts. The migration:
1. Creates `stock_shipments` table
2. Updates `stock_groups` structure
3. Migrates existing stock groups to individual shipments
4. Maintains referential integrity with sales and tracking data

You can also manually run the migration:
```bash
node scripts/migrate-to-shipments.js
```

## Example Scenarios

### Scenario 1: Single Perfume Purchase
- Shipment Name: "Local Purchase"
- Transport: 0 UGX
- Items: 1 perfume, 10 bottles @ 50,000 UGX/bottle
- **Total: 500,000 UGX**

### Scenario 2: Bulk Import
- Shipment Name: "Dubai Import Feb 2024"
- Transport: 200,000 UGX
- Other Expenses: 50,000 UGX (customs, packaging)
- Items:
  - Oud Royal: 20 bottles @ 150,000 UGX
  - Amber Nights: 15 bottles @ 120,000 UGX
  - Rose Garden: 10 bottles @ 100,000 UGX
- **Total: 6,050,000 UGX**

### Scenario 3: Mixed Purchase
- Shipment Name: "Supplier A - Weekly Order"
- Transport: 30,000 UGX
- Items:
  - 5 different perfumes with varying quantities and prices
- **Shared transport cost across all perfumes**

## Financial Calculations

### Total Investment
Includes all shipment costs:
```
Total Investment = Σ(subtotal_cost) + Σ(transport_cost + other_expenses)
```

### Profit Calculation
Considers actual purchase cost including proportional share of shared expenses:
```
Profit = Sales Revenue - (Perfume Cost + Proportional Shared Expenses)
```

## Notes

- Shipment names are optional but recommended for organization
- Transport and other expenses default to 0 if not specified
- You must add at least one perfume to a shipment
- Stock cannot be edited after creation (for audit purposes)
- Deleting a stock group is only allowed if no sales reference it
- Each perfume in a shipment maintains its own inventory tracking
