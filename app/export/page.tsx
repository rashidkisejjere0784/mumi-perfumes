'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Download } from 'lucide-react';

export default function ExportPage() {
  const handleExport = async (type: string) => {
    try {
      const response = await fetch(`/api/export?type=${type}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `export_${type}_${Date.now()}.csv`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Failed to export data');
    }
  };

  const exportOptions = [
    {
      title: 'Database Backup',
      description: 'Download complete database file for backup',
      type: 'database',
      color: 'bg-purple-600 hover:bg-purple-700',
      icon: '💾'
    },
    {
      title: 'Sales Report',
      description: 'Export all sales data with customer and item details',
      type: 'sales',
      color: 'bg-blue-600 hover:bg-blue-700',
      icon: '🛍️'
    },
    {
      title: 'Profit & Loss Report',
      description: 'Export comprehensive profit and loss statement',
      type: 'profit-loss',
      color: 'bg-green-600 hover:bg-green-700',
      icon: '📊'
    },
    {
      title: 'Debt Report',
      description: 'Export list of outstanding customer debts',
      type: 'debt',
      color: 'bg-orange-600 hover:bg-orange-700',
      icon: '💳'
    },
    {
      title: 'Investment Report',
      description: 'Export all investment and stock purchase records',
      type: 'investment',
      color: 'bg-indigo-600 hover:bg-indigo-700',
      icon: '💰'
    }
  ];

  return (
    <DashboardLayout title="Export & Backup">
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            <strong>Tip:</strong> Regular database backups are recommended to prevent data loss. 
            CSV exports are useful for analyzing data in spreadsheet applications.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exportOptions.map((option) => (
            <div key={option.type} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="text-4xl mb-4">{option.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{option.title}</h3>
                <p className="text-gray-600 mb-4 text-sm">{option.description}</p>
                <button
                  onClick={() => handleExport(option.type)}
                  className={`w-full flex items-center justify-center space-x-2 ${option.color} text-white px-4 py-3 rounded-lg transition-colors`}
                >
                  <Download size={20} />
                  <span>Export</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Export Information</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <span className="text-purple-600 font-bold">•</span>
              <p><strong className="text-gray-900">Database Backup:</strong> Downloads the complete SQLite database file. Store this safely and regularly.</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 font-bold">•</span>
              <p><strong className="text-gray-900">Sales Report:</strong> CSV file with all sales transactions, including customer names, items sold, payment details, and debt information.</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-600 font-bold">•</span>
              <p><strong className="text-gray-900">Profit & Loss:</strong> Financial summary showing total revenue, expenses, and profit calculations.</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-orange-600 font-bold">•</span>
              <p><strong className="text-gray-900">Debt Report:</strong> List of all customers with outstanding debts and amounts owed.</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-indigo-600 font-bold">•</span>
              <p><strong className="text-gray-900">Investment Report:</strong> All capital investments including stock purchases and manual investment entries.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
