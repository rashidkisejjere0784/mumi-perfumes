import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { CreateSaleRequest, SaleWithDetails } from '@/lib/types';

const DEFAULT_DECANTS_PER_BOTTLE = 10;

async function getAvailableDecantBottlesForItem(
  db: ReturnType<typeof getDatabase>,
  itemId: number,
): Promise<number> {
  const row = (await db.prepare(`
    SELECT COALESCE(SUM(s.remaining_quantity), 0) as total
    FROM custom_inventory_stock_entries s
    JOIN custom_inventory_items i ON i.id = s.item_id
    WHERE i.id = ?
      AND i.category = 'decant_bottle'
      AND i.is_active = 1
      AND s.remaining_quantity > 0
  `).get(itemId)) as { total: number } | undefined;
  return Number(row?.total || 0);
}

async function consumeDecantBottlesForItem(
  db: ReturnType<typeof getDatabase>,
  itemId: number,
  quantityToConsume: number,
) {
  if (quantityToConsume <= 0) return;

  const rows = (await db.prepare(`
    SELECT s.id, s.remaining_quantity
    FROM custom_inventory_stock_entries s
    JOIN custom_inventory_items i ON i.id = s.item_id
    WHERE i.id = ?
      AND i.category = 'decant_bottle'
      AND i.is_active = 1
      AND s.remaining_quantity > 0
    ORDER BY s.purchase_date ASC, s.id ASC
  `).all(itemId)) as { id: number; remaining_quantity: number }[];

  let remaining = quantityToConsume;
  for (const row of rows) {
    if (remaining <= 0) break;
    const deduct = Math.min(remaining, row.remaining_quantity);
    await db.prepare(
      `UPDATE custom_inventory_stock_entries SET remaining_quantity = remaining_quantity - ? WHERE id = ?`,
    ).run(deduct, row.id);
    remaining -= deduct;
  }

  if (remaining > 0) {
    throw new Error(`Not enough stock for selected decant bottle item ${itemId}`);
  }
}

async function syncAutoCompletedBottles(
  db: ReturnType<typeof getDatabase>,
  stockGroupId: number,
) {
  const track = (await db.prepare(
    `SELECT dt.*, p.estimated_decants_per_bottle
     FROM decant_tracking dt
     JOIN perfumes p ON p.id = dt.perfume_id
     WHERE dt.stock_group_id = ?`,
  ).get(stockGroupId)) as {
    id: number;
    stock_group_id: number;
    perfume_id: number;
    decants_sold: number;
    bottles_sold: number;
    bottles_done: number;
    estimated_decants_per_bottle: number;
  } | undefined;

  if (!track) return;

  const baseline = track.estimated_decants_per_bottle || DEFAULT_DECANTS_PER_BOTTLE;
  const autoBottlesDone = Math.floor(track.decants_sold / baseline);
  const manualDoneCount =
    ((await db.prepare(
      `SELECT COUNT(*) as cnt FROM decant_bottle_logs WHERE stock_group_id = ? AND completion_source = 'manual'`,
    ).get(stockGroupId)) as { cnt: number })?.cnt || 0;

  const newBottlesDone = manualDoneCount + autoBottlesDone;

  if (newBottlesDone !== track.bottles_done) {
    await db.prepare(
      `UPDATE decant_tracking SET bottles_done = ? WHERE stock_group_id = ?`,
    ).run(newBottlesDone, stockGroupId);
  }

  const existingAutoLogs =
    ((await db.prepare(
      `SELECT COUNT(*) as cnt FROM decant_bottle_logs WHERE stock_group_id = ? AND completion_source = 'auto'`,
    ).get(stockGroupId)) as { cnt: number })?.cnt || 0;

  if (autoBottlesDone > existingAutoLogs) {
    for (let seq = existingAutoLogs + 1; seq <= autoBottlesDone; seq++) {
      await db.prepare(
        `INSERT INTO decant_bottle_logs (stock_group_id, perfume_id, bottle_sequence, decants_obtained, completion_source)
         VALUES (?, ?, ?, ?, 'auto')`,
      ).run(stockGroupId, track.perfume_id, track.bottles_sold + seq, baseline);
    }
  }
}

// GET all sales with details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const withDebt = searchParams.get('with_debt');

    const db = getDatabase();
    let query = 'SELECT * FROM sales';
    const params: any[] = [];

    if (startDate && endDate) {
      query += ' WHERE sale_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    if (withDebt === 'true') {
      query += params.length > 0 ? ' AND debt_amount > 0' : ' WHERE debt_amount > 0';
    }

    query += ' ORDER BY sale_date DESC, created_at DESC';

    const sales = (await db.prepare(query).all(...params)) as SaleWithDetails[];

    for (const sale of sales) {
      const items = await db
        .prepare(
          `SELECT si.*, p.name as perfume_name
         FROM sale_items si
         LEFT JOIN perfumes p ON si.perfume_id = p.id
         WHERE si.sale_id = ?`,
        )
        .all(sale.id);
      sale.items = items as any;
    }

    return NextResponse.json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

// POST create a new sale
export async function POST(request: NextRequest) {
  try {
    const body: CreateSaleRequest = await request.json();
    const { customer_name, payment_method, amount_paid, sale_date, items } = body;

    if (!payment_method || !sale_date || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();

    const total_amount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const debt_amount = total_amount - amount_paid;

    // Validate stock & constraints per item
    for (const item of items) {
      const stock = (await db
        .prepare('SELECT remaining_quantity FROM stock_groups WHERE id = ?')
        .get(item.stock_group_id)) as { remaining_quantity: number } | undefined;

      if (!stock) {
        return NextResponse.json(
          { error: `Stock group ${item.stock_group_id} not found` },
          { status: 400 },
        );
      }

      if (item.sale_type === 'full_bottle') {
        if (stock.remaining_quantity < item.quantity) {
          return NextResponse.json(
            { error: `Not enough stock for full bottle sale` },
            { status: 400 },
          );
        }
        // Prevent selling full bottle if this stock group already has decant activity
        const decantActivity = (await db
          .prepare(
            `SELECT decants_sold FROM decant_tracking WHERE stock_group_id = ? AND decants_sold > 0`,
          )
          .get(item.stock_group_id)) as { decants_sold: number } | undefined;
        if (decantActivity) {
          return NextResponse.json(
            {
              error: `Cannot sell full bottle from stock group ${item.stock_group_id} — decant sales already exist for this batch.`,
            },
            { status: 400 },
          );
        }
      }
    }

    // Validate decant bottle requirements
    const decantBottleNeeds = new Map<number, number>();
    for (const item of items) {
      if (item.sale_type !== 'decant') continue;
      const decantBottleItemId = Number(item.decant_bottle_item_id);
      if (!decantBottleItemId || Number.isNaN(decantBottleItemId)) {
        return NextResponse.json(
          { error: 'Select a decant bottle item for each decant sale line.' },
          { status: 400 },
        );
      }

      const decantBottleItem = (await db
        .prepare(
          `SELECT id, name FROM custom_inventory_items WHERE id = ? AND category = 'decant_bottle' AND is_active = 1`,
        )
        .get(decantBottleItemId)) as { id: number; name: string } | undefined;

      if (!decantBottleItem) {
        return NextResponse.json(
          { error: 'Selected decant bottle item is invalid or inactive.' },
          { status: 400 },
        );
      }

      decantBottleNeeds.set(
        decantBottleItemId,
        (decantBottleNeeds.get(decantBottleItemId) || 0) + Number(item.quantity || 0),
      );
    }

    for (const [decantBottleItemId, needed] of decantBottleNeeds) {
      const available = await getAvailableDecantBottlesForItem(db, decantBottleItemId);
      if (available < needed) {
        return NextResponse.json(
          {
            error: `Not enough stock for selected decant bottle item (ID ${decantBottleItemId}). Needed ${needed}, available ${available}.`,
          },
          { status: 400 },
        );
      }
    }

    // Create sale
    const saleResult = await db
      .prepare(
        `INSERT INTO sales (customer_name, payment_method, total_amount, amount_paid, debt_amount, sale_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(customer_name || null, payment_method, total_amount, amount_paid, debt_amount, sale_date);

    const saleId = saleResult.lastInsertRowid;

    // Insert items and update stock
    for (const item of items) {
      const subtotal = item.quantity * item.unit_price;

      await db
        .prepare(
          `INSERT INTO sale_items (sale_id, perfume_id, stock_group_id, sale_type, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(saleId, item.perfume_id, item.stock_group_id, item.sale_type, item.quantity, item.unit_price, subtotal);

      if (item.sale_type === 'full_bottle') {
        await db
          .prepare('UPDATE stock_groups SET remaining_quantity = remaining_quantity - ? WHERE id = ?')
          .run(item.quantity, item.stock_group_id);
        await db
          .prepare(
            `INSERT INTO decant_tracking (stock_group_id, perfume_id, decants_sold, bottles_sold)
           VALUES (?, ?, 0, ?)
           ON DUPLICATE KEY UPDATE bottles_sold = bottles_sold + ?`,
          )
          .run(item.stock_group_id, item.perfume_id, item.quantity, item.quantity);
      } else {
        await db
          .prepare(
            `INSERT INTO decant_tracking (stock_group_id, perfume_id, decants_sold, bottles_sold)
           VALUES (?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE decants_sold = decants_sold + ?`,
          )
          .run(item.stock_group_id, item.perfume_id, item.quantity, item.quantity);

        await syncAutoCompletedBottles(db, item.stock_group_id);
      }
    }

    // Consume decant bottles from custom inventory
    for (const [decantBottleItemId, needed] of decantBottleNeeds) {
      await consumeDecantBottlesForItem(db, decantBottleItemId, needed);
    }

    // Fetch complete sale
    const sale = (await db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId)) as SaleWithDetails;
    const saleItems = await db
      .prepare(
        `SELECT si.*, p.name as perfume_name
       FROM sale_items si
       LEFT JOIN perfumes p ON si.perfume_id = p.id
       WHERE si.sale_id = ?`,
      )
      .all(saleId);
    sale.items = saleItems as any;

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 });
  }
}
