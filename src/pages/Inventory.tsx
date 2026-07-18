// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
// @ts-ignore
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Search, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProducts, DbProduct } from '../hooks/useProducts';
import { supabase } from '../lib/supabase';

export default function Inventory() {
  const { products, loading, refreshProducts } = useProducts();
  const [globalFilter, setGlobalFilter] = useState('');
  
  // --- NEW: Form State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    purchase_price: '',
    selling_price: '',
    stock: '',
  });

  // --- NEW: Add Product Function ---
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevents the page from reloading
    
    if (!newProduct.name || !newProduct.selling_price || !newProduct.stock) {
      return toast.error("Name, Selling Price, and Stock are required");
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('products')
        .insert([{
          name: newProduct.name,
          sku: newProduct.sku || null,
          purchase_price: parseFloat(newProduct.purchase_price) || 0,
          selling_price: parseFloat(newProduct.selling_price),
          stock: parseInt(newProduct.stock, 10),
          weight_based: false
        }]);

      if (error) throw error;

      toast.success("Product added successfully!");
      setIsAddModalOpen(false); // Close the modal
      // Reset the form
      setNewProduct({ name: '', sku: '', purchase_price: '', selling_price: '', stock: '' });
      // Refresh the table!
      refreshProducts();
    } catch (error: any) {
      toast.error(error.message || "Failed to add product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredData = useMemo(() => {
    return products.filter(item => 
      item.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(globalFilter.toLowerCase()))
    );
  }, [products, globalFilter]);

  const handleQuickStockUpdate = async (id: string, currentStock: number) => {
    const amountStr = prompt(`Update stock level. Enter new total count:`, currentStock.toString());
    if (amountStr === null) return;
    
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount < 0) {
      return toast.error("Please enter a valid positive number");
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ stock: amount })
        .eq('id', id);

      if (error) throw error;
      toast.success("Stock updated in database!");
      refreshProducts();
    } catch (error: any) {
      toast.error(error.message || "Failed to update stock");
    }
  };

  const columnHelper = createColumnHelper<DbProduct>();

  const columns = useMemo(() => [
    columnHelper.accessor('sku', {
      header: 'SKU / ID',
      cell: (info: any) => <span className="font-mono text-xs text-gray-500">{info.getValue() || 'N/A'}</span>,
    }),
    columnHelper.accessor('name', {
      header: 'Product Name',
      cell: (info: any) => <span className="font-bold text-gray-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor('purchase_price', {
      header: 'Cost (LKR)',
      cell: (info: any) => <span>{info.getValue()?.toFixed(2)}</span>,
    }),
    columnHelper.accessor('selling_price', {
      header: 'Price (LKR)',
      cell: (info: any) => <span className="font-semibold text-brand-600">{info.getValue()?.toFixed(2)}</span>,
    }),
    columnHelper.accessor('stock', {
      header: 'Stock Level',
      cell: (info: any) => {
        const stock = info.getValue() || 0;
        const row = info.row.original;
        const isLow = stock <= 20;
        return (
          <button 
            onClick={() => handleQuickStockUpdate(row.id, stock)}
            className={`px-3 py-1.5 rounded-xl font-bold text-sm tracking-wide transition-transform active:scale-95 ${
              isLow ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}
          >
            {stock}
          </button>
        );
      },
    }),
  ], [products]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="relative h-full overflow-y-auto bg-gray-50 p-4 lg:p-8 space-y-6 pb-24 lg:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Inventory Catalog</h1>
          <p className="text-gray-500">Live database synced. Tap a stock number to edit.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-5 py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus size={20} /> Add Product
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Search items by code or name..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p>Syncing with database...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {table.getHeaderGroups().map((headerGroup: any) => (
                  <tr key={headerGroup.id} className="bg-gray-50 border-b border-gray-100">
                    {headerGroup.headers.map((header: any) => (
                      <th key={header.id} className="p-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 text-sm">
                      No products found in the database.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row: any) => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors last:border-none">
                      {row.getVisibleCells().map((cell: any) => (
                        <td key={cell.id} className="p-4 text-sm align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- NEW: Add Product Modal --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Add New Product</h2>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input 
                  type="text" 
                  required
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Samba Rice 1kg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU / Code</label>
                <input 
                  type="text" 
                  value={newProduct.sku}
                  onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. SAM-01"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (Rs)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={newProduct.purchase_price}
                    onChange={e => setNewProduct({...newProduct, purchase_price: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (Rs) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    value={newProduct.selling_price}
                    onChange={e => setNewProduct({...newProduct, selling_price: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock *</label>
                <input 
                  type="number" 
                  min="0"
                  required
                  value={newProduct.stock}
                  onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="0"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50 shadow-md shadow-brand-500/30"
                >
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