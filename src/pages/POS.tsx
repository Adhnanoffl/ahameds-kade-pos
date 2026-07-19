//@ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  ShoppingCart, Plus, Minus, X, Search, User, 
  Receipt, Barcode, Trash2, Tag, AlertCircle
} from 'lucide-react';

// Strict typing aligns with our SQL schema
interface Product {
  id: string;
  name: string;
  barcode: string | null;
  selling_price: number;
  stock: number;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    scanInputRef.current?.focus();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (!error && data) setProducts(data);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*');
    if (!error && data) setCustomers(data);
  };

  // Hardware Beep function for barcode scanners
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      setTimeout(() => osc.stop(), 100);
    } catch (e) {
      console.log("Audio not supported");
    }
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toLowerCase();
    const match = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === query) || 
      (p.name.toLowerCase() === query)
    );

    if (match) {
      playBeep();
      addToCart(match);
      setSearchQuery('');
    } else {
      toast.error("Product not found in system.");
    }
    scanInputRef.current?.focus();
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        // Warn if exceeding stock, but allow it (standard POS behavior for unlogged inventory)
        if (existing.quantity + 1 > product.stock) {
          toast.custom((t) => (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg shadow-md flex items-center gap-2">
              <AlertCircle size={18} /> Stock warning: Only {product.stock} left
            </div>
          ), { duration: 2000 });
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [{ product, quantity: 1 }, ...prev]; // Add to top of list
    });
    setSearchQuery('');
    scanInputRef.current?.focus();
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }));
    scanInputRef.current?.focus();
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    scanInputRef.current?.focus();
  };

  // Safe floating point math
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.selling_price * item.quantity), 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return toast.error("Cart is empty");

    // In a real app, settings come from DB. Mocking for now.
    const taxRate = 0.00; // 0% tax
    const subtotal = calculateSubtotal();
    const tax = subtotal * taxRate;
    const finalTotal = subtotal + tax;
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    
    // Enterprise Thermal Receipt Format (80mm width)
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
          <head>
            <title>Receipt</title>
            <style>
              @page { margin: 0; }
              body { font-family: 'Courier New', Courier, monospace; padding: 5mm; width: 72mm; margin: 0 auto; color: #000; line-height: 1.2; }
              .text-center { text-align: center; }
              .divider { border-top: 1px dashed #000; margin: 5px 0; }
              .flex-between { display: flex; justify-content: space-between; }
              .bold { font-weight: bold; }
              .item-row { margin-bottom: 3px; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="text-center">
              <h2 style="margin: 0; font-size: 18px;">Ahamed's Kade</h2>
              <p style="margin: 2px 0; font-size: 12px;">Main Street, City</p>
            </div>
            
            <div class="divider"></div>
            <p style="font-size: 10px; margin: 2px 0;">Date: ${new Date().toLocaleString()}</p>
            ${customer ? `<p style="font-size: 10px; margin: 2px 0;">Customer: ${customer.full_name}</p>` : ''}
            <div class="divider"></div>

            <div style="min-height: 50px;">
              ${cart.map(item => `
                <div class="item-row">
                  <div>${item.product.name}</div>
                  <div class="flex-between text-gray-600">
                    <span>${item.quantity} x LKR ${item.product.selling_price.toFixed(2)}</span>
                    <span>LKR ${(item.product.selling_price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="divider"></div>
            <div class="flex-between" style="font-size: 12px;"><span>Subtotal:</span><span>LKR ${subtotal.toFixed(2)}</span></div>
            ${tax > 0 ? `<div class="flex-between" style="font-size: 12px;"><span>Tax:</span><span>LKR ${tax.toFixed(2)}</span></div>` : ''}
            <div class="flex-between bold" style="font-size: 16px; margin-top: 5px;">
              <span>TOTAL:</span><span>LKR ${finalTotal.toFixed(2)}</span>
            </div>
            <div class="divider"></div>

            <div class="text-center" style="font-size: 10px; margin-top: 10px;">
              <p>Thank you for your business!</p>
              <p>Please come again</p>
              <svg id="barcode"></svg>
            </div>
          </body>
        </html>
      `);
      receiptWindow.document.close();
      // Auto print and close after tiny delay to render
      setTimeout(() => {
        receiptWindow.print();
        receiptWindow.close();
      }, 250);
    }
    
    // Clear state
    setCart([]);
    setSelectedCustomerId('');
    setSearchQuery('');
    toast.success("Transaction Complete");
    scanInputRef.current?.focus();
  };

  const searchResults = searchQuery.length > 0 
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.barcode && p.barcode.includes(searchQuery)))
    : [];

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-100 font-sans">
      
      {/* LEFT PANEL: Scanner & Cart */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Scanner Bar */}
        <div className="bg-white p-4 shadow-sm z-20 border-b border-slate-200">
          <form onSubmit={handleScanSubmit} className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Barcode className="text-slate-400" size={24} />
            </div>
            <input 
              ref={scanInputRef}
              type="text" 
              placeholder="Scan Barcode or Search (Press Enter)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-lg focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner font-medium text-slate-800"
              autoFocus
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); scanInputRef.current?.focus(); }} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            )}
          </form>

          {/* Search Dropdown */}
          {searchQuery && searchResults.length > 0 && (
            <div className="max-w-2xl mx-auto mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-72 overflow-y-auto absolute left-0 right-0 z-50">
              {searchResults.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className="flex items-center justify-between p-4 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-lg text-slate-500"><Tag size={16}/></div>
                    <div>
                      <div className="font-bold text-slate-900">{product.name}</div>
                      <div className="text-xs text-slate-500">
                        Stock: <span className={product.stock <= 5 ? 'text-rose-500 font-bold' : ''}>{product.stock}</span> 
                        {product.barcode && ` • Code: ${product.barcode}`}
                      </div>
                    </div>
                  </div>
                  <div className="font-black text-indigo-600">LKR {product.selling_price.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Digital Receipt View */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-full flex flex-col">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-200 bg-slate-50/80 font-bold text-xs text-slate-500 uppercase tracking-wider">
              <div className="col-span-6">Item</div>
              <div className="col-span-3 text-center">Qty</div>
              <div className="col-span-3 text-right">Total</div>
            </div>

            <div className="divide-y divide-slate-100 flex-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12">
                  <ShoppingCart size={64} className="mb-4 opacity-20" />
                  <p className="text-xl font-medium text-slate-600">Terminal Ready</p>
                  <p className="text-sm mt-1">Scan barcode to begin transaction</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors group">
                    <div className="col-span-6">
                      <div className="font-bold text-slate-900 text-lg truncate">{item.product.name}</div>
                      <div className="text-sm text-slate-500">@ LKR {item.product.selling_price.toFixed(2)}</div>
                    </div>
                    
                    <div className="col-span-3 flex justify-center">
                      <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-500 transition-colors">
                          <Minus size={16} />
                        </button>
                        <span className="font-bold text-lg w-8 text-center text-slate-800">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded text-slate-500 transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-3">
                      <span className="font-black text-xl text-slate-800">
                        LKR {(item.product.selling_price * item.quantity).toFixed(2)}
                      </span>
                      <button onClick={() => removeFromCart(item.product.id)} className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
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

      {/* RIGHT PANEL: Checkout Command Center */}
      <div className="w-full md:w-[400px] bg-white border-l border-slate-200 flex flex-col h-full shadow-2xl z-10 relative">
        
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Link Customer (Optional)</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select 
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none appearance-none bg-white transition-all shadow-sm"
            >
              <option value="">Walk-in Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6 grid grid-cols-2 gap-3 border-b border-slate-100">
          <button onClick={() => setCart([])} disabled={cart.length === 0} className="py-3 px-4 rounded-xl font-bold text-sm bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors">
            Void Sale
          </button>
          <button disabled className="py-3 px-4 rounded-xl font-bold text-sm bg-slate-100 text-slate-400 cursor-not-allowed">
            Apply Discount
          </button>
        </div>

        <div className="mt-auto p-6 bg-slate-50/50 flex flex-col gap-3">
          <div className="flex justify-between items-center text-slate-500 text-sm font-medium">
            <span>Subtotal</span>
            <span>LKR {calculateSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-500 text-sm font-medium border-b border-slate-200 pb-4">
            <span>Tax (0%)</span>
            <span>LKR 0.00</span>
          </div>
          
          <div className="flex justify-between items-end mt-2 mb-6">
            <span className="text-slate-800 font-bold text-xl">Total Due</span>
            <span className="text-5xl font-black text-indigo-600 tracking-tighter">
              LKR {calculateSubtotal().toFixed(2)}
            </span>
          </div>

          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-300 disabled:text-slate-500 text-white py-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] shadow-xl shadow-slate-900/20 disabled:shadow-none"
          >
            <Receipt size={28} />
            CHARGE
          </button>
        </div>
      </div>
    </div>
  );
}