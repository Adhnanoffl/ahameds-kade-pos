//@ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  ShoppingCart, Plus, Minus, X, User, Receipt, Barcode, Trash2, Tag,
  AlertCircle, PauseCircle, PlayCircle, Banknote, Wallet, Loader2, RefreshCw,
  Phone, Award, LayoutGrid, Scale, Check, Percent, Keyboard
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Product {
  id: string;
  category_id: string | null;
  name: string;
  barcode: string | null;
  selling_price: number;
  stock: number;
  weight_based?: boolean;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  loyalty_points?: number;
  loan_balance?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface HeldSale {
  id: string;
  label: string;
  cart: CartItem[];
  customerId: string;
  heldAt: string;
  discount: number;
}

const NOTES = [20, 50, 100, 500, 1000, 5000];

const money = (n: number) =>
  `LKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [cashierId, setCashierId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discount, setDiscount] = useState<number>(0);

  const [showGrid, setShowGrid] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [showHeld, setShowHeld] = useState(false);

  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'loan'>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [cashNotes, setCashNotes] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0 && !showPayment) openPayment();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && !showPayment) {
          if (window.confirm("Void this sale?")) voidSale();
        }
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [cart, showPayment]);

  // Auto-add on exact barcode match
  useEffect(() => {
    if (!searchQuery) return;
    const q = searchQuery.trim().toLowerCase();
    const match = products.find(p => p.barcode && p.barcode.toLowerCase() === q);
    if (match) {
      playBeep();
      addToCart(match);
      setSearchQuery('');
    }
  }, [searchQuery, products]);

  // Payment Modal Enter/Escape
  useEffect(() => {
    if (!showPayment) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmCharge();
      } else if (e.key === 'Escape' && !processing) {
        setShowPayment(false);
        scanInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showPayment, cashTendered, paymentMethod, processing, cart, selectedCustomer]);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [productsRes, categoriesRes, customersRes, settingsRes, userRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('store_settings').select('tax_rate, receipt_header, receipt_footer').eq('id', 'global_config').maybeSingle(),
        supabase.auth.getUser(),
      ]);

      if (productsRes.error) throw productsRes.error;
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
      setCustomers(customersRes.data || []);
      
      if (settingsRes.data) {
        setTaxRate(Number(settingsRes.data.tax_rate || 0) / 100);
        setReceiptHeader(settingsRes.data.receipt_header || '');
        setReceiptFooter(settingsRes.data.receipt_footer || '');
      }
      setCashierId(userRes.data?.user?.id || null);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load POS data');
      toast.error('Could not load products or customers.');
    } finally {
      setLoading(false);
      scanInputRef.current?.focus();
    }
  };

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
    } catch (e) {}
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim().toLowerCase();
    const match = products.find(
      p => (p.barcode && p.barcode.toLowerCase() === query) || p.name.toLowerCase() === query
    );
    if (match) {
      playBeep();
      addToCart(match);
    } else {
      toast.error('Product not found in system.');
    }
    setSearchQuery('');
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [{ product, quantity: 1 }, ...prev];
    });
    scanInputRef.current?.focus();
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const setExactQuantity = (productId: string, qty: number) => {
    setCart(prev => prev.map(item => (item.product.id === productId ? { ...item, quantity: qty } : item)));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.product.id !== productId));

  const voidSale = () => {
    setCart([]);
    setDiscount(0);
    clearCustomer();
    scanInputRef.current?.focus();
  };

  const promptDiscount = () => {
    const val = window.prompt("Enter flat discount amount (LKR):", discount.toString());
    if (val !== null) {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) setDiscount(num);
    }
  };

  // --- Advanced Calculations ---
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0), [cart]);
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = taxableAmount * taxRate;
  const finalTotal = taxableAmount + tax;
  const cashChange = paymentMethod === 'cash' ? Math.max(0, Number(cashTendered || 0) - finalTotal) : 0;

  const noteBreakdown = useMemo(() => {
    const counts: Record<number, number> = {};
    cashNotes.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    return Object.entries(counts).map(([denom, count]) => ({ denom: Number(denom), count })).sort((a, b) => b.denom - a.denom);
  }, [cashNotes]);

  const tapNote = (denom: number) => {
    setCashNotes(prev => [...prev, denom]);
    setCashTendered(prev => (Number(prev || 0) + denom).toString());
  };

  const setExactCash = () => {
    setCashNotes([]);
    setCashTendered(finalTotal.toString());
  };

  // --- Customer & Hold logic ---
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim();
    if (q.length < 3) return [];
    return customers.filter(c => c.phone && c.phone.includes(q));
  }, [customerQuery, customers]);

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerMatches.length === 1) {
      setSelectedCustomer(customerMatches[0]);
      setCustomerQuery('');
    } else if (customerMatches.length === 0) toast.error('Customer not found.');
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
  };

  const holdCurrentSale = () => {
    if (cart.length === 0) return toast.error('Cart is empty.');
    const held: HeldSale = {
      id: crypto.randomUUID(),
      label: `${cart.length} items • ${money(finalTotal)}`,
      cart,
      customerId: selectedCustomer?.id || '',
      heldAt: new Date().toLocaleTimeString(),
      discount
    };
    setHeldSales(prev => [held, ...prev]);
    voidSale();
    toast.success('Sale held.');
  };

  const resumeHeldSale = (id: string) => {
    if (cart.length > 0) return toast.error('Clear current sale first.');
    const held = heldSales.find(h => h.id === id);
    if (!held) return;
    setCart(held.cart);
    setDiscount(held.discount || 0);
    setSelectedCustomer(customers.find(c => c.id === held.customerId) || null);
    setHeldSales(prev => prev.filter(h => h.id !== id));
    setShowHeld(false);
  };

  // --- Checkout & Printing ---
  const openPayment = () => {
    if (cart.length === 0) return;
    setPaymentMethod('cash');
    setCashTendered(''); // Ensure it resets to zero/empty
    setCashNotes([]);
    setShowPayment(true);
    setTimeout(() => cashInputRef.current?.focus(), 100);
  };

  const confirmCharge = async () => {
    if (cart.length === 0 || processing) return;
    if (paymentMethod === 'loan' && !selectedCustomer) return toast.error('Select a customer for loan charge.');
    if (paymentMethod === 'cash' && Number(cashTendered || 0) < finalTotal) return toast.error('Insufficient cash tendered.');

    setProcessing(true);

    // FIX: Open popup BEFORE async database calls to bypass browser popup blockers!
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');

    try {
      // 1. Save Sale
      const { data: saleRow, error: saleError } = await supabase.from('sales').insert({
        customer_id: selectedCustomer?.id || null,
        cashier_id: cashierId,
        subtotal,
        tax,
        discount_amount: discount,
        total: finalTotal,
        payment_method: paymentMethod,
        cash_tendered: paymentMethod === 'cash' ? Number(cashTendered) : null,
        change_due: paymentMethod === 'cash' ? cashChange : null,
      }).select().single();
      
      if (saleError) throw saleError;

      // 2. Save Items & Update Stock
      await supabase.from('sale_items').insert(
        cart.map(item => ({
          sale_id: saleRow.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.selling_price,
          line_total: item.product.selling_price * item.quantity,
        }))
      );

      await Promise.all(cart.map(item => supabase.from('products').update({ stock: item.product.stock - item.quantity }).eq('id', item.product.id)));

      // 3. Update Loan Balance
      let newLoanBalance = selectedCustomer?.loan_balance || 0;
      if (paymentMethod === 'loan' && selectedCustomer) {
        newLoanBalance += finalTotal;
        await supabase.from('customers').update({ loan_balance: newLoanBalance }).eq('id', selectedCustomer.id);
      }

      // 4. Generate & Print Receipt
      if (receiptWindow) {
        const dStr = discount > 0 ? `<div class="flex-between"><span>Discount:</span><span>-${money(discount)}</span></div>` : '';
        const taxStr = tax > 0 ? `<div class="flex-between"><span>Tax:</span><span>${money(tax)}</span></div>` : '';
        const loanStr = paymentMethod === 'loan' ? `<div class="divider"></div><div class="flex-between bold"><span>NEW LOAN BALANCE:</span><span>${money(newLoanBalance)}</span></div>` : '';
        
        receiptWindow.document.write(`
          <html>
            <head>
              <title>Receipt</title>
              <style>
                @page { margin: 0; }
                body { font-family: 'Courier New', monospace; padding: 5mm; width: 72mm; margin: 0 auto; color: #000; font-size: 12px; }
                .text-center { text-align: center; }
                .divider { border-top: 1px dashed #000; margin: 8px 0; }
                .flex-between { display: flex; justify-content: space-between; margin-bottom: 3px; }
                .bold { font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="text-center">
                <h2 style="margin: 0;">Ahamed's Kade</h2>
                ${receiptHeader ? `<p style="margin: 2px 0;">${receiptHeader}</p>` : ''}
              </div>
              <div class="divider"></div>
              <p style="margin: 2px 0;">Date: ${new Date().toLocaleString()}</p>
              ${selectedCustomer ? `<p style="margin: 2px 0;">Customer: ${selectedCustomer.full_name}</p>` : ''}
              <p style="margin: 2px 0;">Type: <span class="bold">${paymentMethod.toUpperCase()}</span></p>
              <div class="divider"></div>
              ${cart.map(item => `
                <div style="margin-bottom: 5px;">
                  <div>${item.product.name}</div>
                  <div class="flex-between">
                    <span>${item.quantity} x ${item.product.selling_price.toFixed(2)}</span>
                    <span>${(item.product.selling_price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              `).join('')}
              <div class="divider"></div>
              <div class="flex-between"><span>Subtotal:</span><span>${money(subtotal)}</span></div>
              ${dStr}
              ${taxStr}
              <div class="flex-between bold" style="font-size: 16px; margin-top: 5px;">
                <span>TOTAL:</span><span>${money(finalTotal)}</span>
              </div>
              ${paymentMethod === 'cash' ? `
                <div class="flex-between" style="margin-top: 5px;"><span>Tendered:</span><span>${money(Number(cashTendered))}</span></div>
                <div class="flex-between"><span>Change:</span><span>${money(cashChange)}</span></div>
              ` : ''}
              ${loanStr}
              <div class="divider"></div>
              <div class="text-center"><p>${receiptFooter || 'Thank you!'}</p></div>
            </body>
          </html>
        `);
        receiptWindow.document.close();
        setTimeout(() => { receiptWindow.print(); receiptWindow.close(); }, 300);
      }

      toast.success('Sale Complete!');
      voidSale();
      setShowPayment(false);
      
    } catch (err: any) {
      if (receiptWindow) receiptWindow.close();
      toast.error('Transaction failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // --- Render logic ---
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)));
  }, [searchQuery, products]);

  const gridProducts = useMemo(() => activeCategory ? products.filter(p => p.category_id === activeCategory) : products, [products, activeCategory]);

  if (loading || loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F7F5F1]">
        <div className="flex flex-col items-center gap-3 text-[#6B6A66]">
          {loading ? <Loader2 className="animate-spin" size={32} /> : <AlertCircle className="text-red-600" size={32} />}
          <p>{loading ? 'Loading POS Terminal...' : loadError}</p>
          {loadError && <button onClick={loadAll} className="px-4 py-2 bg-[#0F6E5B] text-white rounded-lg">Retry</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#F7F5F1] font-sans text-[#1C1B19]">
      
      {/* LEFT PANEL: Scanner & Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Header Bar */}
        <div className="bg-white p-4 shadow-sm z-20 border-b border-[#E7E3DB] flex gap-2">
          <form onSubmit={handleScanSubmit} className="relative flex-1">
            <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A6A39A]" size={22} />
            <input
              ref={scanInputRef}
              type="text"
              placeholder="Scan Barcode (F2)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 bg-[#F7F5F1] border-2 border-[#E7E3DB] rounded-xl font-medium focus:border-[#0F6E5B] focus:bg-white outline-none"
              autoFocus
            />
          </form>
          
          <button onClick={() => setShowGrid(s => !s)} className={`p-3.5 rounded-xl border-2 ${showGrid ? 'border-[#0F6E5B] bg-[#E4F3EF] text-[#0F6E5B]' : 'border-[#E7E3DB]'}`}>
            <LayoutGrid size={22} />
          </button>
          <button onClick={holdCurrentSale} className="p-3.5 rounded-xl border-2 border-[#E7E3DB] hover:text-[#0F6E5B]">
            <PauseCircle size={22} />
          </button>
          <button onClick={() => setShowHeld(s => !s)} className="relative p-3.5 rounded-xl border-2 border-[#E7E3DB] hover:text-[#0F6E5B]">
            <PlayCircle size={22} />
            {heldSales.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-orange-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">{heldSales.length}</span>}
          </button>
        </div>

        {/* Search Results Dropdown */}
        {searchQuery && searchResults.length > 0 && (
          <div className="absolute top-20 left-4 w-[calc(100%-430px)] bg-white rounded-xl shadow-2xl z-50 border max-h-72 overflow-y-auto">
            {searchResults.map(p => (
              <div key={p.id} onClick={() => addToCart(p)} className="p-4 border-b hover:bg-[#E4F3EF] cursor-pointer flex justify-between items-center">
                <span className="font-bold">{p.name} <span className="text-xs font-normal text-gray-500 ml-2">Stock: {p.stock}</span></span>
                <span className="font-bold text-[#0F6E5B]">{money(p.selling_price)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Product Grid */}
        {showGrid && (
          <div className="bg-white border-b border-[#E7E3DB] p-4">
            <div className="flex gap-2 overflow-x-auto pb-3">
              <button onClick={() => setActiveCategory(null)} className={`px-4 py-2 rounded-full font-bold border-2 ${!activeCategory ? 'bg-black text-white border-black' : 'border-gray-200'}`}>All</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setActiveCategory(c.id)} className="px-4 py-2 rounded-full font-bold border-2 border-gray-200 hover:bg-gray-50" style={activeCategory === c.id ? {backgroundColor: c.color, color: '#fff', borderColor: c.color} : {color: c.color}}>{c.name}</button>
              ))}
            </div>
            <div className="grid grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
              {gridProducts.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className="text-left p-3 rounded-xl border-2 border-gray-100 hover:border-[#0F6E5B] hover:bg-[#E4F3EF] relative">
                  <div className="font-bold text-sm truncate">{p.name}</div>
                  <div className="text-xs font-bold text-[#0F6E5B] mt-1">{money(p.selling_price)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Receipt Tape (Cart View) */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E7E3DB] min-h-full flex flex-col">
            <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-xs font-bold text-gray-500 uppercase">
              <div className="col-span-6">Item</div>
              <div className="col-span-3 text-center">Qty</div>
              <div className="col-span-3 text-right">Total</div>
            </div>
            
            <div className="divide-y divide-dashed divide-gray-200">
              {cart.length === 0 ? (
                <div className="text-center p-12 text-gray-400">
                  <ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-bold text-gray-600">Terminal Ready</p>
                </div>
              ) : cart.map((item) => (
                <div key={item.product.id} className="grid grid-cols-12 gap-4 p-4 items-center group">
                  <div className="col-span-6">
                    <div className="font-bold text-lg">{item.product.name}</div>
                    <div className="text-sm text-gray-500">@ {item.product.selling_price.toFixed(2)}</div>
                  </div>
                  <div className="col-span-3 flex justify-center">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg border p-1">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:text-red-600"><Minus size={16} /></button>
                      <span className="font-bold w-8 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:text-green-600"><Plus size={16} /></button>
                    </div>
                  </div>
                  <div className="col-span-3 flex justify-end items-center gap-3">
                    <span className="font-bold text-xl">{money(item.product.selling_price * item.quantity)}</span>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-600"><Trash2 size={20} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Checkout */}
      <div className="w-full md:w-[400px] bg-white border-l border-[#E7E3DB] flex flex-col h-full shadow-2xl z-10">
        
        {/* Customer Lookup */}
        <div className="p-6 border-b bg-[#FAF9F6]">
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Customer Profile</label>
          {selectedCustomer ? (
            <div className="bg-white border-2 border-[#0F6E5B] rounded-xl p-3">
              <div className="flex justify-between">
                <div>
                  <div className="font-bold">{selectedCustomer.full_name}</div>
                  <div className="text-xs text-gray-500">{selectedCustomer.phone}</div>
                </div>
                <button onClick={clearCustomer} className="text-gray-400 hover:text-red-600"><X size={18} /></button>
              </div>
              <div className="flex gap-4 mt-2 pt-2 border-t text-xs">
                <div className="font-bold text-orange-700 flex items-center gap-1"><Award size={14}/> {selectedCustomer.loyalty_points || 0} pts</div>
                <div className="font-bold text-red-600 flex items-center gap-1"><Wallet size={14}/> {money(selectedCustomer.loan_balance || 0)} owed</div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCustomerSubmit} className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="tel" value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} placeholder="Phone number (Enter)" className="w-full pl-10 pr-4 py-3 border rounded-xl font-bold bg-white focus:border-[#0F6E5B] outline-none" />
            </form>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 grid grid-cols-2 gap-3 border-b">
          <button onClick={voidSale} disabled={cart.length===0} className="py-3 rounded-xl font-bold text-sm bg-red-50 text-red-700 hover:bg-red-100 flex items-center justify-center gap-2">
            Void (F8)
          </button>
          <button onClick={promptDiscount} disabled={cart.length===0} className="py-3 rounded-xl font-bold text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center gap-2">
            <Percent size={16}/> Discount
          </button>
        </div>

        {/* Totals & Pay */}
        <div className="mt-auto p-6 bg-[#FAF9F6] flex flex-col gap-3">
          <div className="flex justify-between text-gray-500 font-medium"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between text-blue-600 font-bold"><span>Discount</span><span>-{money(discount)}</span></div>}
          <div className="flex justify-between text-gray-500 font-medium border-b border-dashed pb-4"><span>Tax</span><span>{money(tax)}</span></div>
          
          <div className="flex justify-between items-end mt-2 mb-6">
            <span className="font-bold text-xl">Total Due</span>
            <span className="text-4xl font-bold text-[#0F6E5B]">{money(finalTotal)}</span>
          </div>

          <button onClick={openPayment} disabled={cart.length === 0} className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-xl">
            Charge (F4) <Receipt size={24} />
          </button>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => !processing && setShowPayment(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b bg-[#FAF9F6]">
              <h3 className="font-bold text-2xl">Payment</h3>
              <p className="text-4xl font-bold text-[#0F6E5B] mt-2">{money(finalTotal)}</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPaymentMethod('cash')} className={`py-4 rounded-xl border-2 font-bold flex items-center justify-center gap-2 ${paymentMethod === 'cash' ? 'border-[#0F6E5B] bg-[#E4F3EF] text-[#0F6E5B]' : 'border-gray-200'}`}><Banknote size={20}/> Cash</button>
                <button onClick={() => setPaymentMethod('loan')} className={`py-4 rounded-xl border-2 font-bold flex items-center justify-center gap-2 ${paymentMethod === 'loan' ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-gray-200'}`}><Wallet size={20}/> Loan</button>
              </div>

              {paymentMethod === 'cash' ? (
                <div>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {NOTES.map(n => <button key={n} onClick={() => tapNote(n)} className="py-3 rounded-xl border-2 border-[#0F6E5B]/20 bg-green-50 text-[#0F6E5B] font-bold text-lg hover:border-[#0F6E5B]">+{n}</button>)}
                    <button onClick={setExactCash} className="py-3 rounded-xl border-2 bg-gray-50 font-bold col-span-2">Exact Amount</button>
                  </div>
                  
                  <label className="text-xs font-bold text-gray-500 uppercase">Cash Tendered (Type or tap above)</label>
                  <input
                    ref={cashInputRef}
                    type="number"
                    value={cashTendered}
                    onChange={e => { setCashTendered(e.target.value); setCashNotes([]); }}
                    className="w-full px-4 py-4 mt-1 border-2 rounded-xl text-2xl font-bold focus:border-[#0F6E5B] outline-none"
                    placeholder="0.00"
                  />
                  
                  <div className={`flex justify-between mt-4 p-4 rounded-xl border-2 ${cashChange > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200'}`}>
                    <span className="font-bold text-lg">Change Due</span>
                    <span className="font-bold text-2xl">{money(cashChange)}</span>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-orange-50 border-2 border-orange-200 rounded-xl text-center">
                  <Wallet size={48} className="mx-auto text-orange-400 mb-3" />
                  <p className="font-bold text-orange-800 text-lg">{selectedCustomer ? `${selectedCustomer.full_name}'s Tab` : 'No Customer Selected'}</p>
                  <p className="text-orange-700 mt-1">{selectedCustomer ? `${money(finalTotal)} will be added to their loan balance.` : 'Please exit and select a customer first to use the Loan feature.'}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex gap-3 bg-gray-50">
              <button onClick={() => setShowPayment(false)} disabled={processing} className="flex-1 py-4 rounded-xl font-bold bg-white border-2 text-gray-600">Cancel</button>
              <button onClick={confirmCharge} disabled={processing || (paymentMethod === 'loan' && !selectedCustomer)} className="flex-[2] py-4 rounded-xl font-bold text-white bg-[#0F6E5B] hover:bg-[#0B4F41] disabled:opacity-50 flex items-center justify-center gap-2 text-lg">
                {processing ? <Loader2 className="animate-spin" size={24} /> : <Check size={24} />} Confirm & Print (Enter)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}