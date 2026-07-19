// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Users, Plus, Search, Edit, Trash2, X, 
  User, Phone, Mail, Loader2, Award, Calendar 
} from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (customer = null) => {
    if (customer) {
      setEditingId(customer.id);
      setFormData({ 
        name: customer.full_name || customer.name || '', 
        phone: customer.phone || '', 
        email: customer.email || '' 
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', phone: '', email: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Customer name is required");
    
    setIsSubmitting(true);
    
    const payload = {
      full_name: formData.name, 
      name: formData.name,      
      phone: formData.phone,
      email: formData.email
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success("Customer profile updated!");
      } else {
        const { error } = await supabase.from('customers').insert([payload]);
        if (error) throw error;
        toast.success("New loyalty member added!");
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the database? This action cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      toast.success("Customer removed");
      fetchCustomers();
    } catch (error: any) {
      toast.error("Failed to delete customer");
    }
  };

  const filteredCustomers = customers.filter(c => {
    const displayName = c.full_name || c.name || '';
    return displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (c.phone && c.phone.includes(searchTerm));
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Customer Loyalty</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage shopper profiles and contact information</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus size={20} /> Register Member
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by name or phone number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white shadow-sm transition-all text-slate-800"
            />
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500">
            <Users size={18} className="text-indigo-500" />
            Total Members: {customers.length}
          </div>
        </div>

        {/* Enterprise Data Table */}
        <div className="flex-1 overflow-y-auto bg-white">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 text-slate-400">
               <Loader2 className="animate-spin mb-3 text-indigo-600" size={32} />
               <p className="font-medium">Loading customer database...</p>
             </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-8 text-center">
              <Users size={64} className="mb-4 opacity-20" />
              <h3 className="text-lg font-bold text-slate-800 mb-1">No customers found</h3>
              <p className="text-sm">Click "Register Member" to add a new shopper.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                <tr>
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Member Profile</th>
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Contact Details</th>
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Member ID</th>
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(customer => {
                  const displayName = customer.full_name || customer.name || 'Unknown';
                  const initial = displayName.charAt(0).toUpperCase();
                  // Create a fake member ID based on their DB UUID for visual professionalism
                  const memberId = customer.id ? customer.id.split('-')[0].toUpperCase() : 'N/A';
                  
                  return (
                    <tr key={customer.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-indigo-100 text-indigo-700 w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-inner">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{displayName}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Calendar size={12}/> Registered {new Date(customer.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {customer.phone ? (
                            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <Phone size={14} className="text-slate-400" /> {customer.phone}
                            </span>
                          ) : <span className="text-slate-300 text-sm italic">No phone</span>}
                          {customer.email ? (
                            <span className="flex items-center gap-2 text-sm text-slate-500">
                              <Mail size={14} className="text-slate-400" /> {customer.email}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                          <Award size={14} className="text-amber-500" /> {memberId}
                        </span>
                      </td>
                      <td className="p-4 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(customer)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(customer.id, displayName)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Advanced Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transform transition-all">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-xl text-slate-800">{editingId ? 'Update Member Profile' : 'Register New Member'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-md shadow-sm border border-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5 bg-white">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-800 font-medium transition-all" placeholder="Enter shopper's name" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-800 font-medium transition-all" placeholder="e.g. 077 123 4567" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-800 font-medium transition-all" placeholder="Optional for digital receipts" />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-colors flex items-center justify-center shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}