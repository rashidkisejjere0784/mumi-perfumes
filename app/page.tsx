'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Wallet, Package, FlaskConical, ShoppingBag } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import type { FinancialSummary, SalesStats } from '@/lib/types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DailyChartRow {
  date: string;
  revenue: number;
  total_sales: number;
}

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

function StatCard({
  title,
  value,
  icon: Icon,
  color = 'bg-blue-50',
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 p-4 md:p-5 ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <Icon className="h-5 w-5 text-gray-700" />
      </div>
      <p className="mt-3 text-xl font-bold text-gray-900 md:text-2xl">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);
  const [dailyChart, setDailyChart] = useState<DailyChartRow[]>([]);
  const [monthlyChart, setMonthlyChart] = useState<MonthlyChartRow[]>([]);
  const [profitExpenseChart, setProfitExpenseChart] = useState<ProfitExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [financialRes, salesRes, dailyRes, monthlyRes, profitExpenseRes] = await Promise.all([
          fetch('/api/dashboard/financial'),
          fetch('/api/dashboard/sales-stats'),
          fetch('/api/dashboard/charts?type=daily&days=30'),
          fetch('/api/dashboard/charts?type=monthly&months=12'),
          fetch('/api/dashboard/charts?type=profit-expense'),
        ]);

        if (financialRes.ok) {
          const data = (await financialRes.json()) as FinancialSummary;
          setFinancial(data);
        }

        if (salesRes.ok) {
          const data = (await salesRes.json()) as SalesStats;
          setSalesStats(data);
        }

        if (dailyRes.ok) {
          setDailyChart((await dailyRes.json()) as DailyChartRow[]);
        }

        if (monthlyRes.ok) {
          setMonthlyChart((await monthlyRes.json()) as MonthlyChartRow[]);
        }

        if (profitExpenseRes.ok) {
          setProfitExpenseChart((await profitExpenseRes.json()) as ProfitExpenseRow[]);
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const formatCurrency = (value: number) =>
    `UGX ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const salesTypeData = [
    { name: 'Full Bottle', value: salesStats?.full_bottle_sales ?? 0 },
    { name: 'Decant', value: salesStats?.decant_sales ?? 0 },
  ];

  const pieColors = ['#2563eb', '#7c3aed'];

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="p-4 sm:p-6">
          <p className="text-gray-700">Loading dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <p className="text-sm text-gray-700">Overview of sales, cash, and inventory performance</p>
        </div>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Financial Overview</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Liquid Cash" value={formatCurrency(financial?.total_revenue ?? 0)} icon={Wallet} color="bg-emerald-50" />
            <StatCard title="Total Sales Amount" value={formatCurrency(financial?.total_sales_amount ?? 0)} icon={DollarSign} color="bg-blue-50" />
            <StatCard title="Total Expenses" value={formatCurrency(financial?.total_expenses ?? 0)} icon={TrendingUp} color="bg-rose-50" />
            <StatCard title="Outstanding Debts" value={formatCurrency(financial?.outstanding_debts ?? 0)} icon={DollarSign} color="bg-amber-50" />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Investment & Profit</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Capital" value={formatCurrency(financial?.total_capital ?? 0)} icon={DollarSign} color="bg-fuchsia-50" />
            <StatCard title="Total Amount Invested" value={formatCurrency(financial?.total_investment ?? 0)} icon={Wallet} color="bg-indigo-50" />
            <StatCard title="Profit From Sales" value={formatCurrency(financial?.profit_from_sales ?? 0)} icon={TrendingUp} color="bg-teal-50" />
            <StatCard title="Net Profit" value={formatCurrency(financial?.net_profit ?? 0)} icon={TrendingUp} color="bg-cyan-50" />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Bottle & Decant Stats</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Full Bottles Available" value={`${salesStats?.full_bottles_available ?? 0}`} icon={Package} color="bg-sky-50" />
            <StatCard title="Full Bottles Sold" value={`${salesStats?.full_bottles_sold ?? 0}`} icon={ShoppingBag} color="bg-lime-50" />
            <StatCard title="Decants Available (Est.)" value={`${salesStats?.decants_available_estimated ?? 0}`} icon={FlaskConical} color="bg-violet-50" />
            <StatCard title="Total Units Sold" value={`${salesStats?.total_sold_units ?? 0}`} icon={ShoppingBag} color="bg-orange-50" />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Sales & Financial Visuals</h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Daily Sales (Last 30 Days)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Cash Received" stroke="#16a34a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="total_sales" name="Sales Value" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Monthly Revenue (Last 12 Months)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" name="Cash Received" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="total_sales" name="Sales Value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Profit vs Expenses</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitExpenseChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Full Bottle vs Decant Sales</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={salesTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                      {salesTypeData.map((_, idx) => (
                        <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Best Selling Perfumes</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesStats?.best_selling_perfumes ?? []} layout="vertical" margin={{ left: 20, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="perfume_name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_revenue" name="Revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="total_quantity" name="Units Sold" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
