// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  ShoppingCart, Plus, Minus, X, Search, User, 
  Receipt, Barcode, Trash2, Tag
} from 'lucide-react';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // Ref to keep the scanner input focused
  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    // Auto-focus scanner on load
    scanInputRef.current?.focus();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*');
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  // Handles Barcode Scanners (which automatically press 'Enter')
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Look for exact match by barcode (if you add that column later) or exact name
    const match = products.find(p => 
      (p.barcode && p.barcode === searchQuery.trim()) || 
      (p.name && p.name.toLowerCase() === searchQuery.trim().toLowerCase())
    );

    if (match) {
      addToCart(match);
      setSearchQuery('');
    } else {
      toast.error("Product not found. Try manual search below.");
    }
    scanInputRef.current?.focus();
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearchQuery('');
    scanInputRef.current?.focus();
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }));
    scanInputRef.current?.focus();
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    scanInputRef.current?.focus();
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (Number(item.product.price || 0) * item.quantity), 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return toast.error("Cart is empty");

    const settings = JSON.parse(localStorage.getItem('pos_settings') || '{"storeName": "My Store", "taxRate": "0", "receiptMessage": "Thank you!"}');
    const customer = customers.find(c => c.id === selectedCustomerId);
    const subtotal = calculateTotal();
    const tax = subtotal * (Number(settings.taxRate) / 100);
    const finalTotal = subtotal + tax;
    const customerDisplayName = customer ? (customer.full_name || customer.name || 'Customer') : '';

    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; color: #000; }
            .text-center { text-align: center; }
            .border-bottom { border-bottom: 1px dashed #000; margin: 10px 0; padding-bottom: 10px; }
            .flex-between { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="text-center border-bottom">
            <h2 style="margin: 0; font-size: 20px;">${settings.storeName}</h2>
            ${settings.storeAddress ? `<p style="margin: 5px 0; font-size: 12px;">${settings.storeAddress}</p>` : ''}
            ${settings.storePhone ? `<p style="margin: 5px 0; font-size: 12px;">${settings.storePhone}</p>` : ''}
          </div>
          
          ${customer ? `
          <div class="border-bottom" style="font-size: 12px;">
            <p style="margin: 2px 0;">Customer: ${customerDisplayName}</p>
            ${customer.phone ? `<p style="margin: 2px 0;">Phone: ${customer.phone}</p>` : ''}
          </div>
          ` : ''}

          <div class="border-bottom">
            ${cart.map(item => `
              <div style="font-size: 14px; margin-bottom: 8px;">
                <div>${item.product.name || 'Item'}</div>
                <div class="flex-between text-gray-600" style="font-size: 12px;">
                  <span>${item.quantity} x $${Number(item.product.price || 0).toFixed(2)}</span>
                  <span>$${(Number(item.product.price || 0) * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="border-bottom">
            <div class="flex-between"><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
            ${Number(settings.taxRate) > 0 ? `
              <div class="flex-between"><span>Tax (${settings.taxRate}%):</span><span>$${tax.toFixed(2)}</span></div>
            ` : ''}
            <div class="flex-between bold" style="font-size: 18px; margin-top: 5px;">
              <span>Total:</span><span>$${finalTotal.toFixed(2)}</span>
            </div>
          </div>

          <div class="text-center" style="font-size: 12px; margin-top: 20px;">
            <p>${settings.receiptMessage}</p>
            <p>${new Date().toLocaleString()}</p>
            <p>*** PLEASE COME AGAIN ***</p>
          </div>
        </body>
      </html>
    `);
    
    receiptWindow.document.close();
    receiptWindow.print();
    
    setCart([]);
    setSelectedCustomerId('');
    setSearchQuery('');
    toast.success("Transaction Complete");
    scanInputRef.current?.focus();
  };

  // Safe manual search filter
  const searchResults = searchQuery.length > 0 
    ? products.filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.barcode && p.barcode.includes(searchQuery)))
    : [];

  return (
    <div className="h-full flex flex-col md:flex-row bg-gray-100 font-sans">
      
      {/* LEFT PANEL: Supermarket Scanner & Live Receipt */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Scanner Bar */}
        <div className="bg-white p-4 shadow-sm z-20">
          <form onSubmit={handleScanSubmit} className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Barcode className="text-gray-400" size={24} />
            </div>
            <input 
              ref={scanInputRef}
              type="text" 
              placeholder="Scan Barcode or Search Product (Press Enter)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-brand-200 rounded-xl text-lg focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all shadow-inner"
              autoFocus
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); scanInputRef.current?.focus(); }} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            )}
          </form>

          {/* Manual Search Dropdown (Appears when typing) */}
          {searchQuery && searchResults.length > 0 && (
            <div className="max-w-2xl mx-auto mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-64 overflow-y-auto absolute left-0 right-0 z-50">
              {searchResults.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className="flex items-center justify-between p-4 hover:bg-brand-50 cursor-pointer border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-gray-100 p-2 rounded-lg text-gray-500"><Tag size={16}/></div>
                    <div>
                      <div className="font-bold text-gray-900">{product.name || 'Unnamed'}</div>
                      <div className="text-xs text-gray-500">Stock: {product.stock_quantity || 0} {product.barcode && `| Code: ${product.barcode}`}</div>
                    </div>
                  </div>
                  <div className="font-bold text-brand-600">${Number(product.price || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Digital Receipt List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-100">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-full">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-200 bg-gray-50 font-bold text-xs text-gray-500 uppercase tracking-wider">
              <div className="col-span-6">Item Description</div>
              <div className="col-span-3 text-center">Quantity</div>
              <div className="col-span-3 text-right">Total</div>
            </div>

            {/* Cart Items */}
            <div className="divide-y divide-gray-100">
              {cart.length === 0 ? (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                  <ShoppingCart size={48} className="mb-4 opacity-20" />
                  <p className="text-lg">Ready for next customer</p>
                  <p className="text-sm mt-1">Scan an item to begin</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div key={item.product.id} className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors ${index === cart.length - 1 ? 'bg-brand-50/30' : ''}`}>
                    <div className="col-span-6">
                      <div className="font-bold text-gray-900 text-lg">{item.product.name || 'Item'}</div>
                      <div className="text-sm text-gray-500">@ ${Number(item.product.price || 0).toFixed(2)} / each</div>
                    </div>
                    
                    <div className="col-span-3 flex justify-center">
                      <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="p-2 hover:bg-red-50 hover:text-red-600 rounded text-gray-600 transition-colors">
                          <Minus size={16} />
                        </button>
                        <span className="font-bold text-lg w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="p-2 hover:bg-brand-50 hover:text-brand-600 rounded text-gray-600 transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-4">
                      <span className="font-bold text-xl text-gray-900">
                        ${(Number(item.product.price || 0) * item.quantity).toFixed(2)}
                      </span>
                      <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Command Center (Totals & Checkout) */}
      <div className="w-full md:w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-2xl z-10">
        
        {/* Customer Selector */}
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Customer Account</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 outline-none appearance-none bg-white transition-all"
            >
              <option value="">Walk-in Customer (No Account)</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name || c.name || 'Unnamed'} {c.phone ? `- ${c.phone}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 grid grid-cols-2 gap-3 border-b border-gray-100">
          <button onClick={() => setCart([])} disabled={cart.length === 0} className="py-3 px-4 rounded-xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors">
            Void Sale
          </button>
          <button disabled className="py-3 px-4 rounded-xl font-bold text-sm bg-gray-100 text-gray-400 cursor-not-allowed">
            Discount
          </button>
        </div>

        {/* Grand Total Display */}
        <div className="mt-auto p-6 bg-gray-50 flex flex-col gap-3">
          <div className="flex justify-between items-center text-gray-500 text-sm font-medium">
            <span>Subtotal</span>
            <span>${calculateTotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-gray-500 text-sm font-medium border-b border-gray-200 pb-4">
            <span>Tax ({JSON.parse(localStorage.getItem('pos_settings') || '{"taxRate": "0"}').taxRate}%)</span>
            <span>${(calculateTotal() * (Number(JSON.parse(localStorage.getItem('pos_settings') || '{"taxRate": "0"}').taxRate) / 100)).toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between items-end mt-2 mb-6">
            <span className="text-gray-900 font-bold text-lg">Total Due</span>
            <span className="text-5xl font-black text-brand-600 tracking-tighter">
              ${(calculateTotal() * (1 + Number(JSON.parse(localStorage.getItem('pos_settings') || '{"taxRate": "0"}').taxRate) / 100)).toFixed(2)}
            </span>
          </div>

          {/* Huge Checkout Button */}
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-black hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg"
          >
            <Receipt size={28} />
            CHARGE ${(calculateTotal() * (1 + Number(JSON.parse(localStorage.getItem('pos_settings') || '{"taxRate": "0"}').taxRate) / 100)).toFixed(2)}
          </button>
        </div>

      </div>
    </div>
  );
}