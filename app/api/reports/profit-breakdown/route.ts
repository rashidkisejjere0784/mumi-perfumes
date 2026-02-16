import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import type { ProfitBreakdown, ProfitBySale, ProfitByPerfume, ProfitItemDetail } from '@/lib/types';

/**
 * Profit is recorded only after the money used to buy that perfume (stock) is recovered.
 * Revenue from each sale (decant or bottle) first goes to recover the stock's cost;
 * only once cost is fully recovered does further revenue count as profit.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const db = getDatabase();

    type Row = {
      sale_id: number;
      sale_date: string;
      customer_name: string | null;
      total_amount: number;
      si_id: number;
      stock_group_id: number;
      perfume_id: number;
      perfume_name: string;
      sale_type: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      stock_cost: number; // total cost of this stock batch (to recover)
    };

    let query = `
      SELECT 
        s.id as sale_id,
        s.sale_date,
        s.customer_name,
        s.total_amount,
        si.id as si_id,
        si.stock_group_id,
        si.perfume_id,
        p.name as perfume_name,
        si.sale_type,
        si.quantity,
        si.unit_price,
        si.subtotal,
        sg.subtotal_cost as stock_cost
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN stock_groups sg ON si.stock_group_id = sg.id
      JOIN perfumes p ON si.perfume_id = p.id
    `;
    const params: (string | number)[] = [];
    if (startDate && endDate) {
      query += ' WHERE s.sale_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    // Chronological order so we apply cost recovery in time order
    query += ' ORDER BY s.sale_date ASC, s.id ASC, si.id ASC';

    const rows = db.prepare(query).all(...params) as Row[];

    // Per stock group: how much of the stock cost has been recovered so far (by earlier sales)
    const costRecoveredByStock = new Map<number, number>();

    const bySaleMap = new Map<number, ProfitBySale>();
    const byPerfumeMap = new Map<number, ProfitByPerfume>();

    let totalSalesValue = 0;
    let totalCostRecovery = 0;
    let totalProfit = 0;

    for (const row of rows) {
      const revenue = row.subtotal;
      const stockCost = row.stock_cost;
      const recoveredSoFar = costRecoveredByStock.get(row.stock_group_id) ?? 0;
      const costLeftToRecover = Math.max(0, stockCost - recoveredSoFar);

      // Revenue first fills cost recovery; remainder is profit
      const amountRecoveringCost = Math.min(revenue, costLeftToRecover);
      const profit = revenue - amountRecoveringCost;

      costRecoveredByStock.set(row.stock_group_id, recoveredSoFar + amountRecoveringCost);

      totalSalesValue += revenue;
      totalCostRecovery += amountRecoveringCost;
      totalProfit += profit;

      let calculationNote: string;
      if (amountRecoveringCost > 0 && profit > 0) {
        calculationNote = `Cost recovery: UGX ${amountRecoveringCost.toLocaleString()}; Profit: UGX ${profit.toLocaleString()} (bottle cost partly recovered)`;
      } else if (amountRecoveringCost > 0) {
        const left = costLeftToRecover - amountRecoveringCost;
        calculationNote = left > 0
          ? `Cost recovery: UGX ${amountRecoveringCost.toLocaleString()} (UGX ${left.toLocaleString()} left to recover)`
          : `Cost recovery: UGX ${amountRecoveringCost.toLocaleString()} (bottle cost now fully recovered)`;
      } else {
        calculationNote = `Profit: UGX ${profit.toLocaleString()} (bottle cost already recovered)`;
      }

      const itemDetail: ProfitItemDetail = {
        perfume_name: row.perfume_name,
        perfume_id: row.perfume_id,
        sale_type: row.sale_type as 'full_bottle' | 'decant',
        quantity: row.quantity,
        unit_price: row.unit_price,
        subtotal: row.subtotal,
        cost: amountRecoveringCost,
        profit,
        calculation_note: calculationNote,
      };

      // By sale
      if (!bySaleMap.has(row.sale_id)) {
        bySaleMap.set(row.sale_id, {
          sale_id: row.sale_id,
          sale_date: row.sale_date,
          customer_name: row.customer_name,
          total_amount: row.total_amount,
          total_cost: 0,
          total_profit: 0,
          items: [],
        });
      }
      const saleEntry = bySaleMap.get(row.sale_id)!;
      saleEntry.items.push(itemDetail);
      saleEntry.total_cost += amountRecoveringCost;
      saleEntry.total_profit += profit;

      // By perfume
      const qty = row.quantity;
      if (!byPerfumeMap.has(row.perfume_id)) {
        byPerfumeMap.set(row.perfume_id, {
          perfume_id: row.perfume_id,
          perfume_name: row.perfume_name,
          total_quantity: 0,
          total_sales_value: 0,
          total_cost: 0,
          profit: 0,
          full_bottle_qty: 0,
          decant_qty: 0,
        });
      }
      const perfumeEntry = byPerfumeMap.get(row.perfume_id)!;
      perfumeEntry.total_quantity += qty;
      perfumeEntry.total_sales_value += row.subtotal;
      perfumeEntry.total_cost += amountRecoveringCost;
      perfumeEntry.profit += profit;
      if (row.sale_type === 'full_bottle') perfumeEntry.full_bottle_qty += qty;
      else perfumeEntry.decant_qty += qty;
    }

    const by_sale = Array.from(bySaleMap.values());
    const by_perfume = Array.from(byPerfumeMap.values()).sort((a, b) => b.profit - a.profit);

    const result: ProfitBreakdown = {
      total_sales_value: totalSalesValue,
      total_cost: totalCostRecovery,
      total_profit: totalProfit,
      by_perfume: by_perfume,
      by_sale: by_sale,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching profit breakdown:', error);
    return NextResponse.json({ error: 'Failed to fetch profit breakdown' }, { status: 500 });
  }
}
