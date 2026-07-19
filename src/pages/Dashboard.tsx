// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, DollarSign, Package, AlertTriangle, Loader2, ArrowRight, 
  Clock, User, CreditCard, Activity, CalendarDays, Receipt
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSales: 0,
    activeProducts: 0,
    lowStock: 0,
    averageOrderValue: 0,
    creditOutstanding: 0
  });
  
  const [chartData, setChartData] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Sales with Customer Data for Ledger
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select(`
          id, 
          created_at, 
          total, 
          payment_method, 
          status,
          customer_id,
          customers (full_name)
        `)
        .order('created_at', { ascending: false });
      
      if (salesError) throw salesError;

      // 2. Fetch Products for Stock & Expiry Alerts
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock, expiry_date');

      if (productsError) throw productsError;

      // 3. Fetch Customers for Total Outstanding Khata
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('credit_balance');

      if (custError) throw custError;

      // --- Data Processing ---
      const completedSales = sales?.filter(s => s.status === 'completed') || [];
      const totalRev = completedSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
      const avgOrder = completedSales.length > 0 ? (totalRev / completedSales.length) : 0;
      const totalCredit = customers?.reduce((sum, cust) => sum + (Number(cust.credit_balance) || 0), 0) || 0;
      
      // Alerts Processing (Stock < 20 AND Expiring within 15 days)
      const alerts = [];
      products?.forEach(p => {
        if (p.stock <= 20) {
          alerts.push({ id: p.id, name: p.name, type: 'stock', value: p.stock, severity: p.stock < 5 ? 'critical' : 'warning' });
        }
        if (p.expiry_date) {
          const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 15) {
            alerts.push({ id: `${p.id}-exp`, name: p.name, type: 'expiry', value: daysLeft, severity: daysLeft < 0 ? 'critical' : 'warning' });
          }
        }
      });

      setStats({
        totalRevenue: totalRev,
        totalSales: completedSales.length,
        activeProducts: products?.length || 0,
        lowStock: alerts.filter(a => a.type === 'stock').length,
        averageOrderValue: avgOrder,
        creditOutstanding: totalCredit
      });
      
      setActionItems(alerts.sort((a, b) => (a.severity === 'critical' ? -1 : 1)).slice(0, 6));
      setRecentTransactions(completedSales.slice(0, 5)); // Latest 5 sales

      // --- Chart Processing (Last 7 Days) ---
      const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0]; 
      });

      const chartMap = {};
      last7Days.forEach(date => {
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        chartMap[date] = { name: dayName, revenue: 0, orders: 0 };
      });

      completedSales.forEach(sale => {
        const saleDate = sale.created_at.split('T')[0];
        if (chartMap[saleDate]) {
          chartMap[saleDate].revenue += sale.total;
          chartMap[saleDate].orders += 1;
        }
      });

      setChartData(Object.values(chartMap));

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 space-y-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="font-bold text-lg text-slate-600">Compiling Enterprise Metrics...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 p-4 lg:p-8 pb-24 lg:pb-8 font-sans">
      
      {/* MANAGER HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
            <User size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Welcome back, Admin</h1>
            <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
              <Activity size={16} className="text-emerald-500" /> Store Systems Online & Syncing
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-slate-500 font-bold text-sm flex items-center justify-end gap-1 mt-1">
            <CalendarDays size={14} /> {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* KPI METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign size={24} />
            </div>
            <span className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2.5 py-1 rounded-full">+12%</span>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Gross Revenue</p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">LKR {stats.totalRevenue.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Receipt size={24} />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Average Order Value</p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">LKR {stats.averageOrderValue.toFixed(0)}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <CreditCard size={24} />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Outstanding Khata</p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">LKR {stats.creditOutstanding.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
           <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <span className="bg-rose-50 text-rose-600 text-xs font-bold px-2.5 py-1 rounded-full">{actionItems.length} Alerts</span>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active SKUs</p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.activeProducts}</h3>
        </div>
      </div>

      {/* CHARTS & DATA GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Main Analytics Column */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Revenue Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-slate-900">7-Day Revenue Velocity</h2>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} tickFormatter={(value) => `LKR ${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`LKR ${value.toLocaleString()}`, 'Revenue']}
                    labelStyle={{fontWeight: '900', color: '#0f172a'}}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0f172a" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Transactions Ledger */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Live Transaction Ledger</h2>
              <Link to="/sales" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">View All <ArrowRight size={16}/></Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Time</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Method</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Customer</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        <div className="text-xs font-bold text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider
                          ${tx.payment_method === 'cash' ? 'bg-emerald-100 text-emerald-700' : 
                            tx.payment_method === 'credit' ? 'bg-rose-100 text-rose-700' : 
                            'bg-blue-100 text-blue-700'}`}>
                          {tx.payment_method}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-700">
                        {tx.payment_method === 'credit' ? tx.customers?.full_name || 'Unknown' : 'Walk-in'}
                      </td>
                      <td className="p-4 font-black text-slate-900 text-right">
                        LKR {tx.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {recentTransactions.length === 0 && (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-bold">No transactions today</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Center Column */}
        <div className="xl:col-span-1">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl p-6 h-full flex flex-col text-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black flex items-center gap-2">
                <AlertTriangle className="text-rose-400" size={20} /> Action Center
              </h2>
            </div>
            
            <div className="flex-1 space-y-3">
              {actionItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
                  <Package size={32} className="mb-2 opacity-50" />
                  <p className="font-bold">Operations Normal</p>
                </div>
              ) : (
                actionItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700">
                    <div>
                      <div className="font-bold text-slate-100 line-clamp-1">{item.name}</div>
                      <div className={`text-xs font-bold mt-1 ${item.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}`}>
                        {item.type === 'stock' ? `Only ${item.value} units left` : `Expires in ${item.value} days`}
                      </div>
                    </div>
                    <Link to="/inventory" className="p-2 bg-slate-700 rounded-xl text-slate-300 hover:text-white hover:bg-slate-600 transition-colors">
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800">
               <Link to="/pos" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-center transition-colors shadow-lg shadow-indigo-600/20 block">
                Open POS Terminal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}