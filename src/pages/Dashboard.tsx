// @ts-nocheck
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, DollarSign, Package, AlertTriangle, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Production dummy analytics data (LKR Currency Context)
const SALES_DATA = [
  { name: 'Mon', sales: 45000, profit: 12000, expenses: 5000 },
  { name: 'Tue', sales: 52000, profit: 15000, expenses: 4500 },
  { name: 'Wed', sales: 49000, profit: 13500, expenses: 6000 },
  { name: 'Thu', sales: 63000, profit: 19000, expenses: 4000 },
  { name: 'Fri', sales: 58000, profit: 16500, expenses: 5500 },
  { name: 'Sat', sales: 85000, profit: 26000, expenses: 8000 },
  { name: 'Sun', sales: 92000, profit: 29000, expenses: 7500 },
];

const TOP_PRODUCTS = [
  { name: 'Samba Rice 1kg', sales: 420, stock: 50, status: 'In Stock' },
  { name: 'Red Onion 500g', sales: 310, stock: 20, status: 'Low Stock' },
  { name: 'Coconut (Large)', sales: 280, stock: 200, status: 'In Stock' },
  { name: 'Highland Milk Powder', sales: 150, stock: 5, status: 'Low Stock' },
];

export default function Dashboard() {
  const metrics = [
    { title: "Today's Sales", value: "Rs. 92,000", change: "+14.2%", positive: true, icon: <DollarSign className="text-emerald-600" /> },
    { title: "Today's Profit", value: "Rs. 29,000", change: "+18.5%", positive: true, icon: <TrendingUp className="text-blue-600" /> },
    { title: "Stock Value", value: "Rs. 1,450,000", change: "420 Items", positive: true, icon: <Package className="text-indigo-600" /> },
    { title: "Customer Loans", value: "Rs. 68,400", change: "12 Accounts", positive: false, icon: <Users className="text-amber-600" /> },
  ];

  const alerts = [
    { title: "Low Stock Alert", count: 8, color: "bg-amber-50 text-amber-700 border-amber-200" },
    { title: "Out of Stock", count: 3, color: "bg-red-50 text-red-700 border-red-200" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-4 lg:p-8 space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Business Overview</h1>
          <p className="text-gray-500">Real-time performance metrics for Ahamed's Kade.</p>
        </div>
        <div className="flex gap-2">
          <span className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm text-gray-700">Currency: LKR</span>
          <span className="bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm">Live Syncing</span>
        </div>
      </div>

      {/* Stock Alerts Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {alerts.map((alert, idx) => (
          <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${alert.color}`}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} />
              <span className="font-bold">{alert.title}</span>
            </div>
            <span className="text-xl font-black">{alert.count}</span>
          </div>
        ))}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors">{m.icon}</div>
              <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-lg ${m.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {m.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {m.change}
              </span>
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">{m.title}</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{m.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Profit Revenue Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Weekly Sales & Profit Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SALES_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="sales" name="Sales (LKR)" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="profit" name="Profit (LKR)" stroke="#3b82f6" strokeWidth={3} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Performance Board */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Top Selling Items</h3>
            <div className="space-y-4">
              {TOP_PRODUCTS.map((prod, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">{prod.name}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${prod.status === 'In Stock' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {prod.stock} left
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-gray-900">{prod.sales} sold</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}