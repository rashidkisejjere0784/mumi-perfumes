'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Perfume,
  StockWithDetails,
  SaleWithDetails,
  CustomInventoryItem,
  CustomInventoryStockEntry,
} from '@/lib/types';
import { Plus } from 'lucide-react';

export default function SalesPage() {
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [stocks, setStocks] = useState<StockWithDetails[]>([]);
  const [decantBottleItems, setDecantBottleItems] = useState<
    Array<{ id: number; name: string; remaining: number; default_ml?: number | null }>
  >([]);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, perfumesRes, stocksRes, customItemsRes, customStockRes] = await Promise.all([
        fetch('/api/sales'),
        fetch('/api/perfumes'),
        fetch('/api/stock'),
        fetch('/api/custom-inventory/items'),
        fetch('/api/custom-inventory/stock'),
      ]);
      const [salesData, perfumesData, stocksData, customItemsData, customStockData] = await Promise.all([
        salesRes.json(),
        perfumesRes.json(),
        stocksRes.json(),
        customItemsRes.json() as Promise<CustomInventoryItem[]>,
        customStockRes.json() as Promise<CustomInventoryStockEntry[]>,
      ]);

      setSales(salesData);
      setPerfumes(perfumesData.filter((p: Perfume) => (p.is_out_of_stock || 0) === 0));
      setStocks(stocksData.filter((s: StockWithDetails) => s.remaining_quantity > 0));

      const remainingByItem = new Map<number, number>();
      for (const entry of customStockData) {
        const itemId = Number(entry.item_id);
        if (!itemId) continue;
        remainingByItem.set(itemId, (remainingByItem.get(itemId) || 0) + Number(entry.remaining_quantity || 0));
      }
      const decantOptions = customItemsData
        .filter((item) => item.category === 'decant_bottle' && Number(item.is_active) === 1)
        .map((item) => ({
          id: item.id,
          name: item.name,
          remaining: remainingByItem.get(item.id) || 0,
          default_ml: item.default_ml ?? null,
        }));
      setDecantBottleItems(decantOptions);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayDebt = (sale: SaleWithDetails) => {
    setSelectedSale(sale);
    setShowDebtModal(true);
  };

  if (loading) {
    return (
      <DashboardLayout title="Sales Management">
        <div className="py-8 text-center">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Sales Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-900">
            Total Sales: <span className="font-semibold">{sales.length}</span>
          </div>
          <button
            onClick={() => setShowSaleModal(true)}
            className="flex items-center space-x-2 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
          >
            <Plus size={20} />
            <span>New Sale</span>
          </button>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900">Paid</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900">Debt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 text-sm text-gray-600">{sale.sale_date}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{sale.customer_name || 'Walk-in'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {sale.items.map((item, idx) => (
                        <div key={idx}>
                          {item.perfume_name} ({item.quantity} {item.sale_type === 'full_bottle' ? 'bottle(s)' : 'decant(s)'})
                        </div>
                      ))}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">UGX {sale.total_amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-green-600">UGX {sale.amount_paid.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">
                      {sale.debt_amount > 0 ? (
                        <span className="font-medium text-red-600">UGX {sale.debt_amount.toLocaleString()}</span>
                      ) : (
                        <span className="text-green-600">Paid</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{sale.payment_method}</td>
                    <td className="px-6 py-4">
                      {sale.debt_amount > 0 && (
                        <button
                          onClick={() => handlePayDebt(sale)}
                          className="text-sm font-medium text-purple-600 hover:text-purple-700"
                        >
                          Pay Debt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showSaleModal && (
        <SaleModal
          perfumes={perfumes}
          stocks={stocks}
          decantBottleItems={decantBottleItems}
          onClose={() => setShowSaleModal(false)}
          onSuccess={() => {
            fetchData();
            setShowSaleModal(false);
          }}
        />
      )}

      {showDebtModal && selectedSale && (
        <DebtPaymentModal
          sale={selectedSale}
          onClose={() => {
            setShowDebtModal(false);
            setSelectedSale(null);
          }}
          onSuccess={() => {
            fetchData();
            setShowDebtModal(false);
            setSelectedSale(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}

function SaleModal({
  perfumes,
  stocks,
  decantBottleItems,
  onClose,
  onSuccess,
}: {
  perfumes: Perfume[];
  stocks: StockWithDetails[];
  decantBottleItems: Array<{ id: number; name: string; remaining: number; default_ml?: number | null }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    customer_name: '',
    payment_method: 'cash',
    sale_date: new Date().toISOString().split('T')[0],
  });
  const [items, setItems] = useState<
    Array<{
      perfume_id: number;
      stock_group_id: number;
      sale_type: 'full_bottle' | 'decant';
      decant_bottle_item_id: number;
      quantity: number;
      unit_price: number;
    }>
  >([]);
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const [amountPaid, setAmountPaid] = useState('');
  const [recordAsDebt, setRecordAsDebt] = useState(false);

  useEffect(() => {
    if (totalAmount <= 0) {
      setAmountPaid('');
      return;
    }
    setAmountPaid(recordAsDebt ? '0' : String(totalAmount));
  }, [totalAmount, recordAsDebt]);

  const itemsContainerRef = useRef<HTMLDivElement>(null);

  const addItem = () => {
    setItems([
      ...items,
      {
        perfume_id: 0,
        stock_group_id: 0,
        sale_type: 'full_bottle',
        decant_bottle_item_id: 0,
        quantity: 1,
        unit_price: 0,
      },
    ]);
    requestAnimationFrame(() => {
      itemsContainerRef.current?.scrollTo({ top: itemsContainerRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const handleSaleTypeChange = (index: number, saleType: 'full_bottle' | 'decant') => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      sale_type: saleType,
      decant_bottle_item_id: saleType === 'decant' ? newItems[index].decant_bottle_item_id : 0,
    };
    setItems(newItems);
  };

  const handlePerfumeChange = (index: number, perfumeIdValue: string) => {
    const perfumeIdNum = Number(perfumeIdValue) || 0;
    const availableStocks = stocks.filter((s) => Number(s.perfume_id) === perfumeIdNum);
    const preferredStock = availableStocks.find((s) => Number(s.decants_sold || 0) === 0) || availableStocks[0];
    const firstStockId = preferredStock ? preferredStock.id : 0;
    const selectedStockHasDecants = Number(preferredStock?.decants_sold || 0) > 0;
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      perfume_id: perfumeIdNum,
      stock_group_id: firstStockId,
      sale_type: selectedStockHasDecants ? 'decant' : newItems[index].sale_type,
    };
    setItems(newItems);
  };

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount_paid: parseFloat(amountPaid) || 0,
          items: items.map((item) => ({
            ...item,
            perfume_id: parseInt(item.perfume_id as any, 10),
            stock_group_id: parseInt(item.stock_group_id as any, 10),
            decant_bottle_item_id:
              item.sale_type === 'decant' ? parseInt(item.decant_bottle_item_id as any, 10) || 0 : undefined,
            quantity: parseInt(item.quantity as any, 10),
            unit_price: parseFloat(item.unit_price as any),
          })),
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create sale');
      }
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Failed to create sale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4">
      <div className="my-8 w-full max-w-4xl rounded-lg bg-white p-6">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">New Sale</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Customer Name (Optional)</label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500"
                placeholder="Walk-in customer"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-purple-500"
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Sale Date</label>
              <input
                type="date"
                required
                value={formData.sale_date}
                onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Sale Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
              >
                Add Item
              </button>
            </div>

            <div ref={itemsContainerRef} className="max-h-96 space-y-3 overflow-y-auto">
              {items.map((item, index) => {
                const perfumeId = Number(item.perfume_id) || 0;
                const availableStocks = stocks.filter((s) => Number(s.perfume_id) === perfumeId);
                const selectedStockId = Number(item.stock_group_id) || 0;
                const selectedStock = availableStocks.find((s) => Number(s.id) === selectedStockId);
                const hasDecantSalesForSelectedStock = Number(selectedStock?.decants_sold || 0) > 0;
                const selectedDecantBottleItemId = Number(item.decant_bottle_item_id) || 0;

                return (
                  <div key={index} className="grid grid-cols-1 gap-2 rounded bg-gray-50 p-3 md:grid-cols-7">
                    <select
                      value={item.perfume_id}
                      onChange={(e) => handlePerfumeChange(index, e.target.value)}
                      className="rounded border bg-white px-2 py-1 text-sm text-gray-900"
                      required
                    >
                      <option value="0">Select Perfume</option>
                      {perfumes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedStockId}
                      onChange={(e) => updateItem(index, 'stock_group_id', Number(e.target.value) || 0)}
                      className="rounded border bg-white px-2 py-1 text-sm text-gray-900"
                      required
                      disabled={!perfumeId}
                    >
                      <option value="0">
                        {perfumeId ? (availableStocks.length === 0 ? 'No stock' : 'Select stock (batch)') : 'Select perfume first'}
                      </option>
                      {availableStocks.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shipment_name ? `${s.shipment_name} · ` : ''}
                          {s.purchase_date} — {s.remaining_quantity} left
                        </option>
                      ))}
                    </select>

                    <select
                      value={item.sale_type}
                      onChange={(e) => handleSaleTypeChange(index, e.target.value as 'full_bottle' | 'decant')}
                      className="rounded border bg-white px-2 py-1 text-sm text-gray-900"
                    >
                      <option value="full_bottle" disabled={hasDecantSalesForSelectedStock}>
                        Bottle {hasDecantSalesForSelectedStock ? '(disabled: this stock already decanted)' : ''}
                      </option>
                      <option value="decant">Decant</option>
                    </select>

                    <select
                      value={selectedDecantBottleItemId}
                      onChange={(e) => updateItem(index, 'decant_bottle_item_id', Number(e.target.value) || 0)}
                      className="rounded border bg-white px-2 py-1 text-sm text-gray-900"
                      disabled={item.sale_type !== 'decant'}
                      required={item.sale_type === 'decant'}
                    >
                      <option value="0">
                        {item.sale_type === 'decant' ? 'Select decant bottle type' : 'N/A for bottle sale'}
                      </option>
                      {decantBottleItems.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                          {d.default_ml ? ` (${d.default_ml}ml)` : ''} - {d.remaining} left
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="rounded border px-2 py-1 text-sm"
                      placeholder="Qty"
                      required
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                      className="rounded border px-2 py-1 text-sm"
                      placeholder="Price"
                      required
                    />

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded bg-red-500 px-2 py-1 text-sm text-white hover:bg-red-600"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 rounded bg-gray-100 p-4">
            <div className="flex justify-between text-lg">
              <span className="font-semibold text-gray-900">Total Amount:</span>
              <span className="font-bold text-gray-900">UGX {totalAmount.toLocaleString()}</span>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={recordAsDebt}
                onChange={(e) => setRecordAsDebt(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-900">Record as debt (unpaid portion based on amount paid)</span>
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Amount Paid</label>
              <input
                type="number"
                min="0"
                step="0.01"
                max={totalAmount}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-purple-500"
                placeholder={recordAsDebt ? '0 = full debt; enter partial payment if any' : 'Auto-filled from total'}
                required
              />
            </div>
            {parseFloat(amountPaid || '0') < totalAmount && (
              <div className="font-medium text-orange-700">
                Debt to record: UGX {(totalAmount - parseFloat(amountPaid || '0')).toLocaleString()}
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Complete Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DebtPaymentModal({ sale, onClose, onSuccess }: { sale: SaleWithDetails; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    amount_paid: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/debt-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: sale.id,
          amount_paid: parseFloat(formData.amount_paid),
          payment_date: formData.payment_date,
          payment_method: formData.payment_method,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">Record Debt Payment</h2>
        <div className="mb-4 rounded bg-gray-50 p-3">
          <p className="text-sm text-gray-900">
            Customer: <span className="font-medium">{sale.customer_name || 'Walk-in'}</span>
          </p>
          <p className="text-sm text-gray-900">
            Outstanding Debt: <span className="font-bold text-red-600">UGX {sale.debt_amount.toLocaleString()}</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">Payment Amount</label>
            <input
              type="number"
              required
              min="0.01"
              max={sale.debt_amount}
              step="0.01"
              value={formData.amount_paid}
              onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">Payment Date</label>
            <input
              type="date"
              required
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">Payment Method</label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-purple-500"
            >
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700">
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
