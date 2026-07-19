// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Store, MapPin, Phone, Receipt, Percent, Save, 
  Shield, Lock, Mail, Users, CreditCard, ChevronRight, KeyRound
} from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  
  // Store Settings State
  const [settings, setSettings] = useState({
    storeName: 'My Store',
    storeEmail: 'admin@mystore.com',
    storePhone: '+1 234 567 8900',
    storeAddress: '123 Main Street, City, Country',
    currency: '$',
    taxRate: '0',
    receiptMessage: 'Thank you for your purchase! Please come again.'
  });

  // Security State
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });

  // Load settings from local storage
  useEffect(() => {
    const savedSettings = localStorage.getItem('pos_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = () => {
    setIsLoading(true);
    // Simulate network delay for premium feel
    setTimeout(() => {
      localStorage.setItem('pos_settings', JSON.stringify(settings));
      toast.success('Settings saved successfully!');
      setIsLoading(false);
    }, 500);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new.length < 6) return toast.error("Password must be at least 6 characters");
    if (passwords.new !== passwords.confirm) return toast.error("Passwords do not match");

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });
      
      if (error) throw error;
      toast.success("Password updated successfully!");
      setPasswords({ new: '', confirm: '' });
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Store, desc: 'Basic store details' },
    { id: 'finance', label: 'Payment & Tax', icon: CreditCard, desc: 'Currency and taxation' },
    { id: 'receipt', label: 'Receipts', icon: Receipt, desc: 'Customise paper receipts' },
    { id: 'security', label: 'Access & Security', icon: Shield, desc: 'Passwords and staff' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-32">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your business preferences and system configurations</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-72 flex-shrink-0">
          <nav className="flex flex-col gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center text-left gap-4 p-4 rounded-2xl transition-all ${
                    isActive 
                      ? 'bg-brand-600 text-white shadow-md' 
                      : 'bg-white text-gray-600 hover:bg-brand-50 hover:text-brand-700 border border-transparent shadow-sm'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">{tab.label}</div>
                    <div className={`text-xs mt-0.5 ${isActive ? 'text-brand-100' : 'text-gray-400'}`}>
                      {tab.desc}
                    </div>
                  </div>
                  <ChevronRight size={18} className={isActive ? 'opacity-100' : 'opacity-0'} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900">Store Profile</h2>
                  <p className="text-sm text-gray-500 mt-1">These details appear on your receipts and reports.</p>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Store Name</label>
                      <div className="relative">
                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input name="storeName" value={settings.storeName} onChange={handleChange} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Support Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input name="storeEmail" type="email" value={settings.storeEmail} onChange={handleChange} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50" />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
                      <div className="relative max-w-md">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input name="storePhone" value={settings.storePhone} onChange={handleChange} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50" />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Business Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                        <textarea name="storeAddress" value={settings.storeAddress} onChange={handleChange} rows={3} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50 resize-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FINANCE TAB */}
            {activeTab === 'finance' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900">Payment & Tax</h2>
                  <p className="text-sm text-gray-500 mt-1">Configure how money is calculated in your POS.</p>
                </div>
                <div className="p-6 space-y-6">
                  <div className="max-w-md space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Currency Symbol</label>
                      <select name="currency" value={settings.currency} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50">
                        <option value="$">USD ($)</option>
                        <option value="€">EUR (€)</option>
                        <option value="£">GBP (£)</option>
                        <option value="Rs">LKR / INR (Rs)</option>
                        <option value="₹">INR (₹)</option>
                        <option value="¥">JPY (¥)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Default Tax Rate (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input name="taxRate" type="number" min="0" step="0.1" value={settings.taxRate} onChange={handleChange} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50" />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">This percentage is automatically added to the checkout total.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RECEIPT TAB */}
            {activeTab === 'receipt' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900">Receipt Customization</h2>
                  <p className="text-sm text-gray-500 mt-1">Design the paper receipts handed to your customers.</p>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Footer Message</label>
                    <textarea name="receiptMessage" value={settings.receiptMessage} onChange={handleChange} rows={4} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-gray-50 resize-none" placeholder="Thank you for shopping with us! Return within 30 days for a full refund." />
                    <p className="text-xs text-gray-500 mt-2">This text will print at the very bottom of every receipt.</p>
                  </div>
                  
                  {/* Preview Box */}
                  <div className="mt-8 bg-gray-50 p-6 rounded-xl border border-gray-200 flex flex-col items-center">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Receipt Preview</h3>
                    <div className="bg-white p-6 shadow-sm border border-gray-200 w-64 text-center font-mono text-sm">
                      <div className="font-bold text-lg">{settings.storeName || 'Store Name'}</div>
                      <div className="text-xs mt-1 text-gray-600">{settings.storeAddress || 'Address'}</div>
                      <div className="text-xs text-gray-600">{settings.storePhone || 'Phone'}</div>
                      <div className="border-t border-dashed border-gray-300 my-4"></div>
                      <div className="text-left text-xs space-y-2">
                        <div className="flex justify-between"><span>1x Item A</span><span>{settings.currency}10.00</span></div>
                        <div className="flex justify-between"><span>2x Item B</span><span>{settings.currency}20.00</span></div>
                      </div>
                      <div className="border-t border-dashed border-gray-300 my-4"></div>
                      <div className="text-xs mt-4 text-gray-600 break-words">{settings.receiptMessage || 'Footer message'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                  <div className="bg-red-50 text-red-600 p-2 rounded-lg">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Access & Security</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage your account credentials and staff access.</p>
                  </div>
                </div>
                
                <div className="p-6 space-y-8">
                  {/* Update Password */}
                  <form onSubmit={handleUpdatePassword} className="max-w-md bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <KeyRound size={18} className="text-gray-400"/> Change Admin Password
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">New Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input type="password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="••••••••" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Confirm Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input type="password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="••••••••" />
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className="w-full bg-gray-900 hover:bg-black text-white py-2 rounded-lg font-bold text-sm transition-colors">
                        Update Password
                      </button>
                    </div>
                  </form>

                  {/* Staff Management (Placeholder) */}
                  <div className="max-w-md border border-gray-200 p-6 rounded-2xl bg-gray-50">
                    <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Users size={18} className="text-gray-400"/> Staff Accounts
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">You are currently logged in as the master administrator.</p>
                    <button disabled className="w-full bg-white border border-gray-300 text-gray-400 py-2 rounded-lg font-bold text-sm cursor-not-allowed">
                      Add Cashier (Pro Feature)
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* Global Save Button (Hidden on Security Tab) */}
            {activeTab !== 'security' && (
              <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={handleSaveSettings} 
                  disabled={isLoading}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save size={20} /> 
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}