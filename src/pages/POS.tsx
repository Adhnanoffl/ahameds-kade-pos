// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Minus, Trash2, Search, User, Receipt } from 'lucide-react';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error && !error.message.includes('does not exist')) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*').order('name');
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
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
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return toast.error("Cart is empty");

    // Grab settings and customer info
    const settings = JSON.parse(localStorage.getItem('pos_settings') || '{"storeName": "My Store", "taxRate": "0", "receiptMessage": "Thank you!"}');
    const customer = customers.find(c => c.id === selectedCustomerId);
    const subtotal = calculateTotal();
    const tax = subtotal * (Number(settings.taxRate) / 100);
    const finalTotal = subtotal + tax;

    // Create a printable receipt window
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
            .text-center { text-align: center; }
            .border-bottom { border-bottom: 1px dashed #000; margin: 10px 0; padding-bottom: 10px; }
            .flex-between { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="text-center border-bottom">
            <h2 style="margin: 0;">${settings.storeName}</h2>
            ${settings.storeAddress ? `<p style="margin: 5px 0; font-size: 12px;">${settings.storeAddress}</p>` : ''}
            ${settings.storePhone ? `<p style="margin: 5px 0; font-size: 12px;">${settings.storePhone}</p>` : ''}
          </div>
          
          ${customer ? `
          <div class="border-bottom" style="font-size: 12px;">
            <p style="margin: 2px 0;">Customer: ${customer.name}</p>
            ${customer.phone ? `<p style="margin: 2px 0;">Phone: ${customer.phone}</p>` : ''}
          </div>
          ` : ''}

          <div class="border-bottom">
            ${cart.map(item => `
              <div class="flex-between" style="font-size: 14px;">
                <span>${item.quantity}x ${item.product.name}</span>
                <span>$${(item.product.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>

          <div class="border-bottom">
            <div class="flex-between"><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
            ${Number(settings.taxRate) > 0 ? `
              <div class="flex-between"><span>Tax (${settings.taxRate}%):</span><span>$${tax.toFixed(2)}</span></div>
            ` : ''}
            <div class="flex-between bold" style="font-size: 16px; margin-top: 5px;">
              <span>Total:</span><span>$${finalTotal.toFixed(2)}</span>
            </div>
          </div>

          <div class="text-center" style="font-size: 12px; margin-top: 20px;">
            <p>${settings.receiptMessage}</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `);
    
    receiptWindow.document.close();
    receiptWindow.print();
    
    // Clear the cart after printing
    setCart([]);
    setSelectedCustomerId('');
    toast.success("Checkout successful!");
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex flex-col md:flex-row bg-gray-50">
      
      {/* Left Side: Products Grid */}
      <div className="flex-1 p-6 flex flex-col h-full overflow-hidden">
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white shadow-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p>No products found. Add some in the Inventory tab!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-brand-500 hover:shadow-md transition-all active:scale-95 flex flex-col h-32"
                >
                  <h3 className="font-bold text-gray-900 line-clamp-2 mb-auto">{product.name}</h3>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-brand-600 font-bold">${product.price.toFixed(2)}</span>
                    <span className="text-xs text-gray-400">Stock: {product.stock_quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Cart & Checkout */}
      <div className="w-full md:w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-xl z-10">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <ShoppingCart size={20} className="text-brand-600" />
          <h2 className="font-bold text-lg text-gray-900">Current Order</h2>
        </div>

        {/* Customer Selector */}
        <div className="p-4 border-b border-gray-100">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Attach Customer</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none appearance-none bg-white"
            >
              <option value="">Walk-in Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <ShoppingCart size={40} className="mx-auto mb-2 opacity-20" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-900 leading-tight">{item.product.name}</span>
                  <span className="font-bold text-brand-600">${(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-1">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                      <Minus size={14} />
                    </button>
                    <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                      <Plus size={14} />
                    </button>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500 font-medium">Subtotal</span>
            <span className="font-bold text-xl text-gray-900">${calculateTotal().toFixed(2)}</span>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Receipt size={20} />
            Pay & Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}