import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { CreateStockGroupRequest, StockWithDetails } from '@/lib/types';

function ensureInvestmentShipmentLink(db: ReturnType<typeof getDatabase>) {
  try {
    db.exec(`ALTER TABLE investments ADD COLUMN source_shipment_id INTEGER`);
  } catch (_) {
    // Column already exists
  }
}

function syncShipmentCapitalInvestment(db: ReturnType<typeof getDatabase>, shipmentId: number) {
  ensureInvestmentShipmentLink(db);
  const shipment = db.prepare(`
    SELECT id, shipment_name, purchase_date, funded_from, total_additional_expenses
    FROM stock_shipments
    WHERE id = ?
  `).get(shipmentId) as {
    id: number;
    shipment_name?: string | null;
    purchase_date: string;
    funded_from: 'sales' | 'capital';
    total_additional_expenses: number;
  } | undefined;

  if (!shipment) {
    // If shipment no longer exists, remove linked investment rows.
    db.prepare('DELETE FROM investments WHERE source_shipment_id = ?').run(shipmentId);
    db.prepare(`DELETE FROM investments WHERE description LIKE ?`).run(`%Shipment #${shipmentId}%`);
    return;
  }

  const perfumeTotal = db.prepare(`
    SELECT COALESCE(SUM(subtotal_cost), 0) as total
    FROM stock_groups
    WHERE shipment_id = ?
  `).get(shipmentId) as { total: number };

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

  const customTotal = db.prepare(`
    SELECT COALESCE(SUM(quantity_added * unit_cost), 0) as total
    FROM custom_inventory_stock_entries
    WHERE shipment_id = ?
  `).get(shipmentId) as { total: number };

  const totalShipmentCost =
    Number(perfumeTotal.total || 0) +
    Number(customTotal.total || 0) +
    Number(shipment.total_additional_expenses || 0);

  if (shipment.funded_from !== 'capital' || totalShipmentCost <= 0) {
    db.prepare('DELETE FROM investments WHERE source_shipment_id = ?').run(shipmentId);
    db.prepare(`DELETE FROM investments WHERE description LIKE ?`).run(`%Shipment #${shipmentId}%`);
    if (shipment.shipment_name) {
      db.prepare(`DELETE FROM investments WHERE description = ?`).run(`Stock purchase (capital) - ${shipment.shipment_name}`);
    }
    return;
  }

  const desc = shipment.shipment_name
    ? `Stock purchase (capital) - ${shipment.shipment_name}`
    : `Stock purchase (capital) - Shipment #${shipmentId}`;

  const existing = db.prepare(`
    SELECT id
    FROM investments
    WHERE source_shipment_id = ?
    LIMIT 1
  `).get(shipmentId) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE investments
      SET description = ?, amount = ?, investment_date = ?
      WHERE id = ?
    `).run(desc, totalShipmentCost, shipment.purchase_date, existing.id);
  } else {
    const legacy = db.prepare(`
      SELECT id
      FROM investments
      WHERE source_shipment_id IS NULL
        AND (description = ? OR description LIKE ?)
      ORDER BY id DESC
      LIMIT 1
    `).get(desc, `%Shipment #${shipmentId}%`) as { id: number } | undefined;

    if (legacy) {
      db.prepare(`
        UPDATE investments
        SET description = ?, amount = ?, investment_date = ?, source_shipment_id = ?
        WHERE id = ?
      `).run(desc, totalShipmentCost, shipment.purchase_date, shipmentId, legacy.id);
    } else {
      db.prepare(`
        INSERT INTO investments (description, amount, investment_date, source_shipment_id)
        VALUES (?, ?, ?, ?)
      `).run(desc, totalShipmentCost, shipment.purchase_date, shipmentId);
    }
  }
}

// GET all stock groups with perfume and shipment details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const perfumeId = searchParams.get('perfume_id');

    const db = getDatabase();
    let query = `
      SELECT 
        sg.*,
        p.name as perfume_name,
        ss.purchase_date,
        ss.transport_cost,
        ss.other_expenses,
        ss.shipment_name,
        ss.funded_from,
        dt.decants_sold,
        dt.bottles_sold,
        dt.bottles_done,
        COALESCE((
          SELECT SUM(dbl.decants_obtained)
          FROM decant_bottle_logs dbl
          WHERE dbl.stock_group_id = sg.id
        ), 0) as completed_bottle_decants
      FROM stock_groups sg
      LEFT JOIN perfumes p ON sg.perfume_id = p.id
      LEFT JOIN stock_shipments ss ON sg.shipment_id = ss.id
      LEFT JOIN decant_tracking dt ON sg.id = dt.stock_group_id
    `;

    if (perfumeId) {
      query += ' WHERE sg.perfume_id = ?';
      const stocks = db.prepare(query + ' ORDER BY ss.purchase_date DESC').all(perfumeId) as StockWithDetails[];
      return NextResponse.json(stocks);
    }

    const stocks = db.prepare(query + ' ORDER BY ss.purchase_date DESC').all() as StockWithDetails[];
    return NextResponse.json(stocks);
  } catch (error) {
    console.error('Error fetching stock groups:', error);
    return NextResponse.json({ error: 'Failed to fetch stock groups' }, { status: 500 });
  }
}

// POST create new stock shipment with multiple perfumes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateStockGroupRequest & {
      custom_items?: Array<{
        item_id: number;
        quantity_added: number;
        unit_cost: number;
        note?: string;
      }>;
    };
    const { shipment_name, transport_cost, other_expenses, purchase_date, funded_from, items, custom_items } = body;

    if ((!items || items.length === 0) && (!custom_items || custom_items.length === 0)) {
      return NextResponse.json({ error: 'Add at least one perfume item or one custom inventory item' }, { status: 400 });
    }
    if (!purchase_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const total_additional_expenses = (transport_cost || 0) + (other_expenses || 0);
    const fundedFrom = funded_from === 'capital' ? 'capital' : 'sales';

    const db = getDatabase();

    // Create shipment
    const shipmentStmt = db.prepare(`
      INSERT INTO stock_shipments 
      (shipment_name, transport_cost, other_expenses, total_additional_expenses, purchase_date, funded_from)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const shipmentResult = shipmentStmt.run(
      shipment_name || null,
      transport_cost || 0,
      other_expenses || 0,
      total_additional_expenses,
      purchase_date,
      fundedFrom
    );

    const shipmentId = shipmentResult.lastInsertRowid;

    const perfumeItems = items || [];

    // Create stock groups for each perfume in the shipment
    const stockStmt = db.prepare(`
      INSERT INTO stock_groups 
      (shipment_id, perfume_id, quantity, buying_cost_per_bottle, subtotal_cost, remaining_quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const trackStmt = db.prepare(`
      INSERT INTO decant_tracking (stock_group_id, perfume_id, decants_sold, bottles_sold, bottles_done)
      VALUES (?, ?, 0, 0, 0)
    `);

    const createdStocks = [];

    for (const item of perfumeItems) {
      const subtotal_cost = item.quantity * item.buying_cost_per_bottle;
      const stockResult = stockStmt.run(
        shipmentId,
        item.perfume_id,
        item.quantity,
        item.buying_cost_per_bottle,
        subtotal_cost,
        item.quantity
      );

      // Initialize decant tracking
      trackStmt.run(stockResult.lastInsertRowid, item.perfume_id);

      createdStocks.push(stockResult.lastInsertRowid);
    }

    // Store custom inventory stock entries under this shipment
    const customItems = custom_items || [];
    if (customItems.length > 0) {
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

      const customInsert = db.prepare(`
        INSERT INTO custom_inventory_stock_entries
        (shipment_id, item_id, quantity_added, remaining_quantity, unit_cost, purchase_date, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of customItems) {
        if (!c.item_id || !c.quantity_added || c.quantity_added <= 0) continue;
        customInsert.run(
          shipmentId,
          c.item_id,
          c.quantity_added,
          c.quantity_added,
          c.unit_cost || 0,
          purchase_date,
          c.note || null
        );
      }
    }

    // Keep linked capital investment in sync for this shipment.
    syncShipmentCapitalInvestment(db, Number(shipmentId));

    // Fetch the complete shipment with all stock groups
    const newStocks = db.prepare(`
      SELECT 
        sg.*,
        p.name as perfume_name,
        ss.purchase_date,
        ss.transport_cost,
        ss.other_expenses,
        ss.shipment_name,
        ss.funded_from
      FROM stock_groups sg
      LEFT JOIN perfumes p ON sg.perfume_id = p.id
      LEFT JOIN stock_shipments ss ON sg.shipment_id = ss.id
      WHERE sg.shipment_id = ?
    `).all(shipmentId) as StockWithDetails[];

    return NextResponse.json({
      shipment_id: shipmentId,
      stocks: newStocks
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating stock shipment:', error);
    return NextResponse.json({ error: 'Failed to create stock shipment' }, { status: 500 });
  }
}

// PUT update existing shipment and all its stock items
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      shipment_id,
      shipment_name,
      transport_cost,
      other_expenses,
      purchase_date,
      funded_from,
      items,
      custom_items,
    } = body as {
      shipment_id: number;
      shipment_name?: string | null;
      transport_cost: number;
      other_expenses: number;
      purchase_date: string;
      funded_from?: 'sales' | 'capital';
      items: Array<{
        stock_group_id?: number;
        perfume_id: number;
        quantity: number;
        buying_cost_per_bottle: number;
      }>;
      custom_items?: Array<{
        id?: number;
        item_id: number;
        quantity_added: number;
        unit_cost: number;
        note?: string;
      }>;
    };

    if (!shipment_id || !Array.isArray(items) || items.length === 0 || !purchase_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();
    const shipment = db.prepare('SELECT id FROM stock_shipments WHERE id = ?').get(shipment_id);
    if (!shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    const total_additional_expenses = (Number(transport_cost) || 0) + (Number(other_expenses) || 0);

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE stock_shipments
        SET shipment_name = ?, transport_cost = ?, other_expenses = ?, total_additional_expenses = ?, purchase_date = ?, funded_from = ?
        WHERE id = ?
      `).run(
        shipment_name || null,
        Number(transport_cost) || 0,
        Number(other_expenses) || 0,
        total_additional_expenses,
        purchase_date,
        funded_from === 'capital' ? 'capital' : 'sales',
        shipment_id
      );

      const existingItems = db.prepare(`
        SELECT id, perfume_id, quantity, remaining_quantity
        FROM stock_groups
        WHERE shipment_id = ?
      `).all(shipment_id) as Array<{
        id: number;
        perfume_id: number;
        quantity: number;
        remaining_quantity: number;
      }>;

      const existingIds = new Set(existingItems.map((i) => i.id));
      const incomingIds = new Set(
        items
          .map((i) => Number(i.stock_group_id))
          .filter((id) => id && !Number.isNaN(id))
      );

      // Delete removed rows (only if no sales exist)
      for (const existing of existingItems) {
        if (!incomingIds.has(existing.id)) {
          const salesCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE stock_group_id = ?').get(existing.id) as { count: number };
          if (salesCount.count > 0) {
            throw new Error(`Cannot remove item ${existing.id}; it has sales records.`);
          }
          db.prepare('DELETE FROM decant_bottle_logs WHERE stock_group_id = ?').run(existing.id);
          db.prepare('DELETE FROM decant_tracking WHERE stock_group_id = ?').run(existing.id);
          db.prepare('DELETE FROM deleted_bottles WHERE stock_group_id = ?').run(existing.id);
          db.prepare('DELETE FROM stock_groups WHERE id = ?').run(existing.id);
        }
      }

      for (const item of items) {
        const perfumeId = Number(item.perfume_id);
        const quantity = Number(item.quantity);
        const cost = Number(item.buying_cost_per_bottle);
        if (!perfumeId || Number.isNaN(perfumeId) || !quantity || quantity <= 0 || Number.isNaN(cost) || cost < 0) {
          throw new Error('Invalid item data in shipment update');
        }

        const subtotal = quantity * cost;
        const stockGroupId = Number(item.stock_group_id);
        if (stockGroupId && existingIds.has(stockGroupId)) {
          const previous = existingItems.find((x) => x.id === stockGroupId)!;
          const soldBottles = Math.max(previous.quantity - previous.remaining_quantity, 0);
          if (quantity < soldBottles) {
            throw new Error(`Quantity for item ${stockGroupId} cannot be less than bottles already sold (${soldBottles}).`);
          }
          const newRemaining = quantity - soldBottles;
          db.prepare(`
            UPDATE stock_groups
            SET perfume_id = ?, quantity = ?, buying_cost_per_bottle = ?, subtotal_cost = ?, remaining_quantity = ?
            WHERE id = ?
          `).run(perfumeId, quantity, cost, subtotal, newRemaining, stockGroupId);
          db.prepare(`
            UPDATE decant_tracking
            SET perfume_id = ?
            WHERE stock_group_id = ?
          `).run(perfumeId, stockGroupId);
        } else {
          const inserted = db.prepare(`
            INSERT INTO stock_groups
            (shipment_id, perfume_id, quantity, buying_cost_per_bottle, subtotal_cost, remaining_quantity)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(shipment_id, perfumeId, quantity, cost, subtotal, quantity);
          db.prepare(`
            INSERT INTO decant_tracking (stock_group_id, perfume_id, decants_sold, bottles_sold, bottles_done)
            VALUES (?, ?, 0, 0, 0)
          `).run(inserted.lastInsertRowid, perfumeId);
        }
      }

      // Update custom stock entries linked to this shipment (optional)
      if (Array.isArray(custom_items)) {
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

        const existingCustom = db.prepare(`
          SELECT id, quantity_added, remaining_quantity
          FROM custom_inventory_stock_entries
          WHERE shipment_id = ?
        `).all(shipment_id) as Array<{ id: number; quantity_added: number; remaining_quantity: number }>;

        const incomingCustomIds = new Set(
          custom_items
            .map((c) => Number(c.id))
            .filter((id) => id && !Number.isNaN(id))
        );

        for (const existing of existingCustom) {
          if (!incomingCustomIds.has(existing.id)) {
            db.prepare('DELETE FROM custom_inventory_stock_entries WHERE id = ?').run(existing.id);
          }
        }

        for (const c of custom_items) {
          const itemId = Number(c.item_id);
          const qty = Number(c.quantity_added);
          const unitCost = Number(c.unit_cost);
          const note = c.note || null;
          if (!itemId || !qty || qty <= 0 || Number.isNaN(unitCost) || unitCost < 0) continue;

          const existingId = Number(c.id);
          if (existingId && existingCustom.some((e) => e.id === existingId)) {
            const prev = existingCustom.find((e) => e.id === existingId)!;
            const consumed = Math.max((prev.quantity_added || 0) - (prev.remaining_quantity || 0), 0);
            if (qty < consumed) {
              throw new Error(`Custom item quantity cannot be less than already consumed units (${consumed}).`);
            }
            const newRemaining = qty - consumed;
            db.prepare(`
              UPDATE custom_inventory_stock_entries
              SET item_id = ?, quantity_added = ?, remaining_quantity = ?, unit_cost = ?, purchase_date = ?, note = ?
              WHERE id = ?
            `).run(itemId, qty, newRemaining, unitCost, purchase_date, note, existingId);
          } else {
            db.prepare(`
              INSERT INTO custom_inventory_stock_entries
              (shipment_id, item_id, quantity_added, remaining_quantity, unit_cost, purchase_date, note)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(shipment_id, itemId, qty, qty, unitCost, purchase_date, note);
          }
        }
      }

      // Keep linked capital investment in sync after any shipment edit.
      syncShipmentCapitalInvestment(db, Number(shipment_id));
    });

    tx();

    const updatedStocks = db.prepare(`
      SELECT 
        sg.*,
        p.name as perfume_name,
        ss.purchase_date,
        ss.transport_cost,
        ss.other_expenses,
        ss.shipment_name,
        ss.funded_from,
        dt.decants_sold,
        dt.bottles_sold,
        dt.bottles_done,
        COALESCE((
          SELECT SUM(dbl.decants_obtained)
          FROM decant_bottle_logs dbl
          WHERE dbl.stock_group_id = sg.id
        ), 0) as completed_bottle_decants
      FROM stock_groups sg
      LEFT JOIN perfumes p ON sg.perfume_id = p.id
      LEFT JOIN stock_shipments ss ON sg.shipment_id = ss.id
      LEFT JOIN decant_tracking dt ON sg.id = dt.stock_group_id
      WHERE sg.shipment_id = ?
      ORDER BY sg.id ASC
    `).all(shipment_id) as StockWithDetails[];

    return NextResponse.json({
      shipment_id,
      items: updatedStocks,
      message: 'Shipment updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating shipment:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update shipment' }, { status: 500 });
  }
}

// DELETE stock group
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const shipmentId = searchParams.get('shipment_id');

    const db = getDatabase();

    if (shipmentId) {
      const sid = Number(shipmentId);
      if (!sid || Number.isNaN(sid)) {
        return NextResponse.json({ error: 'Valid shipment_id is required' }, { status: 400 });
      }

      const shipment = db.prepare('SELECT id, shipment_name FROM stock_shipments WHERE id = ?').get(sid) as { id: number; shipment_name?: string | null } | undefined;
      if (!shipment) {
        return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
      }

      const stockIds = db.prepare(`
        SELECT id
        FROM stock_groups
        WHERE shipment_id = ?
      `).all(sid) as Array<{ id: number }>;

      if (stockIds.length > 0) {
        const placeholders = stockIds.map(() => '?').join(',');
        const salesCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM sale_items
          WHERE stock_group_id IN (${placeholders})
        `).get(...stockIds.map((s) => s.id)) as { count: number };

        if (salesCount.count > 0) {
          return NextResponse.json(
            { error: 'Cannot delete shipment with existing sales records.' },
            { status: 400 }
          );
        }

        db.prepare(`
          DELETE FROM decant_bottle_logs
          WHERE stock_group_id IN (${placeholders})
        `).run(...stockIds.map((s) => s.id));
        db.prepare(`
          DELETE FROM decant_tracking
          WHERE stock_group_id IN (${placeholders})
        `).run(...stockIds.map((s) => s.id));
        db.prepare(`
          DELETE FROM deleted_bottles
          WHERE stock_group_id IN (${placeholders})
        `).run(...stockIds.map((s) => s.id));
      }

      // Ensure table exists for older DBs before deleting linked custom rows.
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

      db.prepare('DELETE FROM custom_inventory_stock_entries WHERE shipment_id = ?').run(sid);
      db.prepare('DELETE FROM stock_groups WHERE shipment_id = ?').run(sid);
      // Remove linked (or legacy description-matched) capital investment entries.
      ensureInvestmentShipmentLink(db);
      db.prepare('DELETE FROM investments WHERE source_shipment_id = ?').run(sid);
      db.prepare(`DELETE FROM investments WHERE description LIKE ?`).run(`%Shipment #${sid}%`);
      if (shipment.shipment_name) {
        db.prepare(`DELETE FROM investments WHERE description = ?`).run(`Stock purchase (capital) - ${shipment.shipment_name}`);
      }
      db.prepare('DELETE FROM stock_shipments WHERE id = ?').run(sid);

      return NextResponse.json({ message: 'Shipment and all linked items deleted successfully' });
    }

    if (!id) {
      return NextResponse.json({ error: 'Stock group ID is required' }, { status: 400 });
    }
    
    // Check if stock has been sold
    const salesCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE stock_group_id = ?').get(id) as { count: number };
    if (salesCount.count > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete stock group with existing sales. This would compromise financial records.' 
      }, { status: 400 });
    }

    const shipmentForStock = db.prepare('SELECT shipment_id FROM stock_groups WHERE id = ?').get(id) as { shipment_id?: number } | undefined;

    // Delete dependent rows first (foreign keys)
    db.prepare('DELETE FROM decant_tracking WHERE stock_group_id = ?').run(id);
    db.prepare('DELETE FROM decant_bottle_logs WHERE stock_group_id = ?').run(id);
    db.prepare('DELETE FROM deleted_bottles WHERE stock_group_id = ?').run(id);
    
    // Delete stock group
    const stmt = db.prepare('DELETE FROM stock_groups WHERE id = ?');
    stmt.run(id);

    // If this stock group belonged to a capital shipment, recalc linked investment amount.
    if (shipmentForStock?.shipment_id) {
      syncShipmentCapitalInvestment(db, Number(shipmentForStock.shipment_id));
    }

    return NextResponse.json({ message: 'Stock group deleted successfully' });
  } catch (error) {
    console.error('Error deleting stock group:', error);
    return NextResponse.json({ error: 'Failed to delete stock group' }, { status: 500 });
  }
}
