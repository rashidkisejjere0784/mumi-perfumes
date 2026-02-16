'use client';

import { ReactNode } from 'react';
import Navigation from './Navigation';
import ProtectedRoute from './ProtectedRoute';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="lg:pl-64">
          <main className="p-4 lg:p-8">
            {title && (
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
