import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

// GET export data as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const db = getDatabase();

    if (type === 'database') {
      return NextResponse.json(
        { error: 'Database backup is not available in production (MySQL mode).' },
        { status: 400 },
      );
    } else if (type === 'sales') {
      const sales = await db
        .prepare(
          `SELECT
          s.id,
          s.customer_name,
          s.sale_date,
          s.payment_method,
          s.total_amount,
          s.amount_paid,
          s.debt_amount,
          p.name as perfume_name,
          si.sale_type,
          si.quantity,
          si.unit_price,
          si.subtotal
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN perfumes p ON si.perfume_id = p.id
        ORDER BY s.sale_date DESC`,
        )
        .all();

      const csv = convertToCSV(sales, [
        'id',
        'customer_name',
        'sale_date',
        'payment_method',
        'total_amount',
        'amount_paid',
        'debt_amount',
        'perfume_name',
        'sale_type',
        'quantity',
        'unit_price',
        'subtotal',
      ]);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="sales_report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (type === 'profit-loss') {
      const stockCosts = (await db
        .prepare('SELECT COALESCE(SUM(subtotal_cost), 0) as total FROM stock_groups')
        .get()) as { total: number };
      const expenses = (await db
        .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses')
        .get()) as { total: number };
      const revenue = (await db
        .prepare('SELECT COALESCE(SUM(amount_paid), 0) as total FROM sales')
        .get()) as { total: number };
      const totalSales = (await db
        .prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales')
        .get()) as { total: number };

      const report = [
        { category: 'Total Revenue (Received)', amount: revenue.total },
        { category: 'Total Sales Amount', amount: totalSales.total },
        { category: 'Stock Costs', amount: -(stockCosts.total || 0) },
        { category: 'Additional Expenses', amount: -(expenses.total || 0) },
        { category: 'Gross Profit', amount: (totalSales.total || 0) - (stockCosts.total || 0) },
        {
          category: 'Net Profit',
          amount: (revenue.total || 0) - (stockCosts.total || 0) - (expenses.total || 0),
        },
      ];

      const csv = convertToCSV(report, ['category', 'amount']);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="profit_loss_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (type === 'debt') {
      const debts = await db
        .prepare(
          `SELECT
          s.id,
          s.customer_name,
          s.sale_date,
          s.total_amount,
          s.amount_paid,
          s.debt_amount
        FROM sales s
        WHERE s.debt_amount > 0
        ORDER BY s.sale_date DESC`,
        )
        .all();

      const csv = convertToCSV(debts, [
        'id',
        'customer_name',
        'sale_date',
        'total_amount',
        'amount_paid',
        'debt_amount',
      ]);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="debt_report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (type === 'investment') {
      const manualInvestments = await db
        .prepare(
          `SELECT
          'Manual Investment' as type,
          NULL as perfume_id,
          investment_date as date,
          amount
        FROM investments
        WHERE source_shipment_id IS NULL
          AND description NOT LIKE 'Stock purchase (capital)%'
        ORDER BY investment_date DESC`,
        )
        .all();

      const csv = convertToCSV(manualInvestments, ['type', 'perfume_id', 'date', 'amount']);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="investment_report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

function convertToCSV(data: any[], headers: string[]): string {
  if (data.length === 0) return headers.join(',') + '\n';

  const csvHeaders = headers.join(',');
  const csvRows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(','),
  );

  return [csvHeaders, ...csvRows].join('\n');
}
