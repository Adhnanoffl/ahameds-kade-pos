// @ts-nocheck
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Package, 
  Users, Settings, Store, LogOut, User, Menu, X 
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// 1. Strict Type Definitions
interface UserProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'manager' | 'cashier';
  pin_code?: string;
  avatar_url?: string;
}

interface SidebarProps {
  userProfile: UserProfile | null;
}

interface NavItem {
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  path: string;
  allowedRoles: ('admin' | 'manager' | 'cashier')[];
}

// 2. Navigation Matrix with Permission Rules
const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', allowedRoles: ['admin', 'manager'] },
  { icon: ShoppingCart, label: 'POS Terminal', path: '/pos', allowedRoles: ['admin', 'manager', 'cashier'] },
  { icon: Package, label: 'Inventory', path: '/inventory', allowedRoles: ['admin', 'manager'] },
  { icon: Users, label: 'Customers', path: '/customers', allowedRoles: ['admin', 'manager', 'cashier'] },
  { icon: Settings, label: 'System Settings', path: '/settings', allowedRoles: ['admin'] },
];

export default function Sidebar({ userProfile }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Safe fallback to 'cashier' role permissions if the profile isn't loaded yet
  const currentRole = userProfile?.role || 'cashier';

  // Filter the navigation dynamically based on active user privileges
  const visibleNavItems = navItems.filter((item) => item.allowedRoles.includes(currentRole));

  // Helper styling function to generate role-based badge designs
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      case 'manager': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      default: return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    }
  };

  return (
    <>
      {/* 
        MOBILE TOGGLE BUTTON (Floating Action Button)
        Visible only on small screens. Positioned bottom-left for easy thumb reach.
      */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed bottom-6 left-6 z-40 bg-indigo-600 text-white p-3.5 rounded-2xl shadow-xl shadow-indigo-900/30 border border-indigo-500/50 active:scale-95 transition-all"
      >
        <Menu size={24} />
      </button>

      {/* MOBILE BACKDROP OVERLAY */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 
        SIDEBAR CONTAINER
        Mobile: Fixed off-screen, slides in when `isOpen` is true.
        Desktop (md:): Stays relatively positioned and always visible.
      */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-slate-900 text-slate-100 flex flex-col h-full print:hidden border-r border-slate-800
        transition-transform duration-300 ease-out shadow-2xl md:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        {/* Brand Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-md shadow-indigo-600/20">
              <Store size={22} className="text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight block text-white">Ahamed's Kade</span>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Supermarket Core</span>
            </div>
          </div>
          
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsOpen(false)}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dynamic Navigation Links */}
        <nav className="flex-1 px-4 space-y-1.5 mt-6 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)} // Auto-close drawer on mobile when navigating
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3.5 md:py-3 rounded-xl transition-all duration-150 group ${
                  isActive 
                    ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/10' 
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'} />
                  <span className="text-sm">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer Area: User Session Metadata & Control Panel */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 space-y-3">
          {userProfile && (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-300 shadow-inner overflow-hidden flex-shrink-0">
                {userProfile.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Staff avatar" className="h-full w-full object-cover" />
                ) : (
                  <User size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-200 truncate leading-tight">
                  {userProfile.full_name}
                </p>
                <span className={`inline-block text-[10px] uppercase tracking-widest font-extrabold px-2 py-0.5 rounded-md mt-1 ${getRoleBadgeStyle(userProfile.role)}`}>
                  {userProfile.role}
                </span>
              </div>
            </div>
          )}

          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 font-medium text-sm transition-all duration-150 border border-transparent hover:border-rose-500/20"
          >
            <LogOut size={18} />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>
    </>
  );
}