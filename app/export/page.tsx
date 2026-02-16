'use client';

import { useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Download, Upload, AlertTriangle } from 'lucide-react';

export default function ExportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    stats?: Record<string, number>;
  } | null>(null);
  const [showConfirmImport, setShowConfirmImport] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (type: string) => {
    try {
      setExporting(type);

      if (type === 'database') {
        const response = await fetch('/api/database/export');
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        a.download = filenameMatch ? filenameMatch[1] : `mumi_pos_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        return;
      }

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
      const filename = filenameMatch ? filenameMatch[1] : `export_${type}_${Date.now()}.csv`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting:', error);
      alert(error?.message || 'Failed to export data');
    } finally {
      setExporting(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('Please select a JSON backup file (.json)');
      e.target.value = '';
      return;
    }

    setPendingFile(file);
    setShowConfirmImport(true);
    e.target.value = '';
  };

  const executeImport = async () => {
    if (!pendingFile) return;

    setShowConfirmImport(false);
    setImporting(true);
    setImportResult(null);

    try {
      const text = await pendingFile.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportResult({ success: false, message: 'Invalid JSON file. Could not parse the backup.' });
        return;
      }

      if (!parsed.tables || typeof parsed.tables !== 'object') {
        setImportResult({ success: false, message: 'Invalid backup format. Missing "tables" object.' });
        return;
      }

      const response = await fetch('/api/database/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });

      const result = await response.json();

      if (response.ok) {
        setImportResult({
          success: true,
          message: result.message || 'Database imported successfully',
          stats: result.stats,
        });
      } else {
        setImportResult({ success: false, message: result.error || 'Import failed' });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      setImportResult({ success: false, message: error?.message || 'Failed to import database' });
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  const exportOptions = [
    {
      title: 'Database Backup',
      description: 'Download complete database as a JSON file for backup or migration',
      type: 'database',
      color: 'bg-purple-600 hover:bg-purple-700',
      icon: '💾',
    },
    {
      title: 'Sales Report',
      description: 'Export all sales data with customer and item details',
      type: 'sales',
      color: 'bg-blue-600 hover:bg-blue-700',
      icon: '🛍️',
    },
    {
      title: 'Profit & Loss Report',
      description: 'Export comprehensive profit and loss statement',
      type: 'profit-loss',
      color: 'bg-green-600 hover:bg-green-700',
      icon: '📊',
    },
    {
      title: 'Debt Report',
      description: 'Export list of outstanding customer debts',
      type: 'debt',
      color: 'bg-orange-600 hover:bg-orange-700',
      icon: '💳',
    },
    {
      title: 'Investment Report',
      description: 'Export all investment and stock purchase records',
      type: 'investment',
      color: 'bg-indigo-600 hover:bg-indigo-700',
      icon: '💰',
    },
  ];

  return (
    <DashboardLayout title="Export & Backup">
      <div className="space-y-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-blue-800">
            <strong>Tip:</strong> Regular database backups are recommended to prevent data loss.
            CSV exports are useful for analyzing data in spreadsheet applications.
          </p>
        </div>

        {/* Database Import Section */}
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex-shrink-0 rounded-full bg-purple-100 p-4">
              <Upload className="h-8 w-8 text-purple-600" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-bold text-gray-900">Restore Database from Backup</h3>
              <p className="mt-1 text-sm text-gray-600">
                Upload a previously exported JSON backup file to restore all data.
                This will <strong className="text-red-600">replace all current data</strong> with the contents of the backup.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  <Upload size={18} />
                  {importing ? 'Importing...' : 'Select Backup File'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {importing && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-purple-50 p-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
              <span className="text-sm font-medium text-purple-800">Importing data... This may take a moment.</span>
            </div>
          )}

          {importResult && (
            <div
              className={`mt-4 rounded-lg p-4 ${
                importResult.success
                  ? 'border border-green-200 bg-green-50'
                  : 'border border-red-200 bg-red-50'
              }`}
            >
              <p
                className={`font-medium ${
                  importResult.success ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {importResult.success ? 'Import successful' : 'Import failed'}
              </p>
              <p className={`mt-1 text-sm ${importResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {importResult.message}
              </p>
              {importResult.stats && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-green-800">Rows imported per table:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-green-700 sm:grid-cols-3 lg:grid-cols-4">
                    {Object.entries(importResult.stats).map(([table, count]) => (
                      <div key={table}>
                        <span className="font-medium">{table}:</span> {count}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {exportOptions.map((option) => (
            <div key={option.type} className="rounded-lg bg-white shadow transition-shadow hover:shadow-lg">
              <div className="p-6">
                <div className="mb-4 text-4xl">{option.icon}</div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">{option.title}</h3>
                <p className="mb-4 text-sm text-gray-600">{option.description}</p>
                <button
                  onClick={() => handleExport(option.type)}
                  disabled={exporting === option.type}
                  className={`flex w-full items-center justify-center space-x-2 ${option.color} rounded-lg px-4 py-3 text-white transition-colors disabled:opacity-60`}
                >
                  {exporting === option.type ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      <span>Export</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Export Information</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <span className="font-bold text-purple-600">•</span>
              <p>
                <strong className="text-gray-900">Database Backup:</strong> Downloads the complete
                database as a JSON file. Can be restored using the import feature above.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="font-bold text-blue-600">•</span>
              <p>
                <strong className="text-gray-900">Sales Report:</strong> CSV file with all sales
                transactions, including customer names, items sold, payment details, and debt
                information.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="font-bold text-green-600">•</span>
              <p>
                <strong className="text-gray-900">Profit & Loss:</strong> Financial summary showing
                total revenue, expenses, and profit calculations.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="font-bold text-orange-600">•</span>
              <p>
                <strong className="text-gray-900">Debt Report:</strong> List of all customers with
                outstanding debts and amounts owed.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="font-bold text-indigo-600">•</span>
              <p>
                <strong className="text-gray-900">Investment Report:</strong> All capital investments
                including stock purchases and manual investment entries.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirmImport && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Confirm Database Restore</h2>
            </div>
            <p className="mb-2 text-sm text-gray-700">
              You are about to import: <strong className="text-gray-900">{pendingFile.name}</strong>
            </p>
            <div className="mb-4 rounded-lg bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">
                This will DELETE all existing data and replace it with the backup contents.
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmImport(false);
                  setPendingFile(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={executeImport}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
