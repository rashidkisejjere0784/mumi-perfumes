/**
 * Migration script to convert old stock_groups structure to new shipment-based structure
 * 
 * Old structure:
 * - stock_groups table had: perfume_id, quantity, buying_cost_per_bottle, additional_expenses, total_cost, purchase_date
 * 
 * New structure:
 * - stock_shipments table: shipment_name, transport_cost, other_expenses, total_additional_expenses, purchase_date
 * - stock_groups table: shipment_id, perfume_id, quantity, buying_cost_per_bottle, subtotal_cost, remaining_quantity
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'mumi_perfumes.db');
const db = new Database(dbPath);

console.log('Starting migration to shipment-based structure...\n');

try {
  // Start transaction
  db.exec('BEGIN TRANSACTION');

  // Check if migration is needed by checking if stock_groups has shipment_id column
  const tableInfo = db.prepare("PRAGMA table_info(stock_groups)").all();
  const hasShipmentId = tableInfo.some(col => col.name === 'shipment_id');

  if (hasShipmentId) {
    console.log('✓ Migration already completed. stock_groups table has shipment_id column.');
    db.exec('ROLLBACK');
    process.exit(0);
  }

  console.log('Found old schema. Starting migration...\n');

  // Backup old stock_groups data
  console.log('1. Backing up existing stock_groups data...');
  const oldStockGroups = db.prepare('SELECT * FROM stock_groups').all();
  console.log(`   Found ${oldStockGroups.length} stock groups to migrate`);

  // Drop old indexes
  console.log('2. Dropping old indexes...');
  db.exec('DROP INDEX IF EXISTS idx_stock_groups_perfume');

  // Rename old table
  console.log('3. Renaming old stock_groups table...');
  db.exec('ALTER TABLE stock_groups RENAME TO stock_groups_old');

  // Create new stock_groups table
  console.log('4. Creating new stock_groups table...');
  db.exec(`
    CREATE TABLE stock_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      perfume_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      buying_cost_per_bottle REAL NOT NULL,
      subtotal_cost REAL NOT NULL,
      remaining_quantity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shipment_id) REFERENCES stock_shipments(id),
      FOREIGN KEY (perfume_id) REFERENCES perfumes(id)
    )
  `);

  // Create indexes
  console.log('5. Creating new indexes...');
  db.exec(`
    CREATE INDEX idx_stock_groups_shipment ON stock_groups(shipment_id);
    CREATE INDEX idx_stock_groups_perfume ON stock_groups(perfume_id);
  `);

  // Migrate data
  console.log('6. Migrating stock data...');
  const shipmentInsert = db.prepare(`
    INSERT INTO stock_shipments (shipment_name, transport_cost, other_expenses, total_additional_expenses, purchase_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const stockInsert = db.prepare(`
    INSERT INTO stock_groups (id, shipment_id, perfume_id, quantity, buying_cost_per_bottle, subtotal_cost, remaining_quantity, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const oldStock of oldStockGroups) {
    // Create a shipment for each old stock group
    const shipmentResult = shipmentInsert.run(
      `Migrated Stock #${oldStock.id}`,
      oldStock.additional_expenses || 0,
      0,
      oldStock.additional_expenses || 0,
      oldStock.purchase_date,
      oldStock.created_at
    );

    const shipmentId = shipmentResult.lastInsertRowid;

    // Calculate subtotal (without additional expenses)
    const subtotal = oldStock.quantity * oldStock.buying_cost_per_bottle;

    // Insert into new stock_groups with same ID to maintain referential integrity
    stockInsert.run(
      oldStock.id,
      shipmentId,
      oldStock.perfume_id,
      oldStock.quantity,
      oldStock.buying_cost_per_bottle,
      subtotal,
      oldStock.remaining_quantity,
      oldStock.created_at
    );
  }

  console.log(`   Migrated ${oldStockGroups.length} stock groups successfully`);

  // Update decant_tracking (should still reference stock_group_id correctly)
  console.log('7. Verifying decant_tracking integrity...');
  const trackingCount = db.prepare('SELECT COUNT(*) as count FROM decant_tracking').get();
  console.log(`   Found ${trackingCount.count} decant tracking records (no changes needed)`);

  // Update sale_items (references stock_group_id, should still work)
  console.log('8. Verifying sale_items integrity...');
  const saleItemsCount = db.prepare('SELECT COUNT(*) as count FROM sale_items').get();
  console.log(`   Found ${saleItemsCount.count} sale items (no changes needed)`);

  // Drop old table
  console.log('9. Dropping old stock_groups_old table...');
  db.exec('DROP TABLE stock_groups_old');

  // Commit transaction
  db.exec('COMMIT');

  console.log('\n✓ Migration completed successfully!');
  console.log('\nNew structure:');
  console.log('- stock_shipments: Groups multiple perfumes with shared transport costs');
  console.log('- stock_groups: Individual perfume entries within each shipment');
  console.log('\nYou can now add multiple perfumes in a single shipment with shared transport costs.');

} catch (error) {
  console.error('\n✗ Migration failed:', error.message);
  console.error(error);
  db.exec('ROLLBACK');
  console.log('Database rolled back to previous state.');
  process.exit(1);
} finally {
  db.close();
}
