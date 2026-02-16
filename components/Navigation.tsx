'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, ShoppingCart, DollarSign, BarChart3, FileDown, Menu, X, LogOut, User, Users, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from './AuthProvider';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Sales', href: '/sales', icon: ShoppingCart },
  { name: 'Expenses', href: '/expenses', icon: DollarSign },
  { name: 'Profit Tracking', href: '/profit', icon: TrendingUp },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Export', href: '/export', icon: FileDown },
];

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const adminNavigation = user?.role === 'admin' 
    ? [{ name: 'Users', href: '/users', icon: Users }]
    : [];

  const allNavigation = [...navigation, ...adminNavigation];

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md bg-purple-600 text-white"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar for desktop, overlay for mobile */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-purple-700 to-purple-900 text-white
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-8">Mumi Perfumes</h1>
            <nav className="space-y-2">
              {allNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-white text-purple-900 font-semibold' 
                        : 'hover:bg-purple-600'
                      }
                    `}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User info and logout */}
          <div className="mt-auto p-6 border-t border-purple-600">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-600 p-2 rounded-full">
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-xs text-purple-200 truncate">{user?.username}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-800 hover:bg-purple-700 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
