'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Download } from 'lucide-react';
import type { FinancialSummary, SalesStats } from '@/lib/types';

interface MonthlyChartRow {
  month: string;
  revenue: number;
  total_sales: number;
  transaction_count: number;
}

interface ProfitExpenseRow {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function ReportsPage() {
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [monthlySales, setMonthlySales] = useState<MonthlyChartRow[]>([]);
  const [monthlyExpenseProfit, setMonthlyExpenseProfit] = useState<ProfitExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [financialRes, statsRes, monthlyRes, profitExpenseRes] = await Promise.all([
          fetch('/api/dashboard/financial'),
          fetch('/api/dashboard/sales-stats'),
          fetch('/api/dashboard/charts?type=monthly&months=12'),
          fetch('/api/dashboard/charts?type=profit-expense'),
        ]);

        if (financialRes.ok) {
          setFinancial((await financialRes.json()) as FinancialSummary);
        }
        if (statsRes.ok) {
          setSalesStats((await statsRes.json()) as SalesStats);
        }
        if (monthlyRes.ok) {
          setMonthlySales((await monthlyRes.json()) as MonthlyChartRow[]);
        }
        if (profitExpenseRes.ok) {
          setMonthlyExpenseProfit((await profitExpenseRes.json()) as ProfitExpenseRow[]);
        }
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatCurrency = (amount?: number) =>
    `UGX ${(amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const formatMonth = (month?: string) => {
    if (!month) return '-';
    const [year, mon] = month.split('-');
    const date = new Date(Number(year), Number(mon) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  const handleExport = async (type: string) => {
    try {
      setExporting(type);
      const response = await fetch(`/api/export?type=${type}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `report_${type}_${Date.now()}.csv`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export report');
    } finally {
      setExporting(null);
    }
  };

  return (
    <DashboardLayout title="Reports">
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <p className="text-sm text-gray-700">Monthly sales, expenses, perfume performance, and downloadable POS reports</p>
        </div>

        {loading ? (
          <p className="text-gray-700">Loading report data...</p>
        ) : (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Download Reports</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: 'Sales CSV', type: 'sales' },
                  { label: 'Profit & Loss CSV', type: 'profit-loss' },
                  { label: 'Debt CSV', type: 'debt' },
                  { label: 'Investment CSV', type: 'investment' },
                  { label: 'Database Backup', type: 'database' },
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleExport(item.type)}
                    disabled={exporting === item.type}
                    className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {exporting === item.type ? 'Preparing...' : item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-medium text-gray-900">Liquid Cash</h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(financial?.total_revenue)}</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-medium text-gray-900">Total Sales Amount</h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(financial?.total_sales_amount)}</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-medium text-gray-900">Total Expenses</h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(financial?.total_expenses)}</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-medium text-gray-900">Net Profit</h3>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(financial?.net_profit)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="mb-3 text-lg font-semibold text-gray-900">Monthly Sales Report</h2>
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-900">Month</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900">Transactions</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900">Cash Received</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900">Sales Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySales.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-gray-600" colSpan={4}>
                            No monthly sales data yet.
                          </td>
                        </tr>
                      ) : (
                        monthlySales.map((row) => (
                          <tr key={row.month} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-900">{formatMonth(row.month)}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{row.transaction_count ?? 0}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(row.revenue)}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(row.total_sales)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="mb-3 text-lg font-semibold text-gray-900">Monthly Expenses & Profit</h2>
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-900">Month</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900">Revenue</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900">Expenses</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyExpenseProfit.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-gray-600" colSpan={4}>
                            No monthly expense/profit data yet.
                          </td>
                        </tr>
                      ) : (
                        monthlyExpenseProfit.map((row) => (
                          <tr key={row.month} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-900">{formatMonth(row.month)}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(row.revenue)}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(row.expenses)}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(row.profit)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="mb-3 text-lg font-semibold text-gray-900">Best Selling Perfumes</h2>
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-900">Perfume</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900">Units Sold</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(salesStats?.best_selling_perfumes ?? []).length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-gray-600" colSpan={3}>
                            No perfume sales data yet.
                          </td>
                        </tr>
                      ) : (
                        (salesStats?.best_selling_perfumes ?? []).map((item) => (
                          <tr key={item.perfume_name} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-900">{item.perfume_name}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{item.total_quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(item.total_revenue)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="mb-3 text-lg font-semibold text-gray-900">Debt & Inventory Snapshot</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-700">Outstanding Debts</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(financial?.outstanding_debts)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-700">Full Bottles Available</span>
                    <span className="font-semibold text-gray-900">{salesStats?.full_bottles_available ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-700">Decants Available (Est.)</span>
                    <span className="font-semibold text-gray-900">{salesStats?.decants_available_estimated ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-700">Total Units Sold</span>
                    <span className="font-semibold text-gray-900">{salesStats?.total_sold_units ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Total Amount Invested</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(financial?.total_investment)}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
