'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ProfitBreakdown } from '@/lib/types';
import { TrendingUp, Package, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react';

export default function ProfitTrackingPage() {
  const [data, setData] = useState<ProfitBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [filterByDate, setFilterByDate] = useState(false);

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    setStartDate((prev) => prev || start.toISOString().split('T')[0]);
    setEndDate((prev) => prev || end.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (filterByDate && (!startDate || !endDate)) return;
    fetchData();
  }, [startDate, endDate, filterByDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filterByDate && startDate && endDate
        ? `?start_date=${startDate}&end_date=${endDate}`
        : '';
      const res = await fetch(`/api/reports/profit-breakdown${params}`);
      const json = await res.json();
      setData(json);
      if (json.by_sale?.length) setExpandedSaleId(json.by_sale[0].sale_id);
    } catch (error) {
      console.error('Error fetching profit breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Profit Tracking">
        <div className="flex items-center justify-center h-64 text-gray-600">Loading profit data...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Profit Tracking">
      <div className="space-y-6">
        {/* Date filter */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filterByDate}
              onChange={(e) => setFilterByDate(e.target.checked)}
              className="rounded border-gray-300 text-purple-600"
            />
            <span className="text-sm font-medium text-gray-900">Filter by date range</span>
          </label>
          {filterByDate && (
            <>
              <div>
                <label className="text-xs text-gray-600 block">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white"
                />
              </div>
            </>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-semibold text-gray-900 mb-1">Total Sales Value</p>
            <p className="text-2xl font-bold text-gray-900">UGX {(data?.total_sales_value ?? 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Sum of all item subtotals</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-semibold text-gray-900 mb-1">Total Cost Recovery</p>
            <p className="text-2xl font-bold text-amber-600">UGX {(data?.total_cost ?? 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Revenue that went to recovering bottle/stock cost</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-semibold text-gray-900 mb-1">Total Profit</p>
            <p className={`text-2xl font-bold ${(data?.total_profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              UGX {(data?.total_profit ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Profit only after bottle cost is recovered</p>
          </div>
        </div>

        {/* Profit by perfume */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <Package className="text-purple-600" size={20} />
            <h2 className="text-lg font-bold text-gray-900">Profit by Perfume</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Perfume</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase">Qty (Bottles / Decants)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase">Sales Value</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase">Cost Recovery</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(data?.by_perfume ?? []).map((p) => (
                  <tr key={p.perfume_id}>
                    <td className="px-6 py-4 font-medium text-gray-900">{p.perfume_name}</td>
                    <td className="px-6 py-4 text-right text-gray-700">
                      {p.full_bottle_qty} / {p.decant_qty}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">UGX {p.total_sales_value.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-amber-600">UGX {p.total_cost.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-semibold text-green-600">UGX {p.profit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Profit by sale (expandable) */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <ShoppingCart className="text-purple-600" size={20} />
            <h2 className="text-lg font-bold text-gray-900">Profit by Sale (with calculation details)</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {(data?.by_sale ?? []).map((sale) => (
              <div key={sale.sale_id}>
                <button
                  type="button"
                  onClick={() => setExpandedSaleId(expandedSaleId === sale.sale_id ? null : sale.sale_id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    {expandedSaleId === sale.sale_id ? (
                      <ChevronDown className="text-gray-600" size={20} />
                    ) : (
                      <ChevronRight className="text-gray-600" size={20} />
                    )}
                    <span className="font-medium text-gray-900">
                      Sale #{sale.sale_id} · {sale.sale_date}
                    </span>
                    <span className="text-gray-600">({sale.customer_name || 'Walk-in'})</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-700">Total: UGX {sale.total_amount.toLocaleString()}</span>
                    <span className="text-amber-600">Cost recovery: UGX {sale.total_cost.toLocaleString()}</span>
                    <span className="font-semibold text-green-600">Profit: UGX {sale.total_profit.toLocaleString()}</span>
                  </div>
                </button>
                {expandedSaleId === sale.sale_id && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left py-2 text-gray-900">Perfume</th>
                          <th className="text-left py-2 text-gray-900">Type</th>
                          <th className="text-right py-2 text-gray-900">Qty</th>
                          <th className="text-right py-2 text-gray-900">Unit Price</th>
                          <th className="text-right py-2 text-gray-900">Subtotal</th>
                          <th className="text-right py-2 text-gray-900">Cost recovery</th>
                          <th className="text-right py-2 text-gray-900">Profit</th>
                          <th className="text-left py-2 text-gray-900">How profit was calculated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items.map((item, idx) => (
                          <tr key={idx} className="border-t border-gray-200">
                            <td className="py-2 font-medium text-gray-900">{item.perfume_name}</td>
                            <td className="py-2 text-gray-700">{item.sale_type === 'full_bottle' ? 'Bottle' : 'Decant'}</td>
                            <td className="py-2 text-right text-gray-700">{item.quantity}</td>
                            <td className="py-2 text-right text-gray-700">UGX {item.unit_price.toLocaleString()}</td>
                            <td className="py-2 text-right text-gray-900">UGX {item.subtotal.toLocaleString()}</td>
                            <td className="py-2 text-right text-amber-600">UGX {item.cost.toLocaleString()}</td>
                            <td className="py-2 text-right font-medium text-green-600">UGX {item.profit.toLocaleString()}</td>
                            <td className="py-2 text-left text-gray-600 text-xs max-w-xs">{item.calculation_note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {data && !data.by_sale?.length && (
          <p className="text-center text-gray-500 py-8">No sales in the selected period.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
