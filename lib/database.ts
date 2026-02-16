import Database from 'better-sqlite3';
import path from 'path';

const SyncMySQL = require('sync-mysql');

type RunResult = { lastInsertRowid: number; changes: number };
type PreparedStatement = {
  get: (...params: any[]) => any;
  all: (...params: any[]) => any[];
  run: (...params: any[]) => RunResult;
};

export type DatabaseAdapter = {
  prepare: (sql: string) => PreparedStatement;
  exec: (sql: string) => void;
  transaction: <T>(fn: () => T) => () => T;
  pragma: (value: string) => void;
  close: () => void;
};

let db: DatabaseAdapter | null = null;

function toMySqlSyntax(sql: string): string {
  return sql
    .replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT IGNORE')
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'BIGINT AUTO_INCREMENT PRIMARY KEY')
    .replace(/\bINTEGER\b/gi, 'BIGINT')
    .replace(/strftime\('%Y-%m',\s*([^)]+)\)/gi, "DATE_FORMAT($1, '%Y-%m')")
    .replace(/DATE\('now'\)/gi, 'CURDATE()')
    .replace(/\bREAL\b/gi, 'DOUBLE')
    .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'CREATE INDEX');
}

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

class MySqlAdapter implements DatabaseAdapter {
  private conn: any;

  constructor(databaseUrl: string) {
    const parsed = new URL(databaseUrl);
    this.conn = new SyncMySQL({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      charset: 'utf8mb4',
      // Intentionally ignore ssl-mode query param as requested.
      ssl: false,
    });
  }

  pragma() {
    // No-op for MySQL
  }

  prepare(sql: string): PreparedStatement {
    const transformed = toMySqlSyntax(sql);
    return {
      get: (...params: any[]) => {
        const rows = this.conn.query(transformed, params);
        return Array.isArray(rows) ? rows[0] : undefined;
      },
      all: (...params: any[]) => {
        const rows = this.conn.query(transformed, params);
        return Array.isArray(rows) ? rows : [];
      },
      run: (...params: any[]) => {
        const result = this.conn.query(transformed, params) || {};
        return {
          lastInsertRowid: Number(result.insertId || 0),
          changes: Number(result.affectedRows || 0),
        };
      },
    };
  }

  exec(sql: string) {
    const statements = splitStatements(toMySqlSyntax(sql));
    for (const stmt of statements) {
      try {
        this.conn.query(stmt);
      } catch (error: any) {
        // Ignore duplicate index errors for idempotent init SQL.
        if (error?.code === 'ER_DUP_KEYNAME') {
          continue;
        }
        throw error;
      }
    }
  }

  transaction<T>(fn: () => T) {
    return () => {
      this.conn.query('START TRANSACTION');
      try {
        const result = fn();
        this.conn.query('COMMIT');
        return result;
      } catch (error) {
        this.conn.query('ROLLBACK');
        throw error;
      }
    };
  }

  close() {
    try {
      this.conn.dispose?.();
    } catch (_) {
      // no-op
    }
  }
}

class SqliteAdapter implements DatabaseAdapter {
  constructor(private readonly sqlite: Database.Database) {}

  pragma(value: string) {
    this.sqlite.pragma(value);
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.sqlite.prepare(sql);
    return {
      get: (...params: any[]) => stmt.get(...params),
      all: (...params: any[]) => stmt.all(...params) as any[],
      run: (...params: any[]) => {
        const result = stmt.run(...params);
        return {
          lastInsertRowid: Number(result.lastInsertRowid || 0),
          changes: Number(result.changes || 0),
        };
      },
    };
  }

  exec(sql: string) {
    this.sqlite.exec(sql);
  }

  transaction<T>(fn: () => T) {
    return this.sqlite.transaction(fn) as () => T;
  }

  close() {
    this.sqlite.close();
  }
}

export function getDatabase(): DatabaseAdapter {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      if (!databaseUrl) {
        throw new Error('DATABASE_URL is required in production.');
      }
      if (!databaseUrl.startsWith('mysql://')) {
        throw new Error('Production DATABASE_URL must be a mysql:// URL.');
      }
      db = new MySqlAdapter(databaseUrl);
    } else if (databaseUrl && databaseUrl.startsWith('mysql://')) {
      // Allow using dedicated MySQL in non-production too.
      db = new MySqlAdapter(databaseUrl);
    } else {
      // Non-production fallback for local development.
      const dbPath = path.join(process.cwd(), 'mumi_perfumes.db');
      const sqlite = new Database(dbPath);
      db = new SqliteAdapter(sqlite);
      db.pragma('journal_mode = WAL');
    }
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: DatabaseAdapter) {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Create perfumes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS perfumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      volume_ml INTEGER NOT NULL,
      estimated_decants_per_bottle INTEGER NOT NULL,
      is_out_of_stock INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    db.exec(`ALTER TABLE perfumes ADD COLUMN is_out_of_stock INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {
    // Column already exists
  }

  // Create stock_shipments table - tracks bulk purchases/shipments
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_name TEXT,
      transport_cost REAL DEFAULT 0,
      other_expenses REAL DEFAULT 0,
      total_additional_expenses REAL DEFAULT 0,
      purchase_date DATE NOT NULL,
      funded_from TEXT NOT NULL DEFAULT 'sales',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    db.exec(`ALTER TABLE stock_shipments ADD COLUMN funded_from TEXT DEFAULT 'sales'`);
  } catch (_) {
    // Column already exists (e.g. table was created with funded_from)
  }

  // Create stock_groups table - tracks individual perfumes in each shipment
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_groups (
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

  // Create sales table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      payment_method TEXT NOT NULL,
      total_amount REAL NOT NULL,
      amount_paid REAL NOT NULL,
      debt_amount REAL DEFAULT 0,
      sale_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sale_items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
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

  // Create decant_tracking table - tracks actual decants sold per stock group
  db.exec(`
    CREATE TABLE IF NOT EXISTS decant_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_group_id INTEGER NOT NULL,
      perfume_id INTEGER NOT NULL,
      decants_sold INTEGER NOT NULL DEFAULT 0,
      bottles_sold INTEGER NOT NULL DEFAULT 0,
      bottles_done INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_group_id) REFERENCES stock_groups(id),
      FOREIGN KEY (perfume_id) REFERENCES perfumes(id),
      UNIQUE(stock_group_id)
    )
  `);
  try {
    db.exec(`ALTER TABLE decant_tracking ADD COLUMN bottles_done INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {
    // Column already exists
  }

  // Tracks completed bottles from decanting (auto at 10 decants or manual mark)
  db.exec(`
    CREATE TABLE IF NOT EXISTS decant_bottle_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_group_id INTEGER NOT NULL,
      perfume_id INTEGER NOT NULL,
      bottle_sequence INTEGER NOT NULL,
      decants_obtained INTEGER NOT NULL,
      completion_source TEXT NOT NULL CHECK(completion_source IN ('auto', 'manual')),
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_group_id) REFERENCES stock_groups(id),
      FOREIGN KEY (perfume_id) REFERENCES perfumes(id)
    )
  `);

  // Tracks bottles removed from inventory as out-of-stock/damaged/etc.
  db.exec(`
    CREATE TABLE IF NOT EXISTS deleted_bottles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_group_id INTEGER NOT NULL,
      perfume_id INTEGER NOT NULL,
      quantity_removed INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL DEFAULT 'out_of_stock',
      note TEXT,
      removed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_group_id) REFERENCES stock_groups(id),
      FOREIGN KEY (perfume_id) REFERENCES perfumes(id)
    )
  `);

  // Custom inventory items (e.g. decant bottles, polythenes, user-defined items)
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_inventory_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      unit_label TEXT,
      default_ml REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Stock entries for custom inventory items
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_inventory_stock_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER,
      item_id INTEGER NOT NULL,
      quantity_added INTEGER NOT NULL,
      remaining_quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      purchase_date DATE NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shipment_id) REFERENCES stock_shipments(id),
      FOREIGN KEY (item_id) REFERENCES custom_inventory_items(id)
    )
  `);
  try {
    db.exec(`ALTER TABLE custom_inventory_stock_entries ADD COLUMN shipment_id INTEGER`);
  } catch (_) {
    // Column already exists
  }

  // Create debt_payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      amount_paid REAL NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    )
  `);

  // Create expenses table - for additional business expenses
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      expense_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create investments table - manual investment tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      investment_date DATE NOT NULL,
      source_shipment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    db.exec(`ALTER TABLE investments ADD COLUMN source_shipment_id INTEGER`);
  } catch (_) {
    // Column already exists
  }

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_stock_shipments_date ON stock_shipments(purchase_date);
    CREATE INDEX IF NOT EXISTS idx_stock_groups_shipment ON stock_groups(shipment_id);
    CREATE INDEX IF NOT EXISTS idx_stock_groups_perfume ON stock_groups(perfume_id);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_perfume ON sale_items(perfume_id);
    CREATE INDEX IF NOT EXISTS idx_debt_payments_sale ON debt_payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_investments_source_shipment ON investments(source_shipment_id);
    CREATE INDEX IF NOT EXISTS idx_decant_bottle_logs_stock ON decant_bottle_logs(stock_group_id);
    CREATE INDEX IF NOT EXISTS idx_deleted_bottles_stock ON deleted_bottles(stock_group_id);
    CREATE INDEX IF NOT EXISTS idx_deleted_bottles_removed_at ON deleted_bottles(removed_at);
    CREATE INDEX IF NOT EXISTS idx_custom_inventory_categories_name ON custom_inventory_categories(name);
    CREATE INDEX IF NOT EXISTS idx_custom_inventory_items_category ON custom_inventory_items(category);
    CREATE INDEX IF NOT EXISTS idx_custom_inventory_stock_item ON custom_inventory_stock_entries(item_id);
    CREATE INDEX IF NOT EXISTS idx_custom_inventory_stock_shipment ON custom_inventory_stock_entries(shipment_id);
    CREATE INDEX IF NOT EXISTS idx_custom_inventory_stock_date ON custom_inventory_stock_entries(purchase_date);
  `);

  db.prepare(`
    INSERT OR IGNORE INTO custom_inventory_categories (name, description, is_active)
    VALUES (?, ?, 1)
  `).run('decant_bottle', 'Bottles used for decants (usually ml-based)');
  db.prepare(`
    INSERT OR IGNORE INTO custom_inventory_categories (name, description, is_active)
    VALUES (?, ?, 1)
  `).run('polythene', 'Packaging polythenes');
  db.prepare(`
    INSERT OR IGNORE INTO custom_inventory_categories (name, description, is_active)
    VALUES (?, ?, 1)
  `).run('packaging', 'General packaging supplies');

  // Seed required custom inventory items if missing
  db.prepare(`
    INSERT OR IGNORE INTO custom_inventory_items (name, category, unit_label, default_ml, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run('Decant Bottle', 'decant_bottle', 'bottle', 10);

  db.prepare(`
    INSERT OR IGNORE INTO custom_inventory_items (name, category, unit_label, default_ml, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run('Polythene', 'polythene', 'piece', null);

  // Create default admin user if no users exist.
  // Credentials are configurable via env and fall back to admin/admin123.
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const bcrypt = require('bcryptjs');
    const defaultUsername = (process.env.DEFAULT_ADMIN_USERNAME || 'admin').trim();
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const defaultFullName = (process.env.DEFAULT_ADMIN_FULL_NAME || 'Administrator').trim();
    const defaultRole = (process.env.DEFAULT_ADMIN_ROLE || 'admin').trim();
    const defaultPasswordHash = bcrypt.hashSync(defaultPassword, 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `).run(defaultUsername, defaultPasswordHash, defaultFullName, defaultRole);
    console.log(`✓ Default admin user created (username: ${defaultUsername})`);
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
