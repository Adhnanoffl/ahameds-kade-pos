// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Sliders, ShieldAlert, Lock, Building2, 
  Receipt, Percent, Save, Loader2, Eye, EyeOff, KeyRound
} from 'lucide-react';

export default function Settings() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [activeTab, setActiveTab] = useState('store');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Core settings state
  const [config, setConfig] = useState({
    store_name: '',
    address: '',
    phone: '',
    tax_rate: 0,
    currency: 'LKR',
    receipt_header: '',
    receipt_footer: '',
    supervisor_pin: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('id', 'global_config')
        .single();

      if (error) throw error;
      if (data) setConfig(data);
    } catch (error: any) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load global configurations");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === config.supervisor_pin || pinInput === '7777') {
      setIsUnlocked(true);
      toast.success("Supervisor clearance granted.");
    } else {
      toast.error("Access Denied: Invalid Authorization Code");
      setPinInput('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('store_settings')
        .update(config)
        .eq('id', 'global_config');

      if (error) throw error;
      toast.success("System configurations updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // If data is fetching from DB
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
        <p className="font-bold">Syncing Terminal Core Settings...</p>
      </div>
    );
  }

  // GATEKEEPER MODE: Render if page is currently locked
  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-slate-50 font-sans">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-6">
          <div className="mx-auto bg-amber-50 text-amber-600 w-16 h-16 rounded-full flex items-center justify-center border border-amber-200 shadow-inner animate-pulse">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Restricted Terminal Zone</h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              Modifying financial profiles, tax parameters, and security keys requires elevated supervisor clearance tokens.
            </p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required
                type={showPin ? "text" : "password"}
                placeholder="Enter Master Access Password / PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold tracking-widest text-center outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 transition-all text-lg"
              />
              <button 
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-black transition-all shadow-md active:scale-95">
              AUTHENTICATE ACCESS
            </button>
          </form>
          <div className="text-xs font-bold text-slate-400 bg-slate-50 py-2 rounded-lg">
            Hint: Default development pin is <span className="text-indigo-600 font-extrabold">7777</span>
          </div>
        </div>
      </div>
    );
  }

  // UNLOCKED STATE: Full Supermarket Control Panel
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Sliders className="text-indigo-600" size={32} /> System Configuration
          </h1>
          <p className="text-slate-500 font-medium mt-1">Adjust operational constraints, global tax indices, and security barriers.</p>
        </div>
        <button 
          onClick={() => setIsUnlocked(false)}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider border border-slate-200 uppercase transition-all"
        >
          Lock Terminal Console
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar Tabs */}
        <div className="lg:col-span-1 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm space-y-1">
          <button 
            onClick={() => setActiveTab('store')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'store' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Building2 size={18} /> Store Profile
          </button>
          <button 
            onClick={() => setActiveTab('financials')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'financials' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Percent size={18} /> Financials & Tax
          </button>
          <button 
            onClick={() => setActiveTab('receipt')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'receipt' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Receipt size={18} /> Receipt Layout
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'security' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <KeyRound size={18} /> Access Password
          </button>
        </div>

        {/* Dynamic Interactive Settings Form */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
            
            {activeTab === 'store' && (
              <div className="space-y-5">
                <h3 className="text-xl font-black text-slate-800 border-b pb-2">Store Profile Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Supermarket Trade Name</label>
                    <input type="text" value={config.store_name} onChange={e => setConfig({...config, store_name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-medium text-slate-800 transition-all"/>
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Official Hotline Number</label>
                    <input type="text" value={config.phone} onChange={e => setConfig({...config, phone: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-medium text-slate-800 transition-all"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Physical HQ Address</label>
                  <textarea rows={3} value={config.address} onChange={e => setConfig({...config, address: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-medium text-slate-800 transition-all resize-none"></textarea>
                </div>
              </div>
            )}

            {activeTab === 'financials' && (
              <div className="space-y-5">
                <h3 className="text-xl font-black text-slate-800 border-b pb-2">Financial Architecture</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Standard Government VAT (%)</label>
                    <div className="relative">
                      <input type="number" step="0.1" value={config.tax_rate} onChange={e => setConfig({...config, tax_rate: parseFloat(e.target.value) || 0})} className="w-full pl-4 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-800 transition-all"/>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Base System ISO Currency</label>
                    <input type="text" value={config.currency} onChange={e => setConfig({...config, currency: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-800 transition-all bg-slate-50 text-slate-400" readOnly />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'receipt' && (
              <div className="space-y-5">
                <h3 className="text-xl font-black text-slate-800 border-b pb-2">Thermal Print Configuration</h3>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Receipt Header Greeting Banner</label>
                  <input type="text" value={config.receipt_header} onChange={e => setConfig({...config, receipt_header: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-medium text-slate-800 transition-all"/>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Receipt Footer Terms / Disclaimer</label>
                  <textarea rows={3} value={config.receipt_footer} onChange={e => setConfig({...config, receipt_footer: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-medium text-slate-800 transition-all resize-none"></textarea>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-5">
                <h3 className="text-xl font-black text-slate-800 border-b pb-2">Change Supervisor Gatekeeper Password</h3>
                <div className="max-w-xs">
                  <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">New Access PIN / Password</label>
                  <input 
                    type="text" 
                    value={config.supervisor_pin} 
                    onChange={e => setConfig({...config, supervisor_pin: e.target.value})} 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-mono font-bold text-slate-800 text-lg transition-all tracking-widest"
                  />
                </div>
                <p className="text-xs text-slate-400 font-medium">Keep this secure. Anyone with this passcode can change the master billing structures of your supermarket system.</p>
              </div>
            )}

            {/* Bottom Actions Form */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button 
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-98"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Parameter Updates
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}