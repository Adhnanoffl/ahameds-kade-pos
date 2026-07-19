// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Package, Plus, Search, Edit, Trash2, X, 
  Barcode, DollarSign, Hash, Loader2 
} from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    price: '', 
    stock_quantity: '', 
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
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (product = null) => {
    if (product) {
      setEditingId(product.id);
      setFormData({ 
        name: product.name || '', 
        price: product.price?.toString() || '0', 
        stock_quantity: product.stock_quantity?.toString() || '0',
        barcode: product.barcode || ''
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', price: '', stock_quantity: '', barcode: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Product name is required");
    
    setIsSubmitting(true);
    
    const payload = {
      name: formData.name,      
      price: Number(formData.price) || 0,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      barcode: formData.barcode || null
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success("Product updated!");
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        toast.success("Product added!");
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success("Product deleted");
      fetchProducts();
    } catch (error: any) {
      toast.error("Failed to delete product");
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">Manage your products, pricing, and stock levels</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={20} /> Add Product
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by name or scan barcode..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
            />
          </div>
        </div>

        {/* Inventory Table */}
        <div className="flex-1 overflow-y-auto bg-white">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 text-gray-400">
               <Loader2 className="animate-spin mb-2" size={32} />
               <p>Loading inventory...</p>
             </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-8 text-center">
              <Package size={64} className="mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
              <p className="text-sm">Click "Add Product" to start building your catalog.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 shadow-sm z-10">
                <tr>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Barcode</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4 font-bold text-gray-900">{product.name || 'Unnamed'}</td>
                    <td className="p-4 text-gray-500 font-mono text-sm">
                      {product.barcode ? (
                        <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200 flex items-center gap-2 w-max">
                          <Barcode size={14}/> {product.barcode}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic">No barcode</span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-brand-600">${Number(product.price || 0).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-sm font-bold ${
                        (product.stock_quantity || 0) <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {product.stock_quantity || 0} in stock
                      </span>
                    </td>
                    <td className="p-4 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openModal(product)} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              
              {/* Product Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Product Name *</label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. Organic Bananas" />
                </div>
              </div>
              
              {/* Barcode Scanner Input */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Barcode (SKU)</label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono" placeholder="Scan or type barcode" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Click here and use a barcode scanner to instantly fill.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Price */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Selling Price *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input required type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
                  </div>
                </div>

                {/* Stock Quantity */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Stock Level *</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input required type="number" min="0" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 text-white bg-brand-600 hover:bg-brand-700 rounded-xl font-bold transition-colors flex items-center justify-center shadow-sm">
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