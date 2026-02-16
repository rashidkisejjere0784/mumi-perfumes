import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

// GET chart data for dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // daily, monthly
    const days = parseInt(searchParams.get('days') || '30');
    const months = parseInt(searchParams.get('months') || '12');

    const db = getDatabase();

    if (type === 'daily') {
      // Get daily revenue for the last N days
      const dailyData = await db.prepare(`
        SELECT 
          sale_date as date,
          SUM(amount_paid) as revenue,
          SUM(total_amount) as total_sales
        FROM sales
        WHERE sale_date >= date('now', '-${days} days')
        GROUP BY sale_date
        ORDER BY sale_date ASC
      `).all();

      return NextResponse.json(dailyData);
    } else if (type === 'monthly') {
      // Get monthly revenue for the last N months
      const monthlyData = await db.prepare(`
        SELECT 
          strftime('%Y-%m', sale_date) as month,
          SUM(amount_paid) as revenue,
          SUM(total_amount) as total_sales,
          COUNT(*) as transaction_count
        FROM sales
        WHERE sale_date >= date('now', '-${months} months')
        GROUP BY strftime('%Y-%m', sale_date)
        ORDER BY month ASC
      `).all();

      return NextResponse.json(monthlyData);
    } else if (type === 'profit-expense') {
      // Get profit vs expense comparison by month
      const profitExpenseData = await db.prepare(`
        SELECT 
          strftime('%Y-%m', sale_date) as month,
          SUM(amount_paid) as revenue
        FROM sales
        WHERE sale_date >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', sale_date)
        ORDER BY month ASC
      `).all();

      // Get expenses by month
      const expenseData = await db.prepare(`
        SELECT 
          strftime('%Y-%m', expense_date) as month,
          SUM(amount) as expenses
        FROM expenses
        WHERE expense_date >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', expense_date)
        ORDER BY month ASC
      `).all() as { month: string; expenses: number }[];

      // Merge data
      const merged = (profitExpenseData as any[]).map(item => {
        const expense = expenseData.find(e => e.month === item.month);
        return {
          month: item.month,
          revenue: item.revenue,
          expenses: expense?.expenses || 0,
          profit: item.revenue - (expense?.expenses || 0)
        };
      });

      return NextResponse.json(merged);
    }

    return NextResponse.json({ error: 'Invalid chart type' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
