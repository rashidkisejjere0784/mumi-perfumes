/**
 * Fix foreign key references in sale_items and decant_tracking tables
 * These tables incorrectly reference "stock_groups_old" instead of "stock_groups"
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'mumi_perfumes.db');
const db = new Database(dbPath);

console.log('Fixing foreign key references...\n');

try {
  // Start transaction
  db.exec('BEGIN TRANSACTION');

  // 1. Fix sale_items table
  console.log('1. Backing up sale_items...');
  const saleItems = db.prepare('SELECT * FROM sale_items').all();
  console.log(`   Found ${saleItems.length} sale items`);

  console.log('2. Recreating sale_items table with correct foreign keys...');
  db.exec('DROP TABLE IF EXISTS sale_items');
  db.exec(`
    CREATE TABLE sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      perfume_id INTEGER NOT NULL,
      stock_group_id INTEGER NOT NULL,
      sale_type TEXT NOT NULL CHECK(sale_type IN ('full_bottle', 'decant')),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (perfume_id) REFERENCES perfumes(id),
      FOREIGN KEY (stock_group_id) REFERENCES stock_groups(id)
    )
  `);

  // Restore sale_items data
  if (saleItems.length > 0) {
    console.log('3. Restoring sale_items data...');
    const insertSaleItem = db.prepare(`
      INSERT INTO sale_items (id, sale_id, perfume_id, stock_group_id, sale_type, quantity, unit_price, subtotal, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of saleItems) {
      insertSaleItem.run(
        item.id,
        item.sale_id,
        item.perfume_id,
        item.stock_group_id,
        item.sale_type,
        item.quantity,
        item.unit_price,
        item.subtotal,
        item.created_at
      );
    }
    console.log(`   Restored ${saleItems.length} sale items`);
  }

  // Create indexes for sale_items
  console.log('4. Creating sale_items indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_perfume ON sale_items(perfume_id);
  `);

  // 2. Fix decant_tracking table
  console.log('5. Backing up decant_tracking...');
  const decantTracking = db.prepare('SELECT * FROM decant_tracking').all();
  console.log(`   Found ${decantTracking.length} tracking records`);

  console.log('6. Recreating decant_tracking table with correct foreign keys...');
  db.exec('DROP TABLE IF EXISTS decant_tracking');
  db.exec(`
    CREATE TABLE decant_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_group_id INTEGER NOT NULL,
      perfume_id INTEGER NOT NULL,
      decants_sold INTEGER NOT NULL DEFAULT 0,
      bottles_sold INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_group_id) REFERENCES stock_groups(id),
      FOREIGN KEY (perfume_id) REFERENCES perfumes(id),
      UNIQUE(stock_group_id)
    )
  `);

  // Restore decant_tracking data
  if (decantTracking.length > 0) {
    console.log('7. Restoring decant_tracking data...');
    const insertTracking = db.prepare(`
      INSERT INTO decant_tracking (id, stock_group_id, perfume_id, decants_sold, bottles_sold, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const track of decantTracking) {
      insertTracking.run(
        track.id,
        track.stock_group_id,
        track.perfume_id,
        track.decants_sold,
        track.bottles_sold,
        track.created_at
      );
    }
    console.log(`   Restored ${decantTracking.length} tracking records`);
  }

  // Commit transaction
  db.exec('COMMIT');

  console.log('\n✓ Foreign key references fixed successfully!');
  console.log('\nAll tables now correctly reference "stock_groups" instead of "stock_groups_old"');

} catch (error) {
  console.error('\n✗ Fix failed:', error.message);
  console.error(error);
  db.exec('ROLLBACK');
  console.log('Database rolled back to previous state.');
  process.exit(1);
} finally {
  db.close();
}
