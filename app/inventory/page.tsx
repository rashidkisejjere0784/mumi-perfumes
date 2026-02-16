'use client';

import { Fragment, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { CustomInventoryCategory, CustomInventoryItem, CustomInventoryStockEntry, DeletedBottleRecord, Perfume, StockWithDetails } from '@/lib/types';
import { Plus, Edit2, Package, Trash2, CheckCircle2, ArchiveX, Tags, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface ShipmentGroup {
  shipment_id: number;
  shipment_name?: string;
  purchase_date: string;
  transport_cost: number;
  other_expenses: number;
  funded_from?: 'sales' | 'capital';
  items: StockWithDetails[];
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [stocks, setStocks] = useState<StockWithDetails[]>([]);
  const [deletedBottles, setDeletedBottles] = useState<DeletedBottleRecord[]>([]);
  const [customItems, setCustomItems] = useState<CustomInventoryItem[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomInventoryCategory[]>([]);
  const [customStockEntries, setCustomStockEntries] = useState<CustomInventoryStockEntry[]>([]);
  const [showPerfumeModal, setShowPerfumeModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [showCustomStockModal, setShowCustomStockModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [perfumePage, setPerfumePage] = useState(1);
  const [customInventoryPage, setCustomInventoryPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const [deletedPage, setDeletedPage] = useState(1);
  const [editingPerfume, setEditingPerfume] = useState<Perfume | null>(null);
  const [editingStock, setEditingStock] = useState<StockWithDetails | null>(null);
  const [editingCustomItem, setEditingCustomItem] = useState<CustomInventoryItem | null>(null);
  const [editingShipment, setEditingShipment] = useState<ShipmentGroup | null>(null);
  const [expandedShipmentId, setExpandedShipmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [perfumesRes, stocksRes, deletedRes, customItemsRes, customCategoriesRes, customStockRes] = await Promise.all([
        fetch('/api/perfumes'),
        fetch('/api/stock'),
        fetch('/api/stock/deleted-bottles'),
        fetch('/api/custom-inventory/items'),
        fetch('/api/custom-inventory/categories'),
        fetch('/api/custom-inventory/stock'),
      ]);
      const [perfumesData, stocksData, deletedData, customItemsData, customCategoriesData, customStockData] = await Promise.all([
        perfumesRes.json(),
        stocksRes.json(),
        deletedRes.json(),
        customItemsRes.json(),
        customCategoriesRes.json(),
        customStockRes.json(),
      ]);
      setPerfumes(perfumesData);
      setStocks(stocksData);
      setDeletedBottles(deletedData);
      setCustomItems(customItemsData);
      setCustomCategories(customCategoriesData);
      setCustomStockEntries(customStockData);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePerfume = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
    
    try {
      const response = await fetch(`/api/perfumes?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete perfume');
      }
    } catch (error) {
      console.error('Error deleting perfume:', error);
      alert('Failed to delete perfume');
    }
  };

  const handleTogglePerfumeOutOfStock = async (perfume: Perfume) => {
    const markOut = (perfume.is_out_of_stock || 0) === 0;
    const confirmText = markOut
      ? `Mark "${perfume.name}" as OUT OF STOCK?`
      : `Mark "${perfume.name}" as IN STOCK?`;
    if (!confirm(confirmText)) return;

    try {
      const response = await fetch('/api/perfumes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: perfume.id,
          is_out_of_stock: markOut ? 1 : 0,
        }),
      });
      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update stock status');
      }
    } catch (error) {
      console.error('Error updating stock status:', error);
      alert('Failed to update stock status');
    }
  };

  const handleDeleteStock = async (id: number) => {
    if (!confirm('Are you sure you want to delete this stock group? This cannot be undone.')) return;
    
    try {
      const response = await fetch(`/api/stock?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete stock');
      }
    } catch (error) {
      console.error('Error deleting stock:', error);
      alert('Failed to delete stock');
    }
  };

  const handleDeleteShipment = async (shipment: ShipmentGroup) => {
    const label = shipment.shipment_name || `Shipment #${shipment.shipment_id}`;
    if (!confirm(`Delete "${label}" and ALL items under it? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/stock?shipment_id=${shipment.shipment_id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchData();
        if (expandedShipmentId === shipment.shipment_id) {
          setExpandedShipmentId(null);
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete shipment');
      }
    } catch (error) {
      console.error('Error deleting shipment:', error);
      alert('Failed to delete shipment');
    }
  };

  const handleMarkBottleDone = async (stock: StockWithDetails) => {
    const suggested = Math.max(
      1,
      (stock.decants_sold || 0) - (stock.completed_bottle_decants || 0)
    );
    const input = prompt(
      `How many decants came out of this completed bottle for "${stock.perfume_name}"?`,
      String(suggested)
    );
    if (input === null) return;
    const decantsObtained = Number(input);
    if (!decantsObtained || Number.isNaN(decantsObtained) || decantsObtained <= 0) {
      alert('Please enter a valid number of decants (greater than 0).');
      return;
    }

    try {
      const response = await fetch('/api/stock/mark-bottle-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_group_id: stock.id,
          decants_obtained: decantsObtained,
        }),
      });
      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to mark bottle as done');
      }
    } catch (error) {
      console.error('Error marking bottle as done:', error);
      alert('Failed to mark bottle as done');
    }
  };

  const handleMarkBottleOutOfStock = async (stock: StockWithDetails) => {
    if (stock.remaining_quantity <= 0) {
      alert('This stock batch has no remaining bottles.');
      return;
    }

    const quantityInput = prompt(
      `How many "${stock.perfume_name}" bottle(s) should be marked out of stock?`,
      '1'
    );
    if (quantityInput === null) return;

    const quantity = Number(quantityInput);
    if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity greater than 0.');
      return;
    }

    if (quantity > stock.remaining_quantity) {
      alert(`Cannot remove ${quantity}. Only ${stock.remaining_quantity} bottle(s) remaining.`);
      return;
    }

    const note = prompt('Optional note/reason details (e.g. leakage, broken bottle):', '') || '';

    try {
      const response = await fetch('/api/stock/mark-out-of-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_group_id: stock.id,
          quantity,
          note,
        }),
      });
      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to mark bottle out of stock');
      }
    } catch (error) {
      console.error('Error marking bottle out of stock:', error);
      alert('Failed to mark bottle out of stock');
    }
  };

  const handleClearAllBusinessData = async () => {
    const first = prompt('This will DELETE all stock, perfumes, sales, debts, expenses, investments, and logs. Type CLEAR to continue:');
    if (first !== 'CLEAR') return;

    const second = prompt('Final confirmation: type CLEAR_ALL_DATA exactly:');
    if (second !== 'CLEAR_ALL_DATA') {
      alert('Confirmation text did not match. Operation cancelled.');
      return;
    }

    try {
      const response = await fetch('/api/admin/clear-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'CLEAR_ALL_DATA' }),
      });

      if (response.ok) {
        alert('All business data cleared. User accounts were preserved.');
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to clear data');
      }
    } catch (error) {
      console.error('Error clearing business data:', error);
      alert('Failed to clear data');
    }
  };

  const handleCreateCustomItem = async (payload: {
    name: string;
    category: string;
    unit_label: string;
    default_ml: number | null;
  }) => {
    try {
      const response = await fetch('/api/custom-inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        fetchData();
        setShowCustomItemModal(false);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to create inventory item');
      }
    } catch (error) {
      console.error('Error creating inventory item:', error);
      alert('Failed to create inventory item');
    }
  };

  const handleUpdateCustomItem = async (
    id: number,
    payload: {
      name: string;
      category: string;
      unit_label: string;
      default_ml: number | null;
    }
  ) => {
    try {
      const response = await fetch('/api/custom-inventory/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      });
      if (response.ok) {
        fetchData();
        setShowCustomItemModal(false);
        setEditingCustomItem(null);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update inventory item');
      }
    } catch (error) {
      console.error('Error updating inventory item:', error);
      alert('Failed to update inventory item');
    }
  };

  const handleDeleteCustomItem = async (item: CustomInventoryItem) => {
    if (!confirm(`Delete item type "${item.name}"?`)) return;
    try {
      const response = await fetch(`/api/custom-inventory/items?id=${item.id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchData();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to delete inventory item');
      }
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      alert('Failed to delete inventory item');
    }
  };

  const handleCreateCategory = async (payload: { name: string; description: string }) => {
    try {
      const response = await fetch('/api/custom-inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        fetchData();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Failed to create category');
    }
  };

  const handleDeleteCategory = async (category: CustomInventoryCategory) => {
    if (!confirm(`Delete category "${category.name}"?`)) return;
    try {
      const response = await fetch(`/api/custom-inventory/categories?id=${category.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchData();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  };

  const handleCreateCustomStock = async (payload: {
    item_id: number;
    quantity_added: number;
    unit_cost: number;
    purchase_date: string;
    note: string;
  }) => {
    try {
      const response = await fetch('/api/custom-inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        fetchData();
        setShowCustomStockModal(false);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to add stock for inventory item');
      }
    } catch (error) {
      console.error('Error stocking inventory item:', error);
      alert('Failed to add stock for inventory item');
    }
  };

  const customStockSummary = customItems.map((item) => {
    const entries = customStockEntries.filter((e) => e.item_id === item.id);
    const remaining = entries.reduce((sum, e) => sum + (e.remaining_quantity || 0), 0);
    const purchased = entries.reduce((sum, e) => sum + (e.quantity_added || 0), 0);
    return { ...item, purchased, remaining };
  });

  const shipmentMap = new Map<number, ShipmentGroup>();
  stocks.forEach((stock) => {
    const group = shipmentMap.get(stock.shipment_id);
    if (!group) {
      shipmentMap.set(stock.shipment_id, {
        shipment_id: stock.shipment_id,
        shipment_name: stock.shipment_name,
        purchase_date: stock.purchase_date,
        transport_cost: stock.transport_cost || 0,
        other_expenses: stock.other_expenses || 0,
        funded_from: stock.funded_from,
        items: [stock],
      });
    } else {
      group.items.push(stock);
    }
  });
  customStockEntries.forEach((entry) => {
    const sid = Number(entry.shipment_id || 0);
    if (!sid || Number.isNaN(sid)) return;
    if (!shipmentMap.has(sid)) {
      shipmentMap.set(sid, {
        shipment_id: sid,
        shipment_name: entry.shipment_name || undefined,
        purchase_date: entry.shipment_purchase_date || entry.purchase_date,
        transport_cost: Number(entry.shipment_transport_cost || 0),
        other_expenses: Number(entry.shipment_other_expenses || 0),
        funded_from: (entry.shipment_funded_from as 'sales' | 'capital' | null) || 'sales',
        items: [],
      });
    }
  });
  const shipments = Array.from(shipmentMap.values()).sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));
  const rowsPerPage = 10;

  const paginate = <T,>(rows: T[], page: number) => {
    const safePage = Math.max(1, page);
    const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
    const normalizedPage = Math.min(safePage, totalPages);
    const start = (normalizedPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return {
      pageRows: rows.slice(start, end),
      totalPages,
      normalizedPage,
    };
  };

  const perfumePagination = paginate(perfumes, perfumePage);
  const customPagination = paginate(customStockSummary, customInventoryPage);
  const stockPagination = paginate(shipments, stockPage);
  const deletedPagination = paginate(deletedBottles, deletedPage);

  useEffect(() => {
    if (perfumePage !== perfumePagination.normalizedPage) setPerfumePage(perfumePagination.normalizedPage);
    if (customInventoryPage !== customPagination.normalizedPage) setCustomInventoryPage(customPagination.normalizedPage);
    if (stockPage !== stockPagination.normalizedPage) setStockPage(stockPagination.normalizedPage);
    if (deletedPage !== deletedPagination.normalizedPage) setDeletedPage(deletedPagination.normalizedPage);
  }, [
    perfumePage,
    customInventoryPage,
    stockPage,
    deletedPage,
    perfumePagination.normalizedPage,
    customPagination.normalizedPage,
    stockPagination.normalizedPage,
    deletedPagination.normalizedPage,
  ]);

  if (loading) {
    return (
      <DashboardLayout title="Inventory Management">
        <div className="text-center py-8">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Inventory Management">
      <div className="space-y-6">
        {/* Perfumes Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Perfumes</h2>
              <button
                onClick={() => setShowPerfumeModal(true)}
                className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                <Plus size={20} />
                <span>Add Perfume</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volume (ml)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Decants/Bottle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {perfumePagination.pageRows.map((perfume) => {
                  const perfumeStocks = stocks.filter(s => s.perfume_id === perfume.id);
                  const totalStock = perfumeStocks.reduce((sum, s) => sum + s.remaining_quantity, 0);
                  return (
                    <tr key={perfume.id}>
                      <td className="px-6 py-4 font-medium text-gray-900">{perfume.name}</td>
                      <td className="px-6 py-4 text-gray-600">{perfume.volume_ml}</td>
                      <td className="px-6 py-4 text-gray-600">{perfume.estimated_decants_per_bottle}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-sm ${totalStock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {totalStock} bottles
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {(perfume.is_out_of_stock || 0) === 1 && (
                          <span className="mr-2 px-2 py-1 rounded text-xs bg-red-100 text-red-800">Marked out</span>
                        )}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleTogglePerfumeOutOfStock(perfume)}
                            className={`${(perfume.is_out_of_stock || 0) === 1 ? 'text-green-600 hover:text-green-700' : 'text-orange-600 hover:text-orange-700'}`}
                            title={(perfume.is_out_of_stock || 0) === 1 ? 'Mark in stock' : 'Mark out of stock'}
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingPerfume(perfume);
                              setShowPerfumeModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit perfume"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeletePerfume(perfume.id, perfume.name)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete perfume"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={perfumePagination.normalizedPage}
            totalPages={perfumePagination.totalPages}
            onChangePage={setPerfumePage}
          />
        </div>

        {/* Custom Inventory (Decant bottles, polythenes, user-defined) */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Custom Inventory Items</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-800"
                >
                  Manage Categories
                </button>
                <button
                  onClick={() => {
                    setEditingCustomItem(null);
                    setShowCustomItemModal(true);
                  }}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                >
                  Add Item Type
                </button>
                <button
                  onClick={() => {
                    if (customItems.length === 0) {
                      alert('Create an inventory item first.');
                      return;
                    }
                    setShowCustomStockModal(true);
                  }}
                  className="rounded-lg bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
                >
                  Stock Item
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Includes decant bottles, polythenes, and any custom item you create.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size/ML</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchased</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customStockSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-6 text-sm text-gray-500">
                      No custom inventory items yet.
                    </td>
                  </tr>
                ) : (
                  customPagination.pageRows.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 text-gray-600">{item.category}</td>
                      <td className="px-6 py-4 text-gray-600">{item.unit_label || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{item.default_ml ?? '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{item.purchased}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-sm ${item.remaining > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {item.remaining}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingCustomItem(item);
                              setShowCustomItemModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit item type"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomItem(item)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete item type"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={customPagination.normalizedPage}
            totalPages={customPagination.totalPages}
            onChangePage={setCustomInventoryPage}
          />
        </div>

        {/* Stock Groups Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Stock Shipments</h2>
              <button
                onClick={() => setShowStockModal(true)}
                className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                <Package size={20} />
                <span>Add Stock Shipment</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Funding</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stockPagination.pageRows.map((shipment) => {
                  const customRowsForShipment = customStockEntries.filter((c) => Number(c.shipment_id || 0) === shipment.shipment_id);
                  const totalItems = shipment.items.length + customRowsForShipment.length;
                  const totalRemaining = shipment.items.reduce((sum, i) => sum + (i.remaining_quantity || 0), 0);
                  const totalCustomRemaining = customRowsForShipment.reduce((sum, c) => sum + Number(c.remaining_quantity || 0), 0);
                  const totalCustomCost = customRowsForShipment.reduce((sum, c) => sum + (Number(c.quantity_added || 0) * Number(c.unit_cost || 0)), 0);
                  const totalCost = shipment.items.reduce((sum, i) => sum + (i.subtotal_cost || 0), 0) + totalCustomCost + (shipment.transport_cost || 0) + (shipment.other_expenses || 0);
                  const expanded = expandedShipmentId === shipment.shipment_id;
                  return (
                    <Fragment key={`shipment-fragment-${shipment.shipment_id}`}>
                      <tr key={`shipment-${shipment.shipment_id}`} className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedShipmentId(expanded ? null : shipment.shipment_id)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 font-medium text-gray-900">
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span>{shipment.shipment_name || `Shipment #${shipment.shipment_id}`}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{shipment.purchase_date}</td>
                        <td className="px-6 py-4 text-gray-600">{totalItems}</td>
                        <td className="px-6 py-4 text-gray-600">{totalRemaining + totalCustomRemaining}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">UGX {totalCost.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${shipment.funded_from === 'capital' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                            {shipment.funded_from === 'capital' ? 'Capital' : 'Re-investment'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingShipment(shipment);
                                setShowShipmentModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-700"
                              title="View/Edit shipment and all items"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteShipment(shipment);
                              }}
                              className="text-red-600 hover:text-red-700"
                              title="Delete full shipment"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`shipment-items-${shipment.shipment_id}`} className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                              <table className="w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sold</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {shipment.items.map((stock) => (
                                    <tr key={stock.id}>
                                      <td className="px-4 py-3 font-medium text-gray-900">{stock.perfume_name}</td>
                                      <td className="px-4 py-3 text-gray-600">{stock.quantity}</td>
                                      <td className="px-4 py-3 text-gray-600">{stock.remaining_quantity}</td>
                                      <td className="px-4 py-3 text-gray-600">UGX {stock.buying_cost_per_bottle.toLocaleString()}</td>
                                      <td className="px-4 py-3 text-sm text-gray-600">
                                        <div>{stock.bottles_sold || 0}b, {stock.decants_sold || 0}d</div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              setEditingShipment(shipment);
                                              setShowShipmentModal(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-700"
                                            title="Edit shipment items"
                                          >
                                            <Edit2 size={16} />
                                          </button>
                                          <button
                                            onClick={() => handleMarkBottleOutOfStock(stock)}
                                            className="text-orange-600 hover:text-orange-700"
                                            title="Mark bottle(s) out of stock"
                                          >
                                            <ArchiveX size={16} />
                                          </button>
                                          <button
                                            onClick={() => handleMarkBottleDone(stock)}
                                            className="text-emerald-600 hover:text-emerald-700"
                                            title="Mark bottle done (out of decants)"
                                          >
                                            <CheckCircle2 size={16} />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteStock(stock.id)}
                                            className="text-red-600 hover:text-red-700"
                                            title="Delete item from shipment"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {customRowsForShipment.length > 0 && (
                              <div className="mt-4 overflow-x-auto rounded border border-gray-200 bg-white">
                                <div className="border-b border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
                                  Other Inventory Items
                                </div>
                                <table className="w-full">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty Added</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {customRowsForShipment.map((c) => (
                                        <tr key={`custom-${c.id}`}>
                                          <td className="px-4 py-3 font-medium text-gray-900">{c.item_name}</td>
                                          <td className="px-4 py-3 text-gray-600">{c.category}</td>
                                          <td className="px-4 py-3 text-gray-600">{c.quantity_added}</td>
                                          <td className="px-4 py-3 text-gray-600">{c.remaining_quantity}</td>
                                          <td className="px-4 py-3 text-gray-600">UGX {Number(c.unit_cost || 0).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={stockPagination.normalizedPage}
            totalPages={stockPagination.totalPages}
            onChangePage={setStockPage}
          />
        </div>

        {/* Deleted / Out-of-Stock Bottles Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Deleted / Out-of-Stock Bottles</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Perfume</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Removed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deletedBottles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-sm text-gray-500">
                      No bottles have been marked out of stock yet.
                    </td>
                  </tr>
                ) : (
                  deletedPagination.pageRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-6 py-4 font-medium text-gray-900">{row.perfume_name}</td>
                      <td className="px-6 py-4 text-gray-600">{row.shipment_name || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{row.quantity_removed}</td>
                      <td className="px-6 py-4 text-gray-600">{row.reason}</td>
                      <td className="px-6 py-4 text-gray-600">{row.note || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(row.removed_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={deletedPagination.normalizedPage}
            totalPages={deletedPagination.totalPages}
            onChangePage={setDeletedPage}
          />
        </div>

        {/* Danger Zone */}
        {user?.role === 'admin' && (
          <div className="bg-red-50 border border-red-200 rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-red-900">Danger Zone</h2>
              <p className="mt-2 text-sm text-red-800">
                Clear all business data while keeping users. This permanently deletes perfumes, stock,
                sales, debt/payments, expenses, investments, and related logs.
              </p>
              <button
                onClick={handleClearAllBusinessData}
                className="mt-4 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Clear All Data (Keep Users)
              </button>
            </div>
          </div>
        )}
      </div>

      {showPerfumeModal && (
        <PerfumeModal
          perfume={editingPerfume}
          onClose={() => {
            setShowPerfumeModal(false);
            setEditingPerfume(null);
          }}
          onSuccess={() => {
            fetchData();
            setShowPerfumeModal(false);
            setEditingPerfume(null);
          }}
        />
      )}

      {showStockModal && (
        <StockModal
          perfumes={perfumes}
          customItems={customItems}
          stock={editingStock}
          onClose={() => {
            setShowStockModal(false);
            setEditingStock(null);
          }}
          onSuccess={() => {
            fetchData();
            setShowStockModal(false);
            setEditingStock(null);
          }}
        />
      )}

      {showShipmentModal && (
        <ShipmentEditModal
          shipment={editingShipment}
          perfumes={perfumes}
          customItems={customItems}
          customStockEntries={customStockEntries}
          onClose={() => {
            setShowShipmentModal(false);
            setEditingShipment(null);
          }}
          onSuccess={() => {
            fetchData();
            setShowShipmentModal(false);
            setEditingShipment(null);
          }}
        />
      )}

      {showCustomItemModal && (
        <CustomInventoryItemModal
          item={editingCustomItem}
          categories={customCategories}
          onOpenCategoryManager={() => setShowCategoryModal(true)}
          onClose={() => {
            setShowCustomItemModal(false);
            setEditingCustomItem(null);
          }}
          onSubmit={async (payload, id) => {
            if (id) {
              await handleUpdateCustomItem(id, payload);
            } else {
              await handleCreateCustomItem(payload);
            }
          }}
        />
      )}

      {showCustomStockModal && (
        <CustomInventoryStockModal
          items={customItems}
          onClose={() => setShowCustomStockModal(false)}
          onSubmit={handleCreateCustomStock}
        />
      )}

      {showCategoryModal && (
        <CategoryManagerModal
          categories={customCategories}
          onClose={() => setShowCategoryModal(false)}
          onCreateCategory={handleCreateCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      )}
    </DashboardLayout>
  );
}

function ShipmentEditModal({
  shipment,
  perfumes,
  customItems,
  customStockEntries,
  onClose,
  onSuccess,
}: {
  shipment: ShipmentGroup | null;
  perfumes: Perfume[];
  customItems: CustomInventoryItem[];
  customStockEntries: CustomInventoryStockEntry[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [shipmentName, setShipmentName] = useState(shipment?.shipment_name || '');
  const [transportCost, setTransportCost] = useState(String(shipment?.transport_cost || 0));
  const [otherExpenses, setOtherExpenses] = useState(String(shipment?.other_expenses || 0));
  const [purchaseDate, setPurchaseDate] = useState(shipment?.purchase_date || new Date().toISOString().split('T')[0]);
  const [fundedFrom, setFundedFrom] = useState<'sales' | 'capital'>(shipment?.funded_from || 'sales');
  const [items, setItems] = useState<{
    stock_group_id?: number;
    perfume_id: string;
    quantity: string;
    buying_cost_per_bottle: string;
  }[]>(
    shipment?.items.map((i) => ({
      stock_group_id: i.id,
      perfume_id: String(i.perfume_id),
      quantity: String(i.quantity),
      buying_cost_per_bottle: String(i.buying_cost_per_bottle),
    })) || []
  );
  const [customRows, setCustomRows] = useState<{
    id?: number;
    item_id: string;
    quantity_added: string;
    unit_cost: string;
    note: string;
  }[]>(
    (customStockEntries
      .filter((c) => Number(c.shipment_id || 0) === Number(shipment?.shipment_id || 0))
      .map((c) => ({
        id: c.id,
        item_id: String(c.item_id),
        quantity_added: String(c.quantity_added),
        unit_cost: String(c.unit_cost),
        note: c.note || '',
      }))) || []
  );
  const [saving, setSaving] = useState(false);

  if (!shipment) return null;

  const addItem = () => {
    setItems([...items, { perfume_id: '', quantity: '', buying_cost_per_bottle: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const addCustomRow = () => {
    setCustomRows([...customRows, { item_id: '', quantity_added: '', unit_cost: '0', note: '' }]);
  };

  const removeCustomRow = (index: number) => {
    setCustomRows(customRows.filter((_, i) => i !== index));
  };

  const updateCustomRow = (index: number, field: string, value: string) => {
    const next = [...customRows];
    next[index] = { ...next[index], [field]: value };
    setCustomRows(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payloadItems = items
      .filter((item) => item.perfume_id && item.quantity && item.buying_cost_per_bottle)
      .map((item) => ({
        stock_group_id: item.stock_group_id,
        perfume_id: Number(item.perfume_id),
        quantity: Number(item.quantity),
        buying_cost_per_bottle: Number(item.buying_cost_per_bottle),
      }))
      .filter((item) => item.perfume_id && item.quantity > 0 && item.buying_cost_per_bottle >= 0);

    const payloadCustomItems = customRows
      .filter((row) => row.item_id && row.quantity_added)
      .map((row) => ({
        id: row.id,
        item_id: Number(row.item_id),
        quantity_added: Number(row.quantity_added),
        unit_cost: Number(row.unit_cost || 0),
        note: row.note || '',
      }))
      .filter((row) => row.item_id && row.quantity_added > 0 && !Number.isNaN(row.unit_cost) && row.unit_cost >= 0);

    if (payloadItems.length === 0 && payloadCustomItems.length === 0) {
      alert('Add at least one valid perfume or custom item.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_id: shipment.shipment_id,
          shipment_name: shipmentName || null,
          transport_cost: Number(transportCost) || 0,
          other_expenses: Number(otherExpenses) || 0,
          purchase_date: purchaseDate,
          funded_from: fundedFrom,
          items: payloadItems,
          custom_items: payloadCustomItems,
        }),
      });
      if (response.ok) {
        onSuccess();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update shipment');
      }
    } catch (error) {
      console.error('Error updating shipment:', error);
      alert('Failed to update shipment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white">
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">View/Edit Shipment</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex h-full flex-col overflow-auto p-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Shipment Name</label>
                <input
                  value={shipmentName}
                  onChange={(e) => setShipmentName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Purchase Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <label className="mb-2 block text-sm font-medium text-gray-700">Funding source</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="shipment_funded_from"
                      checked={fundedFrom === 'sales'}
                      onChange={() => setFundedFrom('sales')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-900">Re-investment (from sales)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="shipment_funded_from"
                      checked={fundedFrom === 'capital'}
                      onChange={() => setFundedFrom('capital')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-900">Capital (new investment)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Transport Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={transportCost}
                  onChange={(e) => setTransportCost(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Other Expenses</label>
                <input
                  type="number"
                  step="0.01"
                  value={otherExpenses}
                  onChange={(e) => setOtherExpenses(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Shipment Items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center rounded-lg bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Item
                </button>
              </div>
              {items.map((item, index) => (
                <div key={`${item.stock_group_id || 'new'}-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Perfume</label>
                    <select
                      value={item.perfume_id}
                      onChange={(e) => updateItem(index, 'perfume_id', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    >
                      <option value="">Select perfume</option>
                      {perfumes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Cost/Unit</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.buying_cost_per_bottle}
                      onChange={(e) => updateItem(index, 'buying_cost_per_bottle', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Custom Inventory Items</h3>
                <button
                  type="button"
                  onClick={addCustomRow}
                  className="inline-flex items-center rounded-lg bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Custom Item
                </button>
              </div>

              {customRows.length === 0 ? (
                <p className="text-sm text-gray-500">No custom items linked to this shipment yet.</p>
              ) : (
                customRows.map((row, index) => (
                  <div key={`${row.id || 'new-custom'}-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-5">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Item</label>
                      <select
                        value={row.item_id}
                        onChange={(e) => updateCustomRow(index, 'item_id', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      >
                        <option value="">Select custom item</option>
                        {customItems.map((ci) => (
                          <option key={ci.id} value={ci.id}>
                            {ci.name} ({ci.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Qty</label>
                      <input
                        type="number"
                        value={row.quantity_added}
                        onChange={(e) => updateCustomRow(index, 'quantity_added', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Cost/Unit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.unit_cost}
                        onChange={(e) => updateCustomRow(index, 'unit_cost', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeCustomRow(index)}
                        className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-auto flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Shipment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function TablePagination({
  currentPage,
  totalPages,
  onChangePage,
}: {
  currentPage: number;
  totalPages: number;
  onChangePage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
      <p className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onChangePage(currentPage - 1)}
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onChangePage(currentPage + 1)}
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function PerfumeModal({ perfume, onClose, onSuccess }: { 
  perfume: Perfume | null;
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: perfume?.name || '',
    volume_ml: perfume?.volume_ml?.toString() || '100',
    estimated_decants_per_bottle: perfume?.estimated_decants_per_bottle?.toString() || '10'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = perfume ? '/api/perfumes' : '/api/perfumes';
      const method = perfume ? 'PUT' : 'POST';
      const body = perfume 
        ? {
            id: perfume.id,
            name: formData.name,
            volume_ml: parseInt(formData.volume_ml),
            estimated_decants_per_bottle: parseInt(formData.estimated_decants_per_bottle)
          }
        : {
            name: formData.name,
            volume_ml: parseInt(formData.volume_ml),
            estimated_decants_per_bottle: parseInt(formData.estimated_decants_per_bottle)
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || `Failed to ${perfume ? 'update' : 'create'} perfume`);
      }
    } catch (error) {
      console.error(`Error ${perfume ? 'updating' : 'creating'} perfume:`, error);
      alert(`Failed to ${perfume ? 'update' : 'create'} perfume`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {perfume ? 'Edit Perfume' : 'Add New Perfume'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Perfume Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Volume (ml)</label>
            <input
              type="number"
              required
              value={formData.volume_ml}
              onChange={(e) => setFormData({ ...formData, volume_ml: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Decants per Bottle</label>
            <input
              type="number"
              required
              value={formData.estimated_decants_per_bottle}
              onChange={(e) => setFormData({ ...formData, estimated_decants_per_bottle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              {perfume ? 'Update Perfume' : 'Add Perfume'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockModal({ perfumes, customItems, stock, onClose, onSuccess }: { 
  perfumes: Perfume[];
  customItems: CustomInventoryItem[];
  stock: StockWithDetails | null;
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [shipmentName, setShipmentName] = useState(stock?.shipment_name || '');
  const [transportCost, setTransportCost] = useState(stock?.transport_cost?.toString() || '0');
  const [otherExpenses, setOtherExpenses] = useState(stock?.other_expenses?.toString() || '0');
  const [purchaseDate, setPurchaseDate] = useState(
    stock?.purchase_date || new Date().toISOString().split('T')[0]
  );
  const [fundedFrom, setFundedFrom] = useState<'sales' | 'capital'>(stock?.funded_from || 'sales');
  
  const [items, setItems] = useState<{
    perfume_id: string;
    quantity: string;
    buying_cost_per_bottle: string;
  }[]>(
    stock ? [{
      perfume_id: stock.perfume_id.toString(),
      quantity: stock.quantity.toString(),
      buying_cost_per_bottle: stock.buying_cost_per_bottle.toString()
    }] : [{
      perfume_id: '',
      quantity: '',
      buying_cost_per_bottle: ''
    }]
  );
  const [customStockItems, setCustomStockItems] = useState<{
    item_id: string;
    quantity_added: string;
    unit_cost: string;
  }[]>([{ item_id: '', quantity_added: '', unit_cost: '' }]);

  const isViewMode = stock !== null;

  const addItem = () => {
    setItems([...items, { perfume_id: '', quantity: '', buying_cost_per_bottle: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addCustomStockItem = () => {
    setCustomStockItems([...customStockItems, { item_id: '', quantity_added: '', unit_cost: '' }]);
  };

  const removeCustomStockItem = (index: number) => {
    if (customStockItems.length > 1) {
      setCustomStockItems(customStockItems.filter((_, i) => i !== index));
    }
  };

  const updateCustomStockItem = (index: number, field: string, value: string) => {
    const newItems = [...customStockItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setCustomStockItems(newItems);
  };

  const calculateTotal = () => {
    const perfumeItemsTotal = items.reduce((sum, item) => {
      return sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.buying_cost_per_bottle) || 0));
    }, 0);
    const customItemsTotal = customStockItems.reduce((sum, item) => {
      return sum + ((parseFloat(item.quantity_added) || 0) * (parseFloat(item.unit_cost) || 0));
    }, 0);
    const additionalCosts = (parseFloat(transportCost) || 0) + (parseFloat(otherExpenses) || 0);
    return perfumeItemsTotal + customItemsTotal + additionalCosts;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const perfumePayload = items
        .filter((item) => item.perfume_id && item.quantity && item.buying_cost_per_bottle)
        .map((item) => ({
          perfume_id: parseInt(item.perfume_id),
          quantity: parseInt(item.quantity),
          buying_cost_per_bottle: parseFloat(item.buying_cost_per_bottle),
        }))
        .filter((item) => item.perfume_id && item.quantity > 0 && item.buying_cost_per_bottle >= 0);

      const customPayload = customStockItems
        .filter((item) => item.item_id && item.quantity_added)
        .map((item) => ({
          item_id: parseInt(item.item_id),
          quantity_added: parseInt(item.quantity_added),
          unit_cost: parseFloat(item.unit_cost),
          note: shipmentName ? `Stock record: ${shipmentName}` : '',
        }))
        .filter((item) => item.item_id && item.quantity_added > 0 && !Number.isNaN(item.unit_cost) && item.unit_cost >= 0);

      if (perfumePayload.length === 0 && customPayload.length === 0) {
        alert('Add at least one perfume item or one custom inventory item to stock.');
        return;
      }

      const response = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_name: shipmentName || null,
          transport_cost: parseFloat(transportCost) || 0,
          other_expenses: parseFloat(otherExpenses) || 0,
          purchase_date: purchaseDate,
          funded_from: fundedFrom,
          items: perfumePayload,
          custom_items: customPayload,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to record stock');
        return;
      }
      onSuccess();
    } catch (error) {
      console.error('Error recording stock:', error);
      alert('Failed to record stock');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full p-6 my-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {isViewMode ? 'Stock Details' : 'Add Stock Shipment'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Shipment Details */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-gray-900">Shipment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shipment Name (Optional)
                </label>
                <input
                  type="text"
                  disabled={isViewMode}
                  value={shipmentName}
                  onChange={(e) => setShipmentName(e.target.value)}
                  placeholder="e.g., Dubai Shipment Jan 2024"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  required
                  disabled={isViewMode}
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transport Cost (UGX)
                </label>
                <input
                  type="number"
                  step="0.01"
                  disabled={isViewMode}
                  value={transportCost}
                  onChange={(e) => setTransportCost(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Other Expenses (UGX)
                </label>
                <input
                  type="number"
                  step="0.01"
                  disabled={isViewMode}
                  value={otherExpenses}
                  onChange={(e) => setOtherExpenses(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-60"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-2">Funding source</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="funded_from"
                      checked={fundedFrom === 'sales'}
                      onChange={() => setFundedFrom('sales')}
                      disabled={isViewMode}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-900">From sales (re-investment)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="funded_from"
                      checked={fundedFrom === 'capital'}
                      onChange={() => setFundedFrom('capital')}
                      disabled={isViewMode}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-900">New capital (recorded as capital)</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {fundedFrom === 'sales' ? 'Profit from sales used to buy this stock.' : 'New money invested; total shipment cost will be recorded in Investments.'}
                </p>
              </div>
            </div>
          </div>

          {/* Perfume Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Perfumes in This Shipment</h3>
              {!isViewMode && (
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center space-x-1 text-purple-600 hover:text-purple-700 text-sm font-medium"
                >
                  <Plus size={16} />
                  <span>Add Another Perfume</span>
                </button>
              )}
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="border border-gray-200 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Perfume #{index + 1}</span>
                  {!isViewMode && items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Perfume</label>
                    <select
                      disabled={isViewMode}
                      value={item.perfume_id}
                      onChange={(e) => updateItem(index, 'perfume_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-60"
                    >
                      <option value="">Select perfume</option>
                      {perfumes.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {p.volume_ml}ml
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      disabled={isViewMode}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      placeholder="Bottles"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost/Bottle</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={isViewMode}
                      value={item.buying_cost_per_bottle}
                      onChange={(e) => updateItem(index, 'buying_cost_per_bottle', e.target.value)}
                      placeholder="UGX"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-60"
                    />
                  </div>
                </div>
                
                <div className="text-sm text-gray-600">
                  Subtotal: UGX {((parseFloat(item.quantity) || 0) * (parseFloat(item.buying_cost_per_bottle) || 0)).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Custom Inventory Items */}
          {!isViewMode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Other Inventory Items in This Stock Record</h3>
                <button
                  type="button"
                  onClick={addCustomStockItem}
                  className="flex items-center space-x-1 text-purple-600 hover:text-purple-700 text-sm font-medium"
                >
                  <Plus size={16} />
                  <span>Add Custom Item</span>
                </button>
              </div>

              {customStockItems.map((item, index) => (
                <div key={index} className="border border-gray-200 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Custom Item #{index + 1}</span>
                    {customStockItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCustomStockItem(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                      <select
                        value={item.item_id}
                        onChange={(e) => updateCustomStockItem(index, 'item_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select item</option>
                        {customItems.map((ci) => (
                          <option key={ci.id} value={ci.id}>
                            {ci.name} ({ci.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={item.quantity_added}
                        onChange={(e) => updateCustomStockItem(index, 'quantity_added', e.target.value)}
                        placeholder="Units"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost/Unit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_cost}
                        onChange={(e) => updateCustomStockItem(index, 'unit_cost', e.target.value)}
                        placeholder="UGX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">
                    Subtotal: UGX {((parseFloat(item.quantity_added) || 0) * (parseFloat(item.unit_cost) || 0)).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total Summary */}
          <div className="bg-purple-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Perfumes Cost:</span>
              <span className="font-medium text-gray-900">
                UGX {items.reduce((sum, item) => 
                  sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.buying_cost_per_bottle) || 0)), 0
                ).toLocaleString()}
              </span>
            </div>
            {!isViewMode && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Other Inventory Cost:</span>
                <span className="font-medium text-gray-900">
                  UGX {customStockItems.reduce((sum, item) =>
                    sum + ((parseFloat(item.quantity_added) || 0) * (parseFloat(item.unit_cost) || 0)), 0
                  ).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Transport + Other:</span>
              <span className="font-medium text-gray-900">
                UGX {((parseFloat(transportCost) || 0) + (parseFloat(otherExpenses) || 0)).toLocaleString()}
              </span>
            </div>
            <div className="border-t border-purple-200 pt-2 flex justify-between">
              <span className="font-semibold text-gray-900">Total Shipment Cost:</span>
              <span className="font-bold text-purple-900 text-lg">
                UGX {calculateTotal().toLocaleString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {isViewMode ? 'Close' : 'Cancel'}
            </button>
            {!isViewMode && (
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add Shipment
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomInventoryItemModal({
  item,
  categories,
  onOpenCategoryManager,
  onClose,
  onSubmit,
}: {
  item: CustomInventoryItem | null;
  categories: CustomInventoryCategory[];
  onOpenCategoryManager: () => void;
  onClose: () => void;
  onSubmit: (
    payload: {
      name: string;
      category: string;
      unit_label: string;
      default_ml: number | null;
    },
    id?: number
  ) => Promise<void>;
}) {
  const fallbackCategory = categories[0]?.name || 'packaging';
  const [formData, setFormData] = useState({
    name: item?.name || '',
    category: item?.category || fallbackCategory,
    unit_label: item?.unit_label || 'piece',
    default_ml: item?.default_ml?.toString() || '',
  });
  const [saving, setSaving] = useState(false);
  const isMlBasedCategory = /(decant|bottle|vial|ml)/i.test(formData.category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    const category = formData.category.trim().toLowerCase();
    const unitLabel = formData.unit_label.trim();
    const defaultMl = isMlBasedCategory && formData.default_ml.trim() !== ''
      ? Number(formData.default_ml)
      : null;

    if (!name || !category) {
      alert('Name and category are required.');
      return;
    }
    if (isMlBasedCategory && defaultMl !== null && (Number.isNaN(defaultMl) || defaultMl < 0)) {
      alert('Default ml must be a valid number (or left blank).');
      return;
    }

    setSaving(true);
    await onSubmit(
      {
      name,
      category,
      unit_label: unitLabel || 'piece',
      default_ml: defaultMl,
      },
      item?.id
    );
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          {item ? 'Edit Inventory Item Type' : 'Add Inventory Item Type'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Item Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. 10ml Decant Bottle"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              >
                {categories.length === 0 ? (
                  <option value={formData.category || 'packaging'}>
                    {formData.category || 'packaging'}
                  </option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={onOpenCategoryManager}
                className="inline-flex items-center rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-800"
              >
                <Tags className="mr-2 h-4 w-4" />
                Manage Categories
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Unit Label</label>
              <input
                type="text"
                value={formData.unit_label}
                onChange={(e) => setFormData({ ...formData, unit_label: e.target.value })}
                placeholder="piece"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {isMlBasedCategory ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Default ml (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.default_ml}
                  onChange={(e) => setFormData({ ...formData, default_ml: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Default size</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  Not applicable for this category
                </div>
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
              {saving ? 'Saving...' : item ? 'Update Item Type' : 'Add Item Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomInventoryStockModal({
  items,
  onClose,
  onSubmit,
}: {
  items: CustomInventoryItem[];
  onClose: () => void;
  onSubmit: (payload: {
    item_id: number;
    quantity_added: number;
    unit_cost: number;
    purchase_date: string;
    note: string;
  }) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    item_id: items[0]?.id?.toString() || '',
    quantity_added: '1',
    unit_cost: '0',
    purchase_date: new Date().toISOString().split('T')[0],
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemId = Number(formData.item_id);
    const quantity = Number(formData.quantity_added);
    const unitCost = Number(formData.unit_cost);
    if (!itemId || Number.isNaN(itemId)) {
      alert('Please select an item.');
      return;
    }
    if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
      alert('Quantity must be greater than 0.');
      return;
    }
    if (Number.isNaN(unitCost) || unitCost < 0) {
      alert('Unit cost must be 0 or greater.');
      return;
    }

    setSaving(true);
    await onSubmit({
      item_id: itemId,
      quantity_added: quantity,
      unit_cost: unitCost,
      purchase_date: formData.purchase_date,
      note: formData.note.trim(),
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">Stock Custom Inventory Item</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Item</label>
            <select
              required
              value={formData.item_id}
              onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.category})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Quantity</label>
              <input
                type="number"
                min={1}
                required
                value={formData.quantity_added}
                onChange={(e) => setFormData({ ...formData, quantity_added: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Unit Cost (UGX)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Purchase Date</label>
            <input
              type="date"
              required
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Note (optional)</label>
            <textarea
              rows={2}
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
            />
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
              {saving ? 'Saving...' : 'Stock Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryManagerModal({
  categories,
  onClose,
  onCreateCategory,
  onDeleteCategory,
}: {
  categories: CustomInventoryCategory[];
  onClose: () => void;
  onCreateCategory: (payload: { name: string; description: string }) => Promise<void>;
  onDeleteCategory: (category: CustomInventoryCategory) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim().toLowerCase();
    if (!name) {
      alert('Category name is required');
      return;
    }
    setSaving(true);
    await onCreateCategory({ name, description: formData.description.trim() });
    setSaving(false);
    setFormData({ name: '', description: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white">
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Manage Custom Inventory Categories</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid h-full grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Create Category</h3>
              <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Category Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. decant_bottle"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description (optional)</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Add Category'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 overflow-hidden rounded-lg border border-gray-200">
              <div className="h-full overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-sm text-gray-500">
                          No categories yet.
                        </td>
                      </tr>
                    ) : (
                      categories.map((cat) => (
                        <tr key={cat.id}>
                          <td className="px-4 py-3 font-medium text-gray-900">{cat.name}</td>
                          <td className="px-4 py-3 text-gray-600">{cat.description || '-'}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => onDeleteCategory(cat)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
