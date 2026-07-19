//@ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  ShoppingCart, Plus, Minus, X, User, Receipt, Barcode, Trash2, Tag,
  AlertCircle, PauseCircle, PlayCircle, Banknote, BookUser, Loader2, RefreshCw
} from 'lucide-react';
 
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
  loan_balance?: number; // Khata balance owed by this customer
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
}
 
const money = (n: number) =>
  `LKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
 
export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxRate, setTaxRate] = useState(0); // stored as a fraction internally, e.g. 0.15
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [cashierId, setCashierId] = useState<string | null>(null);
 
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
 
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
 
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [showHeld, setShowHeld] = useState(false);
 
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'khata'>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [processing, setProcessing] = useState(false);
 
  const scanInputRef = useRef<HTMLInputElement>(null);
 
  useEffect(() => {
    loadAll();
    const focusShortcut = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        scanInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusShortcut);
    return () => window.removeEventListener('keydown', focusShortcut);
  }, []);
 
  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [productsRes, customersRes, settingsRes, userRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('store_settings').select('tax_rate, receipt_header, receipt_footer').eq('id', 'global_config').maybeSingle(),
        supabase.auth.getUser(),
      ]);
 
      if (productsRes.error) throw productsRes.error;
      if (customersRes.error) throw customersRes.error;
 
      setProducts(productsRes.data || []);
      setCustomers(customersRes.data || []);
      if (!settingsRes.error && settingsRes.data) {
        // store_settings.tax_rate is a whole percentage (15.0 = 15%) — convert to a fraction.
        setTaxRate(Number(settingsRes.data.tax_rate || 0) / 100);
        setReceiptHeader(settingsRes.data.receipt_header || '');
        setReceiptFooter(settingsRes.data.receipt_footer || '');
      }
      setCashierId(userRes.data?.user?.id || null);
    } catch (err: any) {
      console.error(err);
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
    } catch (e) {
      // Audio not supported — silent fail, not worth surfacing to the cashier
    }
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
    scanInputRef.current?.focus();
  };
 
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stock) {
          toast.custom(() => (
            <div className="bg-[#FDF3E7] border border-[#E8C89A] text-[#8A4B0B] px-4 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm font-medium">
              <AlertCircle size={18} /> Only {product.stock} left in stock
            </div>
          ), { duration: 2000 });
        }
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [{ product, quantity: 1 }, ...prev];
    });
    setSearchQuery('');
    scanInputRef.current?.focus();
  };
 
  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.product.id === productId) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
          }
          return item;
        })
        .filter(item => item.quantity > 0)
    );
    scanInputRef.current?.focus();
  };
 
  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    scanInputRef.current?.focus();
  };
 
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0),
    [cart]
  );
  const tax = subtotal * taxRate;
  const finalTotal = subtotal + tax;
 
  const cashChange = paymentMethod === 'cash' ? Math.max(0, Number(cashTendered || 0) - finalTotal) : 0;
 
  // ---- Hold / Resume -------------------------------------------------------
 
  const holdCurrentSale = () => {
    if (cart.length === 0) return toast.error('Cart is empty — nothing to hold.');
    const held: HeldSale = {
      id: crypto.randomUUID(),
      label: `${cart.length} item${cart.length > 1 ? 's' : ''} • ${money(subtotal)}`,
      cart,
      customerId: selectedCustomerId,
      heldAt: new Date().toLocaleTimeString(),
    };
    setHeldSales(prev => [held, ...prev]);
    setCart([]);
    setSelectedCustomerId('');
    toast.success('Sale held. Resume it any time before end of day.');
    scanInputRef.current?.focus();
  };
 
  const resumeHeldSale = (id: string) => {
    const held = heldSales.find(h => h.id === id);
    if (!held) return;
    if (cart.length > 0) {
      return toast.error('Clear or hold the current sale before resuming another.');
    }
    setCart(held.cart);
    setSelectedCustomerId(held.customerId);
    setHeldSales(prev => prev.filter(h => h.id !== id));
    setShowHeld(false);
    scanInputRef.current?.focus();
  };
 
  const deleteHeldSale = (id: string) => {
    setHeldSales(prev => prev.filter(h => h.id !== id));
  };
 
  // ---- Checkout --------------------------------------------------------
 
  const openPayment = () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    setPaymentMethod('cash');
    setCashTendered(finalTotal.toFixed(2));
    setShowPayment(true);
  };
 
  const printReceipt = (customer: Customer | undefined) => {
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');
    if (!receiptWindow) return;
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
            ${receiptHeader ? `<p style="margin: 2px 0; font-size: 11px;">${receiptHeader}</p>` : ''}
          </div>
          <div class="divider"></div>
          <p style="font-size: 10px; margin: 2px 0;">Date: ${new Date().toLocaleString()}</p>
          ${customer ? `<p style="font-size: 10px; margin: 2px 0;">Customer: ${customer.full_name}</p>` : ''}
          <p style="font-size: 10px; margin: 2px 0;">Payment: ${paymentMethod === 'cash' ? 'Cash' : 'Khata (Credit)'}</p>
          <div class="divider"></div>
          <div style="min-height: 50px;">
            ${cart.map(item => `
              <div class="item-row">
                <div>${item.product.name}</div>
                <div class="flex-between">
                  <span>${item.quantity} x ${money(item.product.selling_price)}</span>
                  <span>${money(item.product.selling_price * item.quantity)}</span>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="divider"></div>
          <div class="flex-between" style="font-size: 12px;"><span>Subtotal:</span><span>${money(subtotal)}</span></div>
          ${tax > 0 ? `<div class="flex-between" style="font-size: 12px;"><span>Tax:</span><span>${money(tax)}</span></div>` : ''}
          <div class="flex-between bold" style="font-size: 16px; margin-top: 5px;">
            <span>TOTAL:</span><span>${money(finalTotal)}</span>
          </div>
          ${paymentMethod === 'cash' ? `
            <div class="flex-between" style="font-size: 12px;"><span>Tendered:</span><span>${money(Number(cashTendered || 0))}</span></div>
            <div class="flex-between" style="font-size: 12px;"><span>Change:</span><span>${money(cashChange)}</span></div>
          ` : ''}
          <div class="divider"></div>
          <div class="text-center" style="font-size: 10px; margin-top: 10px;">
            <p>${receiptFooter || 'Thank you for your business!'}</p>
          </div>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    setTimeout(() => {
      receiptWindow.print();
      receiptWindow.close();
    }, 250);
  };
 
  const confirmCharge = async () => {
    if (paymentMethod === 'khata' && !selectedCustomerId) {
      return toast.error('Select a customer to charge this sale to their Khata account.');
    }
    if (paymentMethod === 'cash' && Number(cashTendered || 0) < finalTotal) {
      return toast.error('Amount tendered is less than the total due.');
    }
 
    setProcessing(true);
    try {
      const { data: saleRow, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_id: selectedCustomerId || null,
          cashier_id: cashierId,
          subtotal,
          tax,
          total: finalTotal,
          payment_method: paymentMethod,
          cash_tendered: paymentMethod === 'cash' ? Number(cashTendered) : null,
          change_due: paymentMethod === 'cash' ? cashChange : null,
        })
        .select()
        .single();
      if (saleError) throw saleError;
 
      const { error: itemsError } = await supabase.from('sale_items').insert(
        cart.map(item => ({
          sale_id: saleRow.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.selling_price,
          line_total: item.product.selling_price * item.quantity,
        }))
      );
      if (itemsError) throw itemsError;
 
      // Decrement stock. NOTE: sequential client-side updates are fine for a single-terminal
      // store, but if you ever run two registers at once, move this into a Postgres RPC
      // (e.g. `decrement_stock(product_id, qty)`) so concurrent sales can't oversell the same item.
      await Promise.all(
        cart.map(item =>
          supabase
            .from('products')
            .update({ stock: item.product.stock - item.quantity })
            .eq('id', item.product.id)
        )
      );
 
      if (paymentMethod === 'khata') {
        const customer = customers.find(c => c.id === selectedCustomerId);
        await supabase
          .from('customers')
          .update({ loan_balance: (customer?.loan_balance || 0) + finalTotal })
          .eq('id', selectedCustomerId);
      }
 
      printReceipt(customers.find(c => c.id === selectedCustomerId));
      toast.success('Transaction complete');
 
      setCart([]);
      setSelectedCustomerId('');
      setShowPayment(false);
      setCashTendered('');
      loadAll(); // refresh stock levels and customer balances
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Checkout failed — cart has not been cleared.');
    } finally {
      setProcessing(false);
    }
  };
 
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)));
  }, [searchQuery, products]);
 
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F7F5F1]">
        <div className="flex flex-col items-center gap-3 text-[#6B6A66]">
          <Loader2 className="animate-spin" size={32} />
          <p className="font-medium">Loading terminal…</p>
        </div>
      </div>
    );
  }
 
  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F7F5F1]">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <AlertCircle className="text-[#B91C1C]" size={32} />
          <p className="font-semibold text-[#1C1B19]">Couldn't load the terminal</p>
          <p className="text-sm text-[#6B6A66]">{loadError}</p>
          <button
            onClick={loadAll}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F6E5B] text-white font-semibold text-sm hover:bg-[#0B4F41] transition-colors"
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }
 
  return (
    <div className="h-full flex flex-col md:flex-row bg-[#F7F5F1] font-sans text-[#1C1B19]">
 
      {/* LEFT PANEL: Scanner & Cart */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
 
        {/* Scanner Bar */}
        <div className="relative bg-white p-4 shadow-sm z-20 border-b border-[#E7E3DB]">
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <form onSubmit={handleScanSubmit} className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Barcode className="text-[#A6A39A]" size={22} />
              </div>
              <input
                ref={scanInputRef}
                type="text"
                placeholder="Scan barcode or search — F2 to focus"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3.5 bg-[#F7F5F1] border-2 border-[#E7E3DB] rounded-xl text-lg font-medium focus:ring-4 focus:ring-[#0F6E5B]/15 focus:border-[#0F6E5B] focus:bg-white outline-none transition-all"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); scanInputRef.current?.focus(); }}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#A6A39A] hover:text-[#6B6A66]"
                >
                  <X size={18} />
                </button>
              )}
            </form>
 
            <button
              onClick={holdCurrentSale}
              title="Hold this sale"
              className="shrink-0 p-3.5 rounded-xl border-2 border-[#E7E3DB] text-[#6B6A66] hover:border-[#0F6E5B] hover:text-[#0F6E5B] transition-colors"
            >
              <PauseCircle size={22} />
            </button>
 
            <button
              onClick={() => setShowHeld(s => !s)}
              title="Held sales"
              className="relative shrink-0 p-3.5 rounded-xl border-2 border-[#E7E3DB] text-[#6B6A66] hover:border-[#0F6E5B] hover:text-[#0F6E5B] transition-colors"
            >
              <PlayCircle size={22} />
              {heldSales.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#B45309] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {heldSales.length}
                </span>
              )}
            </button>
          </div>
 
          {/* Search Dropdown */}
          {searchQuery && searchResults.length > 0 && (
            <div className="max-w-2xl mx-auto mt-2 bg-white rounded-xl shadow-2xl border border-[#E7E3DB] max-h-72 overflow-y-auto absolute left-4 right-4 md:left-0 md:right-0 z-50">
              {searchResults.map(product => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex items-center justify-between p-4 hover:bg-[#E4F3EF] cursor-pointer border-b border-[#F1EFEA] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-[#F1EFEA] p-2 rounded-lg text-[#6B6A66]"><Tag size={16} /></div>
                    <div>
                      <div className="font-bold text-[#1C1B19]">{product.name}</div>
                      <div className="text-xs text-[#6B6A66]">
                        Stock: <span className={product.stock <= 5 ? 'text-[#B91C1C] font-bold' : ''}>{product.stock}</span>
                        {product.barcode && ` • Code: ${product.barcode}`}
                      </div>
                    </div>
                  </div>
                  <div className="font-bold text-[#0F6E5B] font-['JetBrains_Mono']">{money(product.selling_price)}</div>
                </div>
              ))}
            </div>
          )}
 
          {/* Held Sales Panel */}
          {showHeld && (
            <div className="max-w-2xl mx-auto mt-2 bg-white rounded-xl shadow-2xl border border-[#E7E3DB] max-h-72 overflow-y-auto absolute left-4 right-4 md:left-0 md:right-0 z-50">
              {heldSales.length === 0 ? (
                <div className="p-6 text-center text-[#6B6A66] text-sm">No held sales.</div>
              ) : (
                heldSales.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-4 border-b border-[#F1EFEA]">
                    <div>
                      <div className="font-bold text-[#1C1B19]">{h.label}</div>
                      <div className="text-xs text-[#6B6A66]">Held at {h.heldAt}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => resumeHeldSale(h.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#0F6E5B] text-white text-xs font-bold hover:bg-[#0B4F41]"
                      >
                        Resume
                      </button>
                      <button onClick={() => deleteHeldSale(h.id)} className="text-[#A6A39A] hover:text-[#B91C1C]">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
 
        {/* Digital Receipt View */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E7E3DB] overflow-hidden min-h-full flex flex-col">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#E7E3DB] bg-[#FAF9F6] font-bold text-xs text-[#6B6A66] uppercase tracking-wider">
              <div className="col-span-6">Item</div>
              <div className="col-span-3 text-center">Qty</div>
              <div className="col-span-3 text-right">Total</div>
            </div>
 
            <div className="divide-y divide-dashed divide-[#E7E3DB] flex-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#A6A39A] p-12">
                  <ShoppingCart size={64} className="mb-4 opacity-30" />
                  <p className="text-xl font-semibold text-[#6B6A66] font-['Space_Grotesk']">Terminal ready</p>
                  <p className="text-sm mt-1">Scan a barcode to begin the sale</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#FAF9F6] transition-colors group">
                    <div className="col-span-6">
                      <div className="font-bold text-[#1C1B19] text-lg truncate">{item.product.name}</div>
                      <div className="text-sm text-[#6B6A66] font-['JetBrains_Mono']">@ {money(item.product.selling_price)}</div>
                    </div>
 
                    <div className="col-span-3 flex justify-center">
                      <div className="flex items-center gap-2 bg-white rounded-lg border border-[#E7E3DB] p-1">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1.5 hover:bg-[#FDECEC] hover:text-[#B91C1C] rounded text-[#6B6A66] transition-colors">
                          <Minus size={16} />
                        </button>
                        <span className="font-bold text-lg w-8 text-center font-['JetBrains_Mono']">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1.5 hover:bg-[#E4F3EF] hover:text-[#0F6E5B] rounded text-[#6B6A66] transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
 
                    <div className="col-span-3 flex items-center justify-end gap-3">
                      <span className="font-bold text-xl text-[#1C1B19] font-['JetBrains_Mono']">
                        {money(item.product.selling_price * item.quantity)}
                      </span>
                      <button onClick={() => removeFromCart(item.product.id)} className="text-[#D9D5CB] hover:text-[#B91C1C] transition-colors opacity-0 group-hover:opacity-100">
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
 
      {/* RIGHT PANEL: Checkout */}
      <div className="w-full md:w-[400px] bg-white border-l border-[#E7E3DB] flex flex-col h-full shadow-2xl z-10 relative">
 
        <div className="p-6 border-b border-[#F1EFEA] bg-[#FAF9F6]">
          <label className="text-xs font-bold text-[#6B6A66] uppercase tracking-wider mb-2 block">Link customer (optional)</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A6A39A]" size={18} />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 border border-[#E7E3DB] rounded-xl text-sm font-bold text-[#1C1B19] focus:border-[#0F6E5B] focus:ring-4 focus:ring-[#0F6E5B]/15 outline-none appearance-none bg-white transition-all"
            >
              <option value="">Walk-in customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
 
        <div className="p-6 grid grid-cols-2 gap-3 border-b border-[#F1EFEA]">
          <button onClick={() => setCart([])} disabled={cart.length === 0} className="py-3 px-4 rounded-xl font-bold text-sm bg-[#FDECEC] text-[#B91C1C] hover:bg-[#FBDCDC] disabled:opacity-40 transition-colors">
            Void sale
          </button>
          <button disabled title="Coming soon" className="py-3 px-4 rounded-xl font-bold text-sm bg-[#F1EFEA] text-[#A6A39A] cursor-not-allowed">
            Apply discount
          </button>
        </div>
 
        <div className="mt-auto p-6 bg-[#FAF9F6] flex flex-col gap-3 font-['JetBrains_Mono']">
          <div className="flex justify-between items-center text-[#6B6A66] text-sm font-medium">
            <span className="font-sans">Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-[#6B6A66] text-sm font-medium border-b border-dashed border-[#D9D5CB] pb-4">
            <span className="font-sans">Tax {taxRate > 0 ? `(${(taxRate * 100).toFixed(1)}%)` : ''}</span>
            <span>{money(tax)}</span>
          </div>
 
          <div className="flex justify-between items-end mt-2 mb-6">
            <span className="text-[#1C1B19] font-bold text-xl font-sans">Total due</span>
            <span className="text-4xl font-bold text-[#0F6E5B] tracking-tight">
              {money(finalTotal)}
            </span>
          </div>
 
          <button
            onClick={openPayment}
            disabled={cart.length === 0}
            className="w-full bg-[#1C1B19] hover:bg-black disabled:bg-[#D9D5CB] disabled:text-[#A6A39A] text-white py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] shadow-xl shadow-black/10 disabled:shadow-none font-sans"
          >
            <Receipt size={24} />
            Charge
          </button>
        </div>
      </div>
 
      {/* PAYMENT MODAL */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !processing && setShowPayment(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#F1EFEA]">
              <h3 className="font-bold text-xl font-['Space_Grotesk']">Take payment</h3>
              <p className="text-3xl font-bold text-[#0F6E5B] font-['JetBrains_Mono'] mt-1">{money(finalTotal)}</p>
            </div>
 
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 font-bold text-sm transition-colors ${paymentMethod === 'cash' ? 'border-[#0F6E5B] bg-[#E4F3EF] text-[#0F6E5B]' : 'border-[#E7E3DB] text-[#6B6A66]'}`}
                >
                  <Banknote size={22} /> Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('khata')}
                  className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 font-bold text-sm transition-colors ${paymentMethod === 'khata' ? 'border-[#B45309] bg-[#FDF3E7] text-[#B45309]' : 'border-[#E7E3DB] text-[#6B6A66]'}`}
                >
                  <BookUser size={22} /> Khata (credit)
                </button>
              </div>
 
              {paymentMethod === 'cash' ? (
                <div>
                  <label className="text-xs font-bold text-[#6B6A66] uppercase tracking-wider mb-2 block">Amount tendered</label>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={e => setCashTendered(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[#E7E3DB] rounded-xl text-lg font-bold font-['JetBrains_Mono'] focus:border-[#0F6E5B] outline-none"
                  />
                  <div className="flex justify-between mt-3 text-sm font-medium">
                    <span className="text-[#6B6A66]">Change due</span>
                    <span className="font-bold font-['JetBrains_Mono'] text-[#1C1B19]">{money(cashChange)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#8A4B0B] bg-[#FDF3E7] border border-[#E8C89A] rounded-xl p-3">
                  {selectedCustomerId
                    ? `${money(finalTotal)} will be added to ${customers.find(c => c.id === selectedCustomerId)?.full_name}'s Khata balance.`
                    : 'Select a customer on the right before charging to Khata.'}
                </div>
              )}
            </div>
 
            <div className="p-6 border-t border-[#F1EFEA] flex gap-3">
              <button
                onClick={() => setShowPayment(false)}
                disabled={processing}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-[#6B6A66] border-2 border-[#E7E3DB] hover:bg-[#FAF9F6] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCharge}
                disabled={processing}
                className="flex-[2] py-3 rounded-xl font-bold text-sm text-white bg-[#0F6E5B] hover:bg-[#0B4F41] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 className="animate-spin" size={18} /> : <Receipt size={18} />}
                {processing ? 'Processing…' : 'Confirm & print'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}