import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import type { CustomInventoryStockEntry } from '@/lib/types';

export async function GET() {
  try {
    const db = getDatabase();

    const rows = await db.prepare(`
      SELECT
        s.*,
        i.name as item_name,
        i.category,
        i.unit_label,
        i.default_ml,
        ss.shipment_name,
        ss.purchase_date as shipment_purchase_date,
        ss.transport_cost as shipment_transport_cost,
        ss.other_expenses as shipment_other_expenses,
        ss.funded_from as shipment_funded_from
      FROM custom_inventory_stock_entries s
      JOIN custom_inventory_items i ON i.id = s.item_id
      LEFT JOIN stock_shipments ss ON ss.id = s.shipment_id
      ORDER BY s.purchase_date DESC, s.created_at DESC
    `).all() as CustomInventoryStockEntry[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching custom inventory stock:', error);
    return NextResponse.json({ error: 'Failed to fetch custom inventory stock' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDatabase();

    const body = await request.json();
    const shipmentIdRaw = body?.shipment_id;
    const shipmentId = shipmentIdRaw === null || shipmentIdRaw === undefined || shipmentIdRaw === ''
      ? null
      : Number(shipmentIdRaw);
    const itemId = Number(body?.item_id);
    const quantity = Number(body?.quantity_added);
    const unitCost = Number(body?.unit_cost);
    const purchaseDate = String(body?.purchase_date || '').trim();
    const note = String(body?.note || '').trim() || null;

    if (!itemId || Number.isNaN(itemId)) {
      return NextResponse.json({ error: 'Valid item_id is required' }, { status: 400 });
    }
    if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'quantity_added must be greater than 0' }, { status: 400 });
    }
    if (Number.isNaN(unitCost) || unitCost < 0) {
      return NextResponse.json({ error: 'unit_cost must be 0 or greater' }, { status: 400 });
    }
    if (!purchaseDate) {
      return NextResponse.json({ error: 'purchase_date is required' }, { status: 400 });
    }
    if (shipmentId !== null && (Number.isNaN(shipmentId) || shipmentId <= 0)) {
      return NextResponse.json({ error: 'shipment_id must be a valid positive number' }, { status: 400 });
    }

    const item = await db.prepare('SELECT id FROM custom_inventory_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    const result = await db.prepare(`
      INSERT INTO custom_inventory_stock_entries
      (shipment_id, item_id, quantity_added, remaining_quantity, unit_cost, purchase_date, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(shipmentId, itemId, quantity, quantity, unitCost, purchaseDate, note);

    const created = await db.prepare(`
      SELECT
        s.*,
        i.name as item_name,
        i.category,
        i.unit_label,
        i.default_ml,
        ss.shipment_name,
        ss.purchase_date as shipment_purchase_date,
        ss.transport_cost as shipment_transport_cost,
        ss.other_expenses as shipment_other_expenses,
        ss.funded_from as shipment_funded_from
      FROM custom_inventory_stock_entries s
      JOIN custom_inventory_items i ON i.id = s.item_id
      LEFT JOIN stock_shipments ss ON ss.id = s.shipment_id
      WHERE s.id = ?
    `).get(result.lastInsertRowid) as CustomInventoryStockEntry;

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating custom inventory stock:', error);
    return NextResponse.json({ error: 'Failed to create custom inventory stock' }, { status: 500 });
  }
}
