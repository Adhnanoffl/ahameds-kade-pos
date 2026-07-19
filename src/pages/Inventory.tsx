import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Package, Plus, Search, Edit, Trash2, X, 
  Barcode, DollarSign, Hash, Loader2, AlertTriangle
} from 'lucide-react';

// Strict typing aligned with SQL
interface Product {
  id: string;
  name: string;
  barcode: string | null;
  selling_price: number;
  stock: number;
}

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    selling_price: '', 
    stock: '', 
    barcode: '' 
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setFormData({ 
        name: product.name, 
        selling_price: product.selling_price.toString(), 
        stock: product.stock.toString(),
        barcode: product.barcode || ''
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', selling_price: '', stock: '', barcode: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Product name is required");
    
    setIsSubmitting(true);
    
    // Map UI form to strict DB columns
    const payload = {
      name: formData.name,      
      selling_price: Number(formData.selling_price) || 0,
      stock: parseInt(formData.stock) || 0,
      barcode: formData.barcode || null
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success("Product updated successfully");
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        toast.success("Product added successfully");
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success("Product deleted");
      fetchProducts();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Inventory Management</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage your products, pricing, and live stock levels</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus size={20} /> Add Product
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by name or scan barcode..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white shadow-sm transition-all text-slate-800"
            />
          </div>
        </div>

        {/* Inventory Table */}
        <div className="flex-1 overflow-y-auto bg-white">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 text-slate-400">
               <Loader2 className="animate-spin mb-3 text-indigo-600" size={32} />
               <p className="font-medium">Loading warehouse data...</p>
             </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-8 text-center">
              <Package size={64} className="mb-4 opacity-20" />
              <h3 className="text-lg font-bold text-slate-800 mb-1">No products found</h3>
              <p className="text-sm">Click "Add Product" to start building your store catalog.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                <tr>
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Product Info</th>
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Barcode / SKU</th>
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Price (LKR)</th>
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Stock Status</th>
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 font-bold text-slate-900">{product.name}</td>
                    <td className="p-4">
                      {product.barcode ? (
                        <div className="flex items-center gap-2 w-max px-2.5 py-1 rounded border border-slate-200 bg-slate-50 text-slate-600 font-mono text-xs font-bold">
                          <Barcode size={14} className="text-slate-400"/> {product.barcode}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-sm">No barcode</span>
                      )}
                    </td>
                    <td className="p-4 font-black text-indigo-600">LKR {product.selling_price.toFixed(2)}</td>
                    <td className="p-4">
                      {product.stock <= 5 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          <AlertTriangle size={14} /> {product.stock} Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {product.stock} In Stock
                        </span>
                      )}
                    </td>
                    <td className="p-4 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openModal(product)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(product.id, product.name)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modern Slide-up Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transform transition-all">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-xl text-slate-800">{editingId ? 'Edit Product Details' : 'Create New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-md shadow-sm border border-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5 bg-white">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Product Name</label>
                <div className="relative">
                  <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-800 font-medium transition-all" placeholder="e.g. 1kg Sugar" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Barcode (SKU)</label>
                <div className="relative">
                  <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-mono text-slate-800 transition-all" placeholder="Scan or type barcode" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Price (LKR)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input required type="number" step="0.01" min="0" value={formData.selling_price} onChange={e => setFormData({...formData, selling_price: e.target.value})} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-800 font-bold transition-all" placeholder="0.00" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Stock Level</label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input required type="number" min="0" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-800 font-bold transition-all" placeholder="0" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-colors flex items-center justify-center shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}