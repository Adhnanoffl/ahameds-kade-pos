import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Settings } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

export default function Layout() {
  const navItems = [
    { to: '/', icon: <ShoppingCart size={24} />, label: 'POS' },
    { to: '/dashboard', icon: <LayoutDashboard size={24} />, label: 'Dashboard' },
    { to: '/inventory', icon: <Package size={24} />, label: 'Inventory' },
    { to: '/customers', icon: <Users size={24} />, label: 'Customers' },
    { to: '/settings', icon: <Settings size={24} />, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-center" />
      
      {/* Desktop Sidebar (Hidden on mobile) */}
      <aside className="hidden lg:flex w-24 flex-col items-center py-8 bg-gray-900 text-gray-400">
        <div className="w-12 h-12 bg-brand-500 rounded-xl mb-8 flex items-center justify-center text-white font-black text-xl">
          AK
        </div>
        <nav className="flex flex-col gap-6">
          {navItems.map(item => (
            <NavLink 
              key={item.to} 
              to={item.to}
              className={({isActive}) => `p-3 rounded-xl transition-all ${isActive ? 'bg-brand-500 text-white' : 'hover:text-white hover:bg-gray-800'}`}
            >
              {item.icon}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative pb-16 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
        {navItems.map(item => (
          <NavLink 
            key={item.to} 
            to={item.to}
            className={({isActive}) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-brand-600' : 'text-gray-400'}`}
          >
            {item.icon}
            <span className="text-[10px] font-semibold">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}