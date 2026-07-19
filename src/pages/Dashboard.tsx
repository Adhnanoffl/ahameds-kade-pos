// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, DollarSign, Package, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSales: 0,
    activeProducts: 0,
    lowStock: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('created_at, total')
        .eq('status', 'completed');
      
      if (salesError) throw salesError;

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock');

      if (productsError) throw productsError;

      const totalRev = sales?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
      
      // Get low stock items (threshold 20)
      const lowStockProducts = products?.filter(p => p.stock <= 20) || [];
      
      // Sort them to show the most critical (lowest stock) first, take top 5
      const criticalLowStock = [...lowStockProducts].sort((a, b) => a.stock - b.stock).slice(0, 5);

      setStats({
        totalRevenue: totalRev,
        totalSales: sales?.length || 0,
        activeProducts: products?.length || 0,
        lowStock: lowStockProducts.length
      });
      
      setLowStockItems(criticalLowStock);

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

      sales?.forEach(sale => {
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
        <p className="font-bold text-lg text-slate-600">Compiling Store Metrics...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-100 p-4 lg:p-8 pb-24 lg:pb-8 font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Manager Dashboard</h1>
        <p className="text-slate-500 font-medium mt-1">Real-time overview of store performance and inventory health.</p>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-xl shadow-inner">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">LKR {stats.totalRevenue.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="p-4 bg-blue-100 text-blue-600 rounded-xl shadow-inner">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transactions</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.totalSales}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5 relative overflow-hidden group">
           <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-xl shadow-inner">
            <Package size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active SKUs</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.activeProducts}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5 relative overflow-hidden group">
           <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
          <div className="p-4 bg-rose-100 text-rose-600 rounded-xl shadow-inner">
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Alerts</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.lowStock}</h3>
          </div>
        </div>
      </div>

      {/* CHARTS & ACTION CENTER */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Main Charts Column */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp className="text-indigo-500" size={20}/> 7-Day Revenue Trend
            </h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} tickFormatter={(value) => `LKR ${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`LKR ${value.toLocaleString()}`, 'Revenue']}
                    labelStyle={{fontWeight: 'bold', color: '#1e293b'}}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-800 mb-6">Daily Transaction Volume</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [value, 'Orders']}
                    labelStyle={{fontWeight: 'bold', color: '#1e293b'}}
                  />
                  <Bar dataKey="orders" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Action Center Column */}
        <div className="xl:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <AlertTriangle className="text-rose-500" size={20} /> Attention Required
              </h2>
            </div>
            
            <div className="flex-1">
              {lowStockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Package size={48} className="mb-3 opacity-20" />
                  <p className="font-bold text-slate-600">All Stock Healthy</p>
                  <p className="text-sm mt-1">No items fall below the minimum threshold.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Critical Low Stock Items</p>
                  {lowStockItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                      <div>
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-xs font-bold text-rose-500 mt-1">
                          Only {item.stock} left in warehouse
                        </div>
                      </div>
                      <Link to="/inventory" className="p-2 bg-white rounded-lg shadow-sm text-slate-400 hover:text-indigo-600 border border-slate-200 transition-colors">
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  ))}
                  
                  {stats.lowStock > 5 && (
                     <div className="text-center pt-2">
                        <Link to="/inventory" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
                          + {stats.lowStock - 5} more items need attention
                        </Link>
                     </div>
                  )}
                </div>
              )}
            </div>

            <Link to="/inventory" className="mt-6 w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-center transition-colors shadow-lg shadow-slate-900/20">
              Manage Inventory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}