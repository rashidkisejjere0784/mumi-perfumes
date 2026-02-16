import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import type { FinancialSummary } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let dateFilter = '';
    let params: (string | number)[] = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE DATE(sale_date) BETWEEN DATE(?) AND DATE(?)';
      params = [startDate, endDate];
    }

    const db = getDatabase();

    const salesData = await db.prepare(
      `SELECT
        COALESCE(SUM(total_amount), 0) as total,
        COALESCE(SUM(CASE WHEN DATE(sale_date) = DATE('now') THEN amount_paid ELSE 0 END), 0) as daily,
        COALESCE(SUM(CASE WHEN strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now') THEN amount_paid ELSE 0 END), 0) as monthly,
        COALESCE(SUM(amount_paid), 0) as cash_received
      FROM sales ${dateFilter}`,
    ).get(...params) as { total: number; daily: number; monthly: number; cash_received: number };

    const expensesData = await db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses`).get() as { total: number };

    // Capital = manual cash top-ups only.
    const manualInvestments = await db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM investments
      WHERE source_shipment_id IS NULL
        AND description NOT LIKE 'Stock purchase (capital)%'
    `).get() as { total: number };

    const debtData = await db.prepare(`SELECT COALESCE(SUM(debt_amount), 0) as total FROM sales WHERE debt_amount > 0`).get() as { total: number };

    // Money currently put into stock.
    const perfumeStockData = await db.prepare(`
      SELECT COALESCE(SUM(subtotal_cost), 0) as total
      FROM stock_groups
    `).get() as { total: number };
    const customStockData = await db.prepare(`
      SELECT COALESCE(SUM(quantity_added * unit_cost), 0) as total
      FROM custom_inventory_stock_entries
    `).get() as { total: number };
    const shipmentExpenseData = await db.prepare(`
      SELECT COALESCE(SUM(total_additional_expenses), 0) as total
      FROM stock_shipments
    `).get() as { total: number };

    const amountInvestedInStock =
      Number(perfumeStockData.total || 0) +
      Number(customStockData.total || 0) +
      Number(shipmentExpenseData.total || 0);

    const soldItems = await db.prepare(
      `SELECT
         si.id,
         si.stock_group_id,
         si.subtotal,
         sg.subtotal_cost
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN stock_groups sg ON sg.id = si.stock_group_id
       ${dateFilter ? `WHERE DATE(s.sale_date) BETWEEN DATE(?) AND DATE(?)` : ''}
       ORDER BY s.sale_date ASC, si.id ASC`,
    ).all(...params) as { id: number; stock_group_id: number; subtotal: number; subtotal_cost: number }[];

    const costRecoveredByStock = new Map<number, number>();
    let profitFromSales = 0;
    let costOfGoodsSold = 0;

    for (const item of soldItems) {
      const stockCost = Number(item.subtotal_cost) || 0;
      const recoveredSoFar = costRecoveredByStock.get(item.stock_group_id) || 0;
      const remainingCost = Math.max(stockCost - recoveredSoFar, 0);
      const revenue = Number(item.subtotal) || 0;
      const amountRecoveringCost = Math.min(revenue, remainingCost);
      const profit = Math.max(revenue - amountRecoveringCost, 0);

      costRecoveredByStock.set(item.stock_group_id, recoveredSoFar + amountRecoveringCost);
      costOfGoodsSold += amountRecoveringCost;
      profitFromSales += profit;
    }

    // Manual adjustments (resets)
    const liquidCashAdj = await db.prepare(
      "SELECT COALESCE(SUM(adjustment), 0) as total FROM cash_adjustments WHERE type = 'liquid_cash'",
    ).get() as { total: number };
    const capitalAdj = await db.prepare(
      "SELECT COALESCE(SUM(adjustment), 0) as total FROM cash_adjustments WHERE type = 'capital'",
    ).get() as { total: number };

    const liquidCash =
      Number(salesData.cash_received || 0) -
      Number(expensesData.total || 0) +
      Number(liquidCashAdj.total || 0);
    const totalCapital =
      Number(manualInvestments.total || 0) +
      Number(capitalAdj.total || 0);
    // Total Investment = all money put into stock (capital-funded + sales-funded).
    // Using amountInvestedInStock directly avoids double-counting with totalCapital.
    const totalInvestment = amountInvestedInStock;
    // Gross Profit = Revenue from sales − Cost of Goods Sold
    const grossProfit = profitFromSales;
    // Net Profit = Gross Profit − Operating Expenses
    const netProfit = profitFromSales - Number(expensesData.total || 0);

    const summary: FinancialSummary = {
      total_revenue: liquidCash,
      total_sales_amount: Number(salesData.total || 0),
      total_expenses: Number(expensesData.total || 0),
      total_capital: totalCapital,
      total_investment: totalInvestment,
      amount_invested_in_stock: amountInvestedInStock,
      profit_from_sales: profitFromSales,
      cost_of_goods_sold: costOfGoodsSold,
      net_profit: netProfit,
      gross_profit: grossProfit,
      outstanding_debts: Number(debtData.total || 0),
      daily_income: Number(salesData.daily || 0),
      monthly_income: Number(salesData.monthly || 0),
      total_returns: Number(salesData.total || 0),
      net_position: netProfit,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    return NextResponse.json({ error: 'Failed to fetch financial summary' }, { status: 500 });
  }
}
