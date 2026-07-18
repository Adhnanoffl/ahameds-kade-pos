// @ts-nocheck
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Store, MapPin, Phone, Receipt, Percent, Save, CheckCircle } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({
    storeName: 'My Store',
    storeAddress: '123 Main Street, City',
    storePhone: '+1 234 567 8900',
    taxRate: '0',
    receiptMessage: 'Thank you for your purchase! Please come again.'
  });

  // Load settings from local storage when page opens
  useEffect(() => {
    const savedSettings = localStorage.getItem('pos_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('pos_settings', JSON.stringify(settings));
    toast.success('Settings saved successfully!');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your store details and receipt preferences</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* General Store Info */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Store size={20} className="text-brand-600" /> Store Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input name="storeName" value={settings.storeName} onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input name="storePhone" value={settings.storePhone} onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                <textarea name="storeAddress" value={settings.storeAddress} onChange={handleChange} rows={2} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50 resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Financial / Tax */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Percent size={20} className="text-brand-600" /> Financial Settings
          </h2>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate (%)</label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="number" name="taxRate" value={settings.taxRate} onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50" />
            </div>
            <p className="text-xs text-gray-500 mt-1">This will be calculated during checkout (coming soon).</p>
          </div>
        </div>

        {/* Receipts */}
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt size={20} className="text-brand-600" /> Receipt Customization
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Footer Message</label>
            <textarea name="receiptMessage" value={settings.receiptMessage} onChange={handleChange} rows={3} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50 resize-none" placeholder="Thank you for shopping with us!" />
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end">
          <button onClick={handleSave} className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors">
            <Save size={20} /> Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}