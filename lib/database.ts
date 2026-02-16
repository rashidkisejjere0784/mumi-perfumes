import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/* ── Types ── */

type RunResult = { lastInsertRowid: number; changes: number };

export type PreparedStatement = {
  get: (...params: any[]) => Promise<any>;
  all: (...params: any[]) => Promise<any[]>;
  run: (...params: any[]) => Promise<RunResult>;
};

export type DatabaseAdapter = {
  prepare: (sql: string) => PreparedStatement;
  exec: (sql: string) => Promise<void>;
  transaction: <T>(fn: () => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

/* ── SQL helpers ── */

function toMySql(sql: string): string {
  return sql
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'BIGINT AUTO_INCREMENT PRIMARY KEY')
    .replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT IGNORE')
    .replace(/strftime\(\s*'%Y-%m'\s*,\s*([^)]+)\)/gi, "DATE_FORMAT($1, '%Y-%m')")
    // date('now', '-N months') → DATE_SUB(CURDATE(), INTERVAL N MONTH)
    .replace(/date\('now'\s*,\s*'-(\d+)\s+months?'\)/gi, 'DATE_SUB(CURDATE(), INTERVAL $1 MONTH)')
    // date('now', '-N days') → DATE_SUB(CURDATE(), INTERVAL N DAY)
    .replace(/date\('now'\s*,\s*'-(\d+)\s+days?'\)/gi, 'DATE_SUB(CURDATE(), INTERVAL $1 DAY)')
    .replace(/DATE\('now'\)/gi, 'CURDATE()')
    // Fix 'now' string literal inside DATE_FORMAT (from strftime conversion)
    .replace(/DATE_FORMAT\(\s*'now'/gi, 'DATE_FORMAT(NOW()')
    .replace(/\bREAL\b/gi, 'DOUBLE')
    .replace(/\bTEXT\s+NOT\s+NULL\s+UNIQUE/gi, 'VARCHAR(255) NOT NULL UNIQUE')
    .replace(/\bTEXT\s+NOT\s+NULL\s+DEFAULT\s+/gi, 'VARCHAR(255) NOT NULL DEFAULT ')
    .replace(/\bTEXT\s+NOT\s+NULL\s+CHECK\s*\(/gi, 'VARCHAR(100) NOT NULL CHECK(')
    .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'CREATE INDEX');
}

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/* ── MySQL Adapter ── */

class MySqlAdapter implements DatabaseAdapter {
  private pool: Pool;
  private _initDone = false;
  private _initPromise: Promise<void> | null = null;
  private _txConn: PoolConnection | null = null;

  constructor(url: string) {
    const parsed = new URL(url);
    this.pool = mysql.createPool({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      ssl: undefined,
    });
  }

  private async ensureInit() {
    if (this._initDone) return;
    if (!this._initPromise) {
      this._initPromise = this._doInit();
    }
    await this._initPromise;
    this._initDone = true;
  }

  private conn(): Pool | PoolConnection {
    return this._txConn || this.pool;
  }

  /* ── public interface ── */

  prepare(sql: string): PreparedStatement {
    const self = this;
    const transformed = toMySql(sql);
    return {
      async get(...params: any[]) {
        await self.ensureInit();
        const [rows] = await self.conn().execute<RowDataPacket[]>(transformed, params);
        return rows[0] ?? undefined;
      },
      async all(...params: any[]) {
        await self.ensureInit();
        const [rows] = await self.conn().execute<RowDataPacket[]>(transformed, params);
        return rows as any[];
      },
      async run(...params: any[]) {
        await self.ensureInit();
        const [result] = await self.conn().execute<ResultSetHeader>(transformed, params);
        return {
          lastInsertRowid: Number(result.insertId || 0),
          changes: Number(result.affectedRows || 0),
        };
      },
    };
  }

  async exec(sql: string) {
    await this.ensureInit();
    const stmts = splitStatements(toMySql(sql));
    for (const s of stmts) {
      try {
        await this.conn().query(s);
      } catch (err: any) {
        if (err?.code === 'ER_DUP_KEYNAME' || err?.code === 'ER_DUP_FIELDNAME') continue;
        throw err;
      }
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureInit();
    const c = await this.pool.getConnection();
    this._txConn = c;
    await c.beginTransaction();
    try {
      const result = await fn();
      await c.commit();
      return result;
    } catch (err) {
      await c.rollback();
      throw err;
    } finally {
      this._txConn = null;
      c.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  /* ── internal: schema init (uses pool directly, no ensureInit guard) ── */

  private async _doInit() {
    const p = this.pool;

    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        is_active INT NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS perfumes (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        volume_ml INT NOT NULL,
        estimated_decants_per_bottle INT NOT NULL,
        is_out_of_stock INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS stock_shipments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        shipment_name VARCHAR(255) NULL,
        transport_cost DOUBLE DEFAULT 0,
        other_expenses DOUBLE DEFAULT 0,
        total_additional_expenses DOUBLE DEFAULT 0,
        purchase_date DATE NOT NULL,
        funded_from VARCHAR(50) NOT NULL DEFAULT 'sales',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS stock_groups (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        shipment_id BIGINT NOT NULL,
        perfume_id BIGINT NOT NULL,
        quantity INT NOT NULL,
        buying_cost_per_bottle DOUBLE NOT NULL,
        subtotal_cost DOUBLE NOT NULL,
        remaining_quantity INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shipment_id) REFERENCES stock_shipments(id),
        FOREIGN KEY (perfume_id) REFERENCES perfumes(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(255) NULL,
        payment_method VARCHAR(100) NOT NULL,
        total_amount DOUBLE NOT NULL,
        amount_paid DOUBLE NOT NULL,
        debt_amount DOUBLE DEFAULT 0,
        sale_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        sale_id BIGINT NOT NULL,
        perfume_id BIGINT NOT NULL,
        stock_group_id BIGINT NOT NULL,
        sale_type VARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        unit_price DOUBLE NOT NULL,
        subtotal DOUBLE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (perfume_id) REFERENCES perfumes(id),
        FOREIGN KEY (stock_group_id) REFERENCES stock_groups(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS decant_tracking (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        stock_group_id BIGINT NOT NULL,
        perfume_id BIGINT NOT NULL,
        decants_sold INT NOT NULL DEFAULT 0,
        bottles_sold INT NOT NULL DEFAULT 0,
        bottles_done INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_decant_stock (stock_group_id),
        FOREIGN KEY (stock_group_id) REFERENCES stock_groups(id),
        FOREIGN KEY (perfume_id) REFERENCES perfumes(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS decant_bottle_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        stock_group_id BIGINT NOT NULL,
        perfume_id BIGINT NOT NULL,
        bottle_sequence INT NOT NULL,
        decants_obtained INT NOT NULL,
        completion_source VARCHAR(50) NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_group_id) REFERENCES stock_groups(id),
        FOREIGN KEY (perfume_id) REFERENCES perfumes(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS deleted_bottles (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        stock_group_id BIGINT NOT NULL,
        perfume_id BIGINT NOT NULL,
        quantity_removed INT NOT NULL DEFAULT 1,
        reason VARCHAR(255) NOT NULL DEFAULT 'out_of_stock',
        note TEXT NULL,
        removed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_group_id) REFERENCES stock_groups(id),
        FOREIGN KEY (perfume_id) REFERENCES perfumes(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS custom_inventory_categories (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT NULL,
        is_active INT NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS custom_inventory_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(255) NOT NULL,
        unit_label VARCHAR(100) NULL,
        default_ml DOUBLE NULL,
        is_active INT NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS custom_inventory_stock_entries (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        shipment_id BIGINT NULL,
        item_id BIGINT NOT NULL,
        quantity_added INT NOT NULL,
        remaining_quantity INT NOT NULL,
        unit_cost DOUBLE NOT NULL,
        purchase_date DATE NOT NULL,
        note TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shipment_id) REFERENCES stock_shipments(id),
        FOREIGN KEY (item_id) REFERENCES custom_inventory_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS debt_payments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        sale_id BIGINT NOT NULL,
        amount_paid DOUBLE NOT NULL,
        payment_date DATE NOT NULL,
        payment_method VARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        description VARCHAR(500) NOT NULL,
        amount DOUBLE NOT NULL,
        category VARCHAR(255) NULL,
        expense_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS investments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        description VARCHAR(500) NOT NULL,
        amount DOUBLE NOT NULL,
        investment_date DATE NOT NULL,
        source_shipment_id BIGINT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS cash_adjustments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        previous_amount DOUBLE NOT NULL,
        new_amount DOUBLE NOT NULL,
        adjustment DOUBLE NOT NULL,
        reason VARCHAR(500) NULL,
        adjusted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Indexes (ignore duplicates)
    const indexes = [
      'CREATE INDEX idx_stock_shipments_date ON stock_shipments(purchase_date)',
      'CREATE INDEX idx_stock_groups_shipment ON stock_groups(shipment_id)',
      'CREATE INDEX idx_stock_groups_perfume ON stock_groups(perfume_id)',
      'CREATE INDEX idx_sales_date ON sales(sale_date)',
      'CREATE INDEX idx_sale_items_sale ON sale_items(sale_id)',
      'CREATE INDEX idx_sale_items_perfume ON sale_items(perfume_id)',
      'CREATE INDEX idx_debt_payments_sale ON debt_payments(sale_id)',
      'CREATE INDEX idx_expenses_date ON expenses(expense_date)',
      'CREATE INDEX idx_investments_source ON investments(source_shipment_id)',
      'CREATE INDEX idx_decant_logs_stock ON decant_bottle_logs(stock_group_id)',
      'CREATE INDEX idx_deleted_bottles_stock ON deleted_bottles(stock_group_id)',
      'CREATE INDEX idx_deleted_bottles_at ON deleted_bottles(removed_at)',
      'CREATE INDEX idx_ci_categories_name ON custom_inventory_categories(name)',
      'CREATE INDEX idx_ci_items_category ON custom_inventory_items(category)',
      'CREATE INDEX idx_ci_stock_item ON custom_inventory_stock_entries(item_id)',
      'CREATE INDEX idx_ci_stock_shipment ON custom_inventory_stock_entries(shipment_id)',
      'CREATE INDEX idx_ci_stock_date ON custom_inventory_stock_entries(purchase_date)',
    ];
    for (const idx of indexes) {
      try { await p.query(idx); } catch (e: any) { if (e?.code !== 'ER_DUP_KEYNAME') throw e; }
    }

    // Seed default categories
    await p.execute(
      `INSERT IGNORE INTO custom_inventory_categories (name, description, is_active) VALUES (?, ?, 1)`,
      ['decant_bottle', 'Bottles used for decants (usually ml-based)'],
    );
    await p.execute(
      `INSERT IGNORE INTO custom_inventory_categories (name, description, is_active) VALUES (?, ?, 1)`,
      ['polythene', 'Packaging polythenes'],
    );
    await p.execute(
      `INSERT IGNORE INTO custom_inventory_categories (name, description, is_active) VALUES (?, ?, 1)`,
      ['packaging', 'General packaging supplies'],
    );

    // Seed default custom inventory items
    await p.execute(
      `INSERT IGNORE INTO custom_inventory_items (name, category, unit_label, default_ml, is_active) VALUES (?, ?, ?, ?, 1)`,
      ['Decant Bottle', 'decant_bottle', 'bottle', 10],
    );
    await p.execute(
      `INSERT IGNORE INTO custom_inventory_items (name, category, unit_label, default_ml, is_active) VALUES (?, ?, ?, ?, 1)`,
      ['Polythene', 'polythene', 'piece', null],
    );

    // Create default admin user if none exist
    const [rows] = await p.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM users');
    const count = Number(rows[0]?.count || 0);
    if (count === 0) {
      const bcrypt = require('bcryptjs');
      const username = (process.env.DEFAULT_ADMIN_USERNAME || 'admin').trim();
      const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const fullName = (process.env.DEFAULT_ADMIN_FULL_NAME || 'Administrator').trim();
      const role = (process.env.DEFAULT_ADMIN_ROLE || 'admin').trim();
      const hash = bcrypt.hashSync(password, 10);
      await p.execute(
        'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [username, hash, fullName, role],
      );
      console.log(`✓ Default admin user created (username: ${username})`);
    }
  }
}

/* ── Singleton ── */

let adapter: MySqlAdapter | null = null;

export function getDatabase(): DatabaseAdapter {
  if (!adapter) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) throw new Error('DATABASE_URL environment variable is required.');
    if (!url.startsWith('mysql://')) throw new Error('DATABASE_URL must be a mysql:// URL.');
    adapter = new MySqlAdapter(url);
  }
  return adapter;
}

export async function closeDatabase(): Promise<void> {
  if (adapter) {
    await adapter.close();
    adapter = null;
  }
}
