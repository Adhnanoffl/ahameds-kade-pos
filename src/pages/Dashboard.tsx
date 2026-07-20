// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle, Loader2, ArrowRight,
  User, CreditCard, CalendarDays, Receipt, ShieldCheck, LogOut, Moon, Sun,
  RefreshCw, Download, Search, Users, Sparkles, WifiOff, Lock, X, Bell,
  ShoppingCart, Settings,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';

/**
 * ─── SCHEMA ASSUMPTIONS ────────────────────────────────────────────────────
 * `sales`, `products`, `customers` keep the exact shape your original
 * Dashboard.tsx already relied on — nothing about those queries changed,
 * so if the old dashboard worked, this one will too.
 *
 * Two additions, both wrapped defensively so a missing table never breaks
 * the page:
 *
 *   profiles  (id uuid → auth.users.id, full_name text, role text,
 *              avatar_url text, email text)
 *     Powers the "Welcome back" header and the admin/manager gate below.
 *     If the table or the row is missing, the dashboard still loads —
 *     with an "Unverified" badge — instead of locking everyone out.
 *     IMPORTANT: this client-side role check is a UX nicety, not real
 *     security. Enforce actual access with Supabase Row Level Security
 *     policies on your tables.
 *
 *   sale_items (sale_id, product_id, quantity, price, ...)
 *     Powers the "Top Sellers" card. If you don't track line items yet,
 *     that card just doesn't render — everything else works normally.
 *
 * Rename anything below to match your real column names.
 */

const STORE_NAME = 'Your Supermarket'; // TODO: swap in your store's name
const ALLOWED_ROLES = ['admin', 'manager'];
const LOW_STOCK_THRESHOLD = 20;
const CRITICAL_STOCK_THRESHOLD = 5;
const EXPIRY_WARNING_DAYS = 15;
const RANGE_LABELS = { today: 'Today', '7d': 'Last 7 Days', '30d': 'Last 30 Days' };
const PAYMENT_COLORS = { cash: '#10b981', card: '#3b82f6', credit: '#f43f5e', other: '#a855f7' };

// ─── Pure helpers ────────────────────────────────────────────────────────

function formatMoney(n) {
  const value = Number(n) || 0;
  return `LKR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function getGreeting(date) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function calcTrend(current, previous) {
  if (!previous) return { pct: current > 0 ? 100 : 0, up: true };
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct), up: pct >= 0 };
}

function getRangeBounds(range) {
  const end = new Date();
  let start;
  if (range === 'today') {
    start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  } else if (range === '7d') {
    start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(end);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  const span = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - span - 1);
  return { start, end, prevStart };
}

function buildChartData(sales, range, start, end) {
  if (range === 'today') {
    const now = new Date();
    const map = {};
    for (let h = 0; h <= now.getHours(); h++) {
      const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      map[h] = { name: label, revenue: 0, orders: 0 };
    }
    sales.forEach((s) => {
      const h = new Date(s.created_at).getHours();
      if (map[h]) {
        map[h].revenue += Number(s.total) || 0;
        map[h].orders += 1;
      }
    });
    return Object.values(map);
  }

  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  const map = {};
  days.forEach((d) => {
    const label = new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    map[d] = { name: label, revenue: 0, orders: 0 };
  });
  sales.forEach((s) => {
    const key = String(s.created_at).split('T')[0];
    if (map[key]) {
      map[key].revenue += Number(s.total) || 0;
      map[key].orders += 1;
    }
  });
  return Object.values(map);
}

function buildPaymentBreakdown(sales) {
  const map = {};
  sales.forEach((s) => {
    const key = (s.payment_method || 'other').toLowerCase();
    map[key] = (map[key] || 0) + (Number(s.total) || 0);
  });
  return Object.entries(map)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value,
      color: PAYMENT_COLORS[key] || '#64748b',
    }));
}

function toCSV(rows) {
  if (rows.length === 0) return '';
  const header = Object.keys(rows[0]);
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [header.join(','), ...rows.map((r) => header.map((h) => escape(r[h])).join(','))];
  return lines.join('\n');
}

// ─── Small presentational pieces ─────────────────────────────────────────

function RoleBadge({ role }) {
  if (!role) return null;
  const styles = {
    admin: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
    manager: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    unverified: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };
  const label = role === 'unverified' ? 'Unverified' : role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${styles[role] || styles.unverified}`}>
      <ShieldCheck size={12} /> {label}
    </span>
  );
}

function TrendBadge({ trend }) {
  if (!trend) return null;
  const Icon = trend.up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
        trend.up
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
      }`}
    >
      <Icon size={12} /> {trend.pct.toFixed(1)}%
    </span>
  );
}

function KPICard({ icon: Icon, iconBg, label, value, trend, badge }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon size={22} />
        </div>
        {trend ? <TrendBadge trend={trend} /> : badge}
      </div>
      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 truncate">{value}</h3>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600 text-center">
      <Icon size={30} className="mb-2 opacity-50" />
      <p className="font-bold text-sm">{title}</p>
      {subtitle && <p className="text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, accent }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl font-bold text-sm transition-colors ${
        accent || 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      <Icon size={20} />
      {label}
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [dateRange, setDateRange] = useState('today');
  const [isLive, setIsLive] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);

  const [stats, setStats] = useState({
    totalRevenue: 0,
    prevRevenue: 0,
    totalOrders: 0,
    prevOrders: 0,
    averageOrderValue: 0,
    creditOutstanding: 0,
    activeProducts: 0,
    totalCustomers: 0,
  });

  const [chartData, setChartData] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [topProductsAvailable, setTopProductsAvailable] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const [txSearch, setTxSearch] = useState('');
  const [txFilter, setTxFilter] = useState('all');

  const dateRangeRef = useRef(dateRange);
  useEffect(() => {
    dateRangeRef.current = dateRange;
  }, [dateRange]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pushNotification = useCallback((message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifications((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  }, []);

  // Who's logged in, and are they allowed here
  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData?.user;
      if (authError || !user) {
        setAccessDenied(true);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, role, avatar_url, email')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.warn(
          'Could not verify staff role — allowing access with an "Unverified" badge. ' +
          'Create a `profiles` table (id, full_name, role) to enforce this properly.',
          profileError?.message
        );
        setCurrentUser({ name: user.email?.split('@')[0] || 'Staff', role: 'unverified', email: user.email });
        return;
      }

      const role = (profile.role || 'unverified').toLowerCase();
      setCurrentUser({
        name: profile.full_name || user.email,
        role,
        email: profile.email || user.email,
        avatarUrl: profile.avatar_url,
      });

      if (!ALLOWED_ROLES.includes(role)) {
        setAccessDenied(true);
      }
    } catch (err) {
      console.warn('Auth check failed:', err);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  // Main data fetch — every section is independently guarded so one
  // missing/renamed table degrades gracefully instead of blanking the page.
  const fetchDashboardData = useCallback(async (range, opts = {}) => {
    const { silent = false } = opts;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { start, end, prevStart } = getRangeBounds(range);

      const [salesRes, productsRes, customersRes, topItemsRes] = await Promise.allSettled([
        supabase
          .from('sales')
          .select(`id, created_at, total, payment_method, status, customer_id, customers (full_name)`)
          .gte('created_at', prevStart.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: false }),
        supabase.from('products').select('id, name, stock, expiry_date'),
        supabase.from('customers').select('id, credit_balance'),
        supabase
          .from('sale_items')
          .select('quantity, price, product_id, products (name), sales (created_at, status)')
          .limit(1000),
      ]);

      if (salesRes.status === 'rejected' || salesRes.value.error) {
        throw salesRes.value?.error || salesRes.reason;
      }
      const allSales = salesRes.value.data || [];

      if (productsRes.status === 'rejected' || productsRes.value.error) {
        throw productsRes.value?.error || productsRes.reason;
      }
      const products = productsRes.value.data || [];

      const customers =
        customersRes.status === 'fulfilled' && !customersRes.value.error ? customersRes.value.data || [] : [];

      // Split into current vs. previous (comparison) period
      const completed = allSales.filter((s) => s.status === 'completed');
      const current = completed.filter((s) => new Date(s.created_at) >= start);
      const previous = completed.filter((s) => new Date(s.created_at) < start);

      const totalRevenue = current.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      const prevRevenue = previous.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      const totalOrders = current.length;
      const prevOrders = previous.length;
      const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
      const creditOutstanding = customers.reduce((sum, c) => sum + (Number(c.credit_balance) || 0), 0);

      setStats({
        totalRevenue,
        prevRevenue,
        totalOrders,
        prevOrders,
        averageOrderValue,
        creditOutstanding,
        activeProducts: products.length,
        totalCustomers: customers.length,
      });

      // Stock + expiry alerts
      const alerts = [];
      products.forEach((p) => {
        if (typeof p.stock === 'number' && p.stock <= LOW_STOCK_THRESHOLD) {
          alerts.push({
            id: `stock-${p.id}`,
            name: p.name,
            type: 'stock',
            value: p.stock,
            severity: p.stock < CRITICAL_STOCK_THRESHOLD ? 'critical' : 'warning',
          });
        }
        if (p.expiry_date) {
          const daysLeft = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
          if (daysLeft <= EXPIRY_WARNING_DAYS) {
            alerts.push({
              id: `exp-${p.id}`,
              name: p.name,
              type: 'expiry',
              value: daysLeft,
              severity: daysLeft < 0 ? 'critical' : 'warning',
            });
          }
        }
      });
      alerts.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
      setActionItems(alerts);

      setTransactions(current.slice(0, 25));
      setChartData(buildChartData(current, range, start, end));
      setPaymentBreakdown(buildPaymentBreakdown(current));

      // Top sellers — optional, needs a `sale_items` table
      if (topItemsRes.status === 'fulfilled' && !topItemsRes.value.error) {
        const items = topItemsRes.value.data || [];
        const relevant = items.filter((it) => {
          const s = it.sales;
          if (!s || s.status !== 'completed' || !s.created_at) return false;
          const d = new Date(s.created_at);
          return d >= start && d <= end;
        });
        const map = {};
        relevant.forEach((it) => {
          const key = it.product_id;
          if (!map[key]) map[key] = { name: it.products?.name || 'Unknown item', qty: 0, revenue: 0 };
          map[key].qty += Number(it.quantity) || 0;
          map[key].revenue += (Number(it.quantity) || 0) * (Number(it.price) || 0);
        });
        const top = Object.values(map)
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5);
        setTopProducts(top);
        setTopProductsAvailable(true);
      } else {
        setTopProductsAvailable(false);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
      setError(err?.message || 'Could not load dashboard data. Check your Supabase connection and table names.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    fetchDashboardData(dateRange);
  }, [dateRange, fetchDashboardData]);

  // Realtime: new sales push a toast and silently refresh the numbers
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-live-sales')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, (payload) => {
        pushNotification(`New sale recorded — ${formatMoney(payload.new?.total)}`);
        fetchDashboardData(dateRangeRef.current, { silent: true });
      })
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData, pushNotification]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const revenueTrend = useMemo(() => calcTrend(stats.totalRevenue, stats.prevRevenue), [stats]);
  const ordersTrend = useMemo(() => calcTrend(stats.totalOrders, stats.prevOrders), [stats]);
  const lowStockCount = useMemo(() => actionItems.filter((a) => a.type === 'stock').length, [actionItems]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txFilter !== 'all' && tx.payment_method !== txFilter) return false;
      if (txSearch) {
        const name = tx.payment_method === 'credit' ? tx.customers?.full_name || 'Unknown' : 'Walk-in';
        if (!name.toLowerCase().includes(txSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [transactions, txFilter, txSearch]);

  const exportTransactionsCSV = () => {
    const rows = filteredTransactions.map((tx) => ({
      Date: new Date(tx.created_at).toLocaleString(),
      Method: tx.payment_method,
      Customer: tx.payment_method === 'credit' ? tx.customers?.full_name || 'Unknown' : 'Walk-in',
      Amount: tx.total,
    }));
    const csv = toCSV(rows);
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !authChecked) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 space-y-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="font-bold text-lg text-slate-600 dark:text-slate-300">Compiling store metrics…</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <div className="h-16 w-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <Lock size={28} />
        </div>
        <h1 className="text-xl font-black text-slate-900">Restricted Area</h1>
        <p className="text-slate-500 font-medium mt-2 max-w-sm">
          The dashboard is limited to store admins and managers. Sign in with an authorized account, or ask an admin
          to grant you access.
        </p>
        <Link to="/pos" className="mt-6 px-5 py-3 bg-slate-900 text-white rounded-2xl font-bold">
          Back to POS
        </Link>
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 lg:p-8 pb-24 lg:pb-8 font-sans transition-colors">
        {/* Toasts */}
        {notifications.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2 w-72">
            {notifications.map((n) => (
              <div key={n.id} className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-start gap-2">
                <Bell size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-sm font-bold flex-1">{n.message}</p>
                <button
                  onClick={() => setNotifications((prev) => prev.filter((x) => x.id !== n.id))}
                  className="text-slate-400 hover:text-white"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-16 w-16 shrink-0 bg-slate-900 dark:bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20 overflow-hidden">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User size={32} />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  {getGreeting(currentTime)}, {currentUser?.name || 'there'}
                </h1>
                <RoleBadge role={currentUser?.role} />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2 text-sm">
                {isLive ? (
                  <span className="flex items-center gap-1.5 text-emerald-500">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Live · {STORE_NAME}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <WifiOff size={14} /> Reconnecting…
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="text-right hidden sm:block">
              <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-slate-500 dark:text-slate-400 font-bold text-xs flex items-center justify-end gap-1 mt-1">
                <CalendarDays size={12} />
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <button
              onClick={() => setDarkMode((d) => !d)}
              className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={handleSignOut}
              className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-2xl text-sm font-bold">
            {error}
          </div>
        )}

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl w-fit">
            {Object.keys(RANGE_LABELS).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  dateRange === r
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
            {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            <button
              onClick={() => fetchDashboardData(dateRange)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* KPI GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <KPICard
            icon={DollarSign}
            iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
            label="Gross Revenue"
            value={formatMoney(stats.totalRevenue)}
            trend={revenueTrend}
          />
          <KPICard
            icon={ShoppingCart}
            iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            label="Orders"
            value={stats.totalOrders}
            trend={ordersTrend}
          />
          <KPICard
            icon={Receipt}
            iconBg="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
            label="Avg Order Value"
            value={formatMoney(stats.averageOrderValue)}
          />
          <KPICard
            icon={CreditCard}
            iconBg="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
            label="Outstanding Khata"
            value={formatMoney(stats.creditOutstanding)}
          />
          <KPICard
            icon={Package}
            iconBg="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
            label="Active SKUs"
            value={stats.activeProducts}
            badge={
              lowStockCount > 0 && (
                <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold px-2.5 py-1 rounded-full">
                  {lowStockCount} low
                </span>
              )
            }
          />
          <KPICard
            icon={Users}
            iconBg="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
            label="Customers"
            value={stats.totalCustomers}
          />
        </div>

        {/* CHARTS ROW */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-6">
              Revenue Velocity · {RANGE_LABELS[dateRange]}
            </h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                    dy={10}
                    interval={dateRange === '30d' ? 4 : 0}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(v) => `${v / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [formatMoney(value), 'Revenue']}
                    labelStyle={{ fontWeight: 900, color: '#0f172a' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Payment Mix</h2>
            {paymentBreakdown.length === 0 ? (
              <EmptyState icon={CreditCard} title="No payments yet" subtitle="This fills in as sales come through." />
            ) : (
              <>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={3}>
                        {paymentBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatMoney(value)}
                        contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {paymentBreakdown.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-bold text-slate-600 dark:text-slate-300">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                      <span className="font-black text-slate-900 dark:text-white">{formatMoney(p.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {topProductsAvailable && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-500" /> Top Sellers
                  </h2>
                  <span className="text-xs font-bold text-slate-400 uppercase">{RANGE_LABELS[dateRange]}</span>
                </div>
                {topProducts.length === 0 ? (
                  <EmptyState icon={Package} title="No sales in this period yet" />
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((p, i) => {
                      const max = topProducts[0].qty || 1;
                      return (
                        <div key={`${p.name}-${i}`} className="flex items-center gap-3">
                          <span className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-500 dark:text-slate-400 shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-sm mb-1 gap-2">
                              <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                              <span className="font-black text-slate-900 dark:text-white shrink-0">{p.qty} sold</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(p.qty / max) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Live Transaction Ledger</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder="Search customer…"
                      className="pl-8 pr-3 py-2 text-sm font-medium bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40"
                    />
                  </div>
                  <select
                    value={txFilter}
                    onChange={(e) => setTxFilter(e.target.value)}
                    className="text-sm font-bold bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All methods</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit</option>
                  </select>
                  <button
                    onClick={exportTransactionsCSV}
                    disabled={filteredTransactions.length === 0}
                    className="flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download size={14} /> Export
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 dark:bg-slate-800/50">
                    <tr>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Time</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Method</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Customer</th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-xs font-bold text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                              tx.payment_method === 'cash'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : tx.payment_method === 'credit'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                            }`}
                          >
                            {tx.payment_method}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                          {tx.payment_method === 'credit' ? tx.customers?.full_name || 'Unknown' : 'Walk-in'}
                        </td>
                        <td className="p-4 font-black text-slate-900 dark:text-white text-right">{formatMoney(tx.total)}</td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <EmptyState icon={Search} title="No matching transactions" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="xl:col-span-1 space-y-6">
            <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl border border-slate-800 shadow-xl p-6 text-white">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black flex items-center gap-2">
                  <AlertTriangle className="text-rose-400" size={20} /> Action Center
                </h2>
                {actionItems.length > 0 && (
                  <span className="text-xs font-bold bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-full">{actionItems.length}</span>
                )}
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {actionItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-center bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
                    <Package size={28} className="mb-2 opacity-50" />
                    <p className="font-bold text-sm">Operations Normal</p>
                  </div>
                ) : (
                  actionItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700 gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 truncate">{item.name}</div>
                        <div className={`text-xs font-bold mt-1 ${item.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}`}>
                          {item.type === 'stock'
                            ? `Only ${item.value} units left`
                            : item.value < 0
                            ? 'Expired'
                            : `Expires in ${item.value} days`}
                        </div>
                      </div>
                      <Link
                        to="/inventory"
                        className="p-2 bg-slate-700 rounded-xl text-slate-300 hover:text-white hover:bg-slate-600 transition-colors shrink-0"
                      >
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction to="/pos" icon={Receipt} label="Open POS" accent="bg-indigo-600 text-white hover:bg-indigo-700" />
                <QuickAction to="/inventory" icon={Package} label="Inventory" />
                <QuickAction to="/customers" icon={Users} label="Customers" />
                <QuickAction to="/settings" icon={Settings} label="Settings" />
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs font-bold text-slate-300 dark:text-slate-700 mt-8">
          {STORE_NAME} — role-gated with Supabase; pair the client check above with Row Level Security policies for real enforcement.
        </p>
      </div>
    </div>
  );
}
