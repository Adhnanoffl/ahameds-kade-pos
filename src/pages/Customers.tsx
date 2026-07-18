import React from 'react';
import { Users, Plus } from 'lucide-react';

export default function Customers() {
  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage your customer database and loyalty points</p>
        </div>
        <button className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors">
          <Plus size={20} /> Add Customer
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col items-center justify-center text-gray-400">
        <Users size={64} className="mb-4 opacity-20" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No customers yet</h3>
        <p className="text-sm">Get started by adding your first customer to the database.</p>
      </div>
    </div>
  );
}