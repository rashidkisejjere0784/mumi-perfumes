import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { SalesStats } from '@/lib/types';

// GET sales statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const db = getDatabase();

    // Total sales count
    let totalSalesQuery = 'SELECT COUNT(*) as total FROM sales';
    const params: any[] = [];
    
    if (startDate && endDate) {
      totalSalesQuery += ' WHERE sale_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    
    const totalSales = db.prepare(totalSalesQuery).get(...params) as { total: number };

    // Full bottle vs decant sales
    let salesByTypeQuery = `
      SELECT 
        sale_type,
        COUNT(*) as count,
        SUM(subtotal) as revenue
      FROM sale_items
    `;
    
    if (startDate && endDate) {
      salesByTypeQuery += `
        WHERE sale_id IN (
          SELECT id FROM sales WHERE sale_date BETWEEN ? AND ?
        )
      `;
    }
    
    salesByTypeQuery += ' GROUP BY sale_type';
    
    const salesByType = db.prepare(salesByTypeQuery).all(...params) as { sale_type: string; count: number; revenue: number }[];

    const fullBottleSales = salesByType.find(s => s.sale_type === 'full_bottle')?.count || 0;
    const decantSales = salesByType.find(s => s.sale_type === 'decant')?.count || 0;

    // Inventory/sold units stats
    const fullBottlesSoldRow = db.prepare(`
      SELECT COALESCE(SUM(bottles_sold), 0) as total
      FROM decant_tracking
    `).get() as { total: number };

    const decantsSoldRow = db.prepare(`
      SELECT COALESCE(SUM(decants_sold), 0) as total
      FROM decant_tracking
    `).get() as { total: number };

    // Full bottles available: exclude perfumes that already started decanting
    const fullBottlesAvailableRow = db.prepare(`
      SELECT COALESCE(SUM(sg.remaining_quantity), 0) as total
      FROM stock_groups sg
      LEFT JOIN perfumes p ON p.id = sg.perfume_id
      WHERE sg.remaining_quantity > 0
        AND COALESCE(p.is_out_of_stock, 0) = 0
        AND sg.perfume_id NOT IN (
          SELECT DISTINCT perfume_id
          FROM decant_tracking
          WHERE decants_sold > 0
        )
    `).get() as { total: number };

    // Decants available estimate: baseline 10 per unsold bottle minus decants already sold
    const decantsAvailableRow = db.prepare(`
      SELECT COALESCE(SUM(
        CASE
          WHEN ((sg.quantity - COALESCE(dt.bottles_sold, 0)) * 10) - COALESCE(dt.decants_sold, 0) > 0
            THEN ((sg.quantity - COALESCE(dt.bottles_sold, 0)) * 10) - COALESCE(dt.decants_sold, 0)
          ELSE 0
        END
      ), 0) as total
      FROM stock_groups sg
      LEFT JOIN decant_tracking dt ON dt.stock_group_id = sg.id
    `).get() as { total: number };

    // Best selling perfumes
    let bestSellingQuery = `
      SELECT 
        p.name as perfume_name,
        SUM(si.quantity) as total_quantity,
        SUM(si.subtotal) as total_revenue
      FROM sale_items si
      LEFT JOIN perfumes p ON si.perfume_id = p.id
    `;
    
    if (startDate && endDate) {
      bestSellingQuery += `
        WHERE si.sale_id IN (
          SELECT id FROM sales WHERE sale_date BETWEEN ? AND ?
        )
      `;
    }
    
    bestSellingQuery += `
      GROUP BY si.perfume_id, p.name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    
    const bestSelling = db.prepare(bestSellingQuery).all(...params);

    const stats: SalesStats = {
      total_sales: totalSales.total,
      full_bottle_sales: fullBottleSales,
      decant_sales: decantSales,
      full_bottles_available: fullBottlesAvailableRow.total,
      full_bottles_sold: fullBottlesSoldRow.total,
      decants_available_estimated: decantsAvailableRow.total,
      total_sold_units: fullBottlesSoldRow.total + decantsSoldRow.total,
      best_selling_perfumes: bestSelling as any
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    return NextResponse.json({ error: 'Failed to fetch sales stats' }, { status: 500 });
  }
}
