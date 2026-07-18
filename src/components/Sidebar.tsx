//@ts-nocheck
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Settings, Store, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: ShoppingCart, label: 'POS', path: '/pos' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-full print:hidden">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-brand-500 p-2 rounded-lg">
          <Store size={24} className="text-white" />
        </div>
        <span className="text-xl font-bold">My Store</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive 
                  ? 'bg-brand-600 text-white shadow-md' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}