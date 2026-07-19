//@ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  ShoppingCart, Plus, Minus, X, User, Receipt, Barcode, Trash2, Tag,
  AlertCircle, PauseCircle, PlayCircle, Banknote, Wallet, Loader2,
  Phone, Award, LayoutGrid, Scale, Check, CreditCard,
  Wifi, WifiOff, Clock, ChevronRight, Coins
} from 'lucide-react';
 
// --- TYPES ---
interface Category { id: string; name: string; color: string; }
interface Product { id: string; category_id: string | null; name: string; barcode: string | null; selling_price: number; stock: number; weight_based?: boolean; }
interface Customer { id: string; full_name: string; phone: string | null; loyalty_points?: number; loan_balance?: number; }
interface CartItem { product: Product; quantity: number; }
interface HeldSale { id: string; label: string; cart: CartItem[]; customerId: string | null; heldAt: Date; discountType: 'flat' | 'percent'; discountValue: number; }
interface StoreSettings { tax_rate: number; receipt_header: string; receipt_footer: string; low_stock_threshold: number; }
 
const COINS = [1, 2, 5, 10];
const NOTES = [20, 50, 100, 500, 1000, 5000];
const money = (n: number) => `LKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
 
export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ tax_rate: 0, receipt_header: '', receipt_footer: '', low_stock_threshold: 5 });
  const [cashierId, setCashierId] = useState<string | null>(null);
 
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
 
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGrid, setShowGrid] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
 
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerNotFound, setCustomerNotFound] = useState(false);
 
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountDraft, setDiscountDraft] = useState<string>('');
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
 
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'loan'>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [cashNotes, setCashNotes] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);
 
  const scanInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
 
  useEffect(() => {
    loadAll();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);
 
  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [productsRes, categoriesRes, customersRes, settingsRes, userRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('customers').select('*').order('full_name'),
        supabase.from('store_settings').select('*').eq('id', 'global_config').maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (productsRes.error) throw productsRes.error;
      if (customersRes.error) throw customersRes.error;
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
      setCustomers(customersRes.data || []);
      if (settingsRes.data) {
        setSettings({
          tax_rate: Number(settingsRes.data.tax_rate || 0) / 100,
          receipt_header: settingsRes.data.receipt_header || '',
          receipt_footer: settingsRes.data.receipt_footer || '',
          low_stock_threshold: Number(settingsRes.data.low_stock_threshold || 5),
        });
      }
      setCashierId(userRes.data?.user?.id || null);
    } catch (err: any) {
      console.error(err);
      setLoadError(err.message || 'Database connection failed. Are you offline?');
      toast.error('Failed to sync terminal data.');
    } finally {
      setLoading(false);
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  };
 
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (showPayment) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!processing) confirmCharge();
          return;
        }
        if (e.key === 'Escape' && !processing) {
          e.preventDefault();
          setShowPayment(false);
          scanInputRef.current?.focus();
          return;
        }
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) openPayment();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && window.confirm('Void this current transaction?')) voidSale();
      } else if (e.key === 'F9') {
        e.preventDefault();
        setShowGrid(s => !s);
      } else if (e.key === 'Escape' && showHeldModal) {
        setShowHeldModal(false);
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, showPayment, processing, showHeldModal, paymentMethod, cashTendered, selectedCustomer, discountValue, discountType]);
 
  const playBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) { /* ignore */ }
  }, []);
 
  const parseSupermarketBarcode = (barcode: string) => {
    if ((barcode.startsWith('20') || barcode.startsWith('21') || barcode.startsWith('02')) && barcode.length === 13) {
      const itemCode = barcode.substring(2, 7);
      const weightData = barcode.substring(7, 12);
      const weight = Number(weightData) / 1000;
      const product = products.find(p => p.barcode && p.barcode.endsWith(itemCode));
      if (product) return { product, weight };
    }
    return null;
  };
 
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim().toLowerCase();
    let match = products.find(p => p.barcode?.toLowerCase() === query);
    let qtyToAdd = 1;
    if (!match && query.length === 13) {
      const parsed = parseSupermarketBarcode(query);
      if (parsed) { match = parsed.product; qtyToAdd = parsed.weight; }
    }
    if (!match) match = products.find(p => p.name.toLowerCase() === query);
    if (match) {
      playBeep();
      addToCart(match, qtyToAdd);
    } else {
      toast.error('Item not found in database.');
    }
    setSearchQuery('');
  };
 
  useEffect(() => {
    if (searchQuery.length >= 8) {
      const exactMatch = products.find(p => p.barcode === searchQuery);
      if (exactMatch) {
        playBeep();
        addToCart(exactMatch, 1);
        setSearchQuery('');
        return;
      }
      if (searchQuery.length === 13) {
        const parsed = parseSupermarketBarcode(searchQuery);
        if (parsed) {
          playBeep();
          addToCart(parsed.product, parsed.weight);
          setSearchQuery('');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, products]);
 
  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [{ product, quantity }, ...prev];
    });
    scanInputRef.current?.focus();
  };
 
  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Number((item.quantity + delta).toFixed(3));
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };
 
  const setExactQuantity = (productId: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    if (num <= 0) return removeFromCart(productId);
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: num } : i));
  };
 
  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.product.id !== productId));
 
  const voidSale = () => {
    setCart([]);
    setDiscountValue(0);
    setDiscountType('flat');
    setShowDiscountPanel(false);
    clearCustomer();
    scanInputRef.current?.focus();
  };
 
  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = customerQuery.trim();
    if (!q) return;
    const match = customers.find(c => c.phone && c.phone === q);
    if (match) {
      setSelectedCustomer(match);
      setCustomerQuery('');
      setCustomerNotFound(false);
    } else {
      setCustomerNotFound(true);
      toast.error('No customer found with that phone number.');
    }
  };
 
  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
    setCustomerNotFound(false);
  };
 
  const openDiscountPanel = () => {
    setDiscountDraft(discountValue > 0 ? discountValue.toString() : '');
    setShowDiscountPanel(true);
  };
 
  const applyDiscount = () => {
    const num = parseFloat(discountDraft);
    if (isNaN(num) || num < 0) return toast.error('Enter a valid amount.');
    if (discountType === 'percent' && num > 100) return toast.error('Percentage cannot exceed 100%.');
    setDiscountValue(num);
    setShowDiscountPanel(false);
  };
 
  const clearDiscount = () => {
    setDiscountValue(0);
    setDiscountDraft('');
    setShowDiscountPanel(false);
  };
 
  const holdCurrentSale = () => {
    if (cart.length === 0) return toast.error('Cart is empty.');
    const held: HeldSale = {
      id: crypto.randomUUID(),
      label: selectedCustomer ? `${selectedCustomer.full_name}'s Order` : `Order #${heldSales.length + 1}`,
      cart: [...cart],
      customerId: selectedCustomer?.id || null,
      heldAt: new Date(),
      discountType,
      discountValue,
    };
    setHeldSales(prev => [held, ...prev]);
    voidSale();
    toast.success('Sale parked successfully.');
  };
 
  const resumeHeldSale = (id: string) => {
    if (cart.length > 0) return toast.error('Please complete or void the current sale first.');
    const held = heldSales.find(h => h.id === id);
    if (!held) return;
    setCart(held.cart);
    setDiscountType(held.discountType);
    setDiscountValue(held.discountValue);
    if (held.customerId) {
      const cust = customers.find(c => c.id === held.customerId);
      if (cust) setSelectedCustomer(cust);
    }
    setHeldSales(prev => prev.filter(h => h.id !== id));
    setShowHeldModal(false);
  };
 
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0), [cart]);
 
  const discountAmount = useMemo(() => {
    if (discountValue === 0) return 0;
    if (discountType === 'flat') return discountValue;
    return subtotal * (discountValue / 100);
  }, [subtotal, discountValue, discountType]);
 
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * settings.tax_rate;
  const finalTotal = taxableAmount + taxAmount;
  const cashChange = paymentMethod === 'cash' ? Math.max(0, Number(cashTendered || 0) - finalTotal) : 0;
 
  const noteBreakdown = useMemo(() => {
    const counts: Record<number, number> = {};
    cashNotes.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
    return Object.entries(counts).map(([denom, count]) => ({ denom: Number(denom), count })).sort((a, b) => b.denom - a.denom);
  }, [cashNotes]);
 
  const tapDenomination = (denom: number) => {
    setCashNotes(prev => [...prev, denom]);
    setCashTendered(prev => (Number(prev || 0) + denom).toFixed(2));
  };
 
  const openPayment = () => {
    if (cart.length === 0) return;
    setPaymentMethod('cash');
    setCashTendered('');
    setCashNotes([]);
    setShowPayment(true);
    setTimeout(() => cashInputRef.current?.focus(), 100);
  };
 
  const confirmCharge = async () => {
    if (cart.length === 0 || processing) return;
    if (paymentMethod === 'loan' && !selectedCustomer) return toast.error('Customer required for loan charge.');
    if (paymentMethod === 'cash' && Number(cashTendered || 0) < finalTotal) return toast.error('Insufficient cash tendered.');
 
    setProcessing(true);
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');
 
    try {
      const { data: saleRow, error: saleError } = await supabase.from('sales').insert({
        customer_id: selectedCustomer?.id || null,
        cashier_id: cashierId,
        subtotal,
        tax: taxAmount,
        discount_amount: discountAmount,
        total: finalTotal,
        payment_method: paymentMethod,
        cash_tendered: paymentMethod === 'cash' ? Number(cashTendered) : null,
        change_due: paymentMethod === 'cash' ? cashChange : null,
      }).select().single();
      if (saleError) throw saleError;
 
      const saleItems = cart.map(item => ({
        sale_id: saleRow.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.selling_price,
        line_total: item.product.selling_price * item.quantity,
      }));
      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;
 
      await Promise.all(
        cart.map(item => supabase.from('products').update({ stock: item.product.stock - item.quantity }).eq('id', item.product.id))
      );
 
      let newLoanBalance = selectedCustomer?.loan_balance || 0;
      let newPoints = selectedCustomer?.loyalty_points || 0;
 
      if (selectedCustomer) {
        if (paymentMethod === 'loan') newLoanBalance += finalTotal;
        else newPoints += Math.floor(finalTotal / 100);
        await supabase.from('customers').update({ loan_balance: newLoanBalance, loyalty_points: newPoints }).eq('id', selectedCustomer.id);
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, loan_balance: newLoanBalance, loyalty_points: newPoints } : c));
      }
 
      if (receiptWindow) {
        const dStr = discountAmount > 0 ? `<div class="flex-between"><span>Discount / Offer:</span><span>-${money(discountAmount)}</span></div>` : '';
        const taxStr = taxAmount > 0 ? `<div class="flex-between"><span>Tax (${(settings.tax_rate * 100).toFixed(1)}%):</span><span>${money(taxAmount)}</span></div>` : '';
        const loanStr = paymentMethod === 'loan' ? `<div class="divider"></div><div class="flex-between bold"><span>NEW LOAN BALANCE:</span><span>${money(newLoanBalance)}</span></div>` : '';
        const loyaltyStr = (selectedCustomer && paymentMethod !== 'loan') ? `<div class="text-center" style="font-size:10px; margin-top:5px;">Loyalty Points Earned: ${Math.floor(finalTotal / 100)} | Total: ${newPoints}</div>` : '';
        const notesStr = paymentMethod === 'cash' && noteBreakdown.length > 0
          ? `<div style="font-size: 10px; margin-top: 3px;">Cash given: ${noteBreakdown.map(n => `${n.count} x LKR ${n.denom}`).join(', ')}</div>`
          : '';
 
        receiptWindow.document.write(`
          <html>
            <head>
              <title>Receipt - ${saleRow.id}</title>
              <style>
                @page { margin: 0; }
                body { font-family: 'Courier New', monospace; padding: 5mm; width: 72mm; margin: 0 auto; color: #000; font-size: 12px; }
                .text-center { text-align: center; }
                .divider { border-top: 1px dashed #000; margin: 8px 0; }
                .flex-between { display: flex; justify-content: space-between; margin-bottom: 3px; }
                .bold { font-weight: bold; }
                .small { font-size: 10px; }
              </style>
            </head>
            <body>
              <div class="text-center">
                <h2 style="margin: 0; font-size: 18px;">AHAMED'S KADE</h2>
                ${settings.receipt_header ? `<p style="margin: 2px 0; font-size:11px;">${settings.receipt_header.replace(/\n/g, '<br>')}</p>` : ''}
              </div>
              <div class="divider"></div>
              <div class="flex-between small"><span>Date: ${new Date().toLocaleDateString()}</span><span>${formatTime(new Date())}</span></div>
              <div class="flex-between small"><span>Receipt: #${saleRow.id.substring(0, 8)}</span></div>
              ${selectedCustomer ? `<div class="small" style="margin-top:3px;">Customer: ${selectedCustomer.full_name}</div>` : ''}
              <div class="small" style="margin-top:3px;">Payment: <span class="bold">${paymentMethod.toUpperCase()}</span></div>
              <div class="divider"></div>
              <table style="width: 100%; font-size: 11px; text-align: left; border-collapse: collapse;">
                <tr><th style="padding-bottom:4px;">Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Total</th></tr>
                ${cart.map(item => `
                  <tr>
                    <td style="padding-bottom:3px;">${item.product.name}</td>
                    <td style="text-align:center;">${item.product.weight_based ? item.quantity.toFixed(3) + 'kg' : item.quantity}</td>
                    <td style="text-align:right;">${(item.product.selling_price * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </table>
              <div class="divider"></div>
              <div class="flex-between"><span>Subtotal:</span><span>${money(subtotal)}</span></div>
              ${dStr}
              ${taxStr}
              <div class="flex-between bold" style="font-size: 16px; margin-top: 5px;">
                <span>TOTAL:</span><span>${money(finalTotal)}</span>
              </div>
              ${paymentMethod === 'cash' ? `
                <div class="flex-between" style="margin-top: 5px; font-size: 11px;"><span>Cash Tendered:</span><span>${money(Number(cashTendered))}</span></div>
                <div class="flex-between bold"><span>CHANGE:</span><span>${money(cashChange)}</span></div>
                ${notesStr}
              ` : ''}
              ${loanStr}
              ${loyaltyStr}
              <div class="divider"></div>
              <div class="text-center small">
                <p>${settings.receipt_footer || 'Thank you for shopping with us!'}</p>
                <p>* Please keep receipt for returns *</p>
              </div>
            </body>
          </html>
        `);
        receiptWindow.document.close();
        setTimeout(() => { receiptWindow.print(); receiptWindow.close(); }, 400);
      }
 
      toast.success('Transaction successful!');
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.product.id === p.id);
        return cartItem ? { ...p, stock: p.stock - cartItem.quantity } : p;
      }));
      voidSale();
      setShowPayment(false);
    } catch (err: any) {
      console.error(err);
      if (receiptWindow) receiptWindow.close();
      toast.error('Transaction failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };
 
  const gridProducts = useMemo(() => {
    let filtered = activeCategory ? products.filter(p => p.category_id === activeCategory) : products;
    if (searchQuery && showGrid) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.includes(q));
    }
    return filtered;
  }, [products, activeCategory, searchQuery, showGrid]);
 
  const searchDropdownResults = useMemo(() => {
    if (!searchQuery || showGrid) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.includes(q));
  }, [searchQuery, products, showGrid]);
 
  if (loading || loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F7F5F1]">
        <div className="flex flex-col items-center gap-4 text-[#6B6A66] p-8 bg-white rounded-2xl shadow-xl max-w-sm text-center">
          {loading ? <Loader2 className="animate-spin text-[#0F6E5B]" size={48} /> : <WifiOff className="text-red-600" size={48} />}
          <h2 className="text-xl font-bold text-black">{loading ? 'Starting Terminal...' : 'Connection Offline'}</h2>
          <p className="text-sm">{loading ? 'Syncing products, customers, and settings.' : loadError}</p>
          {loadError && <button onClick={loadAll} className="w-full py-3 mt-2 bg-[#0F6E5B] text-white font-bold rounded-xl shadow-lg hover:bg-[#0B4F41]">Retry Connection</button>}
        </div>
      </div>
    );
  }
 
  return (
    <div className="h-full flex flex-col bg-[#F7F5F1] font-sans text-[#1C1B19] select-none">
      <header className="bg-[#0F6E5B] text-white px-4 py-2 flex justify-between items-center z-30 shadow-md">
        <div className="flex items-center gap-4">
          <div className="font-bold text-xl tracking-tight flex items-center gap-2">
            <ShoppingCart size={20} /> Ahamed's Kade POS
          </div>
          <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${isOnline ? 'bg-green-500/20 text-green-100' : 'bg-red-500 text-white'}`}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />} {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="flex items-center gap-1 opacity-80"><Clock size={16} /> {formatTime(currentTime)}</div>
        </div>
      </header>
 
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="bg-white p-4 shadow-sm z-20 border-b border-[#E7E3DB] flex gap-3 items-center">
            <form onSubmit={handleScanSubmit} className="relative flex-1">
              <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0F6E5B]" size={24} />
              <input
                ref={scanInputRef}
                type="text"
                placeholder="Scan barcode or search item (F2)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3.5 bg-gray-50 border-2 border-[#E7E3DB] rounded-xl font-bold text-lg focus:border-[#0F6E5B] focus:bg-white outline-none transition-all placeholder:font-normal"
                autoFocus
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                  <X size={20} />
                </button>
              )}
            </form>
            <button onClick={() => setShowGrid(s => !s)} title="Toggle grid (F9)" className={`p-4 rounded-xl border-2 transition-all ${showGrid ? 'border-[#0F6E5B] bg-[#E4F3EF] text-[#0F6E5B] shadow-inner' : 'border-[#E7E3DB] bg-white hover:bg-gray-50'}`}>
              <LayoutGrid size={24} />
            </button>
            <div className="h-10 w-px bg-gray-200 mx-1" />
            <button onClick={holdCurrentSale} title="Hold sale" className="p-4 rounded-xl border-2 border-[#E7E3DB] bg-white hover:text-orange-600 hover:border-orange-200 transition-colors">
              <PauseCircle size={24} />
            </button>
            <button onClick={() => setShowHeldModal(true)} title="View held sales" className="relative p-4 rounded-xl border-2 border-[#E7E3DB] bg-white hover:text-[#0F6E5B] transition-colors">
              <PlayCircle size={24} />
              {heldSales.length > 0 && <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md">{heldSales.length}</span>}
            </button>
          </div>
 
          {searchDropdownResults.length > 0 && (
            <div className="absolute top-20 left-4 right-4 md:right-[436px] bg-white rounded-xl shadow-2xl z-50 border border-gray-200 max-h-96 overflow-y-auto">
              {searchDropdownResults.map(p => (
                <button key={p.id} onClick={() => { addToCart(p); setSearchQuery(''); }} className="w-full text-left p-4 border-b hover:bg-[#E4F3EF] flex justify-between items-center group">
                  <div>
                    <div className="font-bold text-lg group-hover:text-[#0F6E5B]">{p.name}</div>
                    <div className="text-sm text-gray-500 flex gap-4">
                      <span>{p.barcode || 'No barcode'}</span>
                      <span className={p.stock <= settings.low_stock_threshold ? 'text-red-600 font-bold' : ''}>Stock: {p.stock}</span>
                    </div>
                  </div>
                  <div className="font-bold text-xl">{money(p.selling_price)}{p.weight_based ? '/kg' : ''}</div>
                </button>
              ))}
            </div>
          )}
 
          {showGrid && (
            <div className="bg-white border-b border-[#E7E3DB] flex flex-col h-1/2 shadow-inner z-10">
              <div className="flex gap-2 overflow-x-auto p-3 border-b bg-gray-50">
                <button onClick={() => setActiveCategory(null)} className={`px-5 py-2.5 rounded-full font-bold border-2 transition-all whitespace-nowrap ${!activeCategory ? 'bg-black text-white border-black shadow-md' : 'border-gray-200 bg-white text-gray-600'}`}>All Items</button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setActiveCategory(c.id)} className="px-5 py-2.5 rounded-full font-bold border-2 transition-all whitespace-nowrap bg-white" style={activeCategory === c.id ? { backgroundColor: c.color, color: '#fff', borderColor: c.color } : { color: c.color, borderColor: '#e5e7eb' }}>
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {gridProducts.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} className="text-left p-3 rounded-2xl border-2 border-gray-100 bg-white hover:border-[#0F6E5B] hover:shadow-lg transition-all relative group flex flex-col h-full">
                    {p.stock <= settings.low_stock_threshold && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />}
                    <div className="font-bold text-sm leading-tight flex-1 group-hover:text-[#0F6E5B] flex items-center gap-1">
                      {p.weight_based && <Scale size={12} className="shrink-0 text-gray-400" />} {p.name}
                    </div>
                    <div className="text-xs font-bold text-gray-400 mt-2">{p.barcode || '-'}</div>
                    <div className="text-sm font-black text-[#0F6E5B] mt-1">{money(p.selling_price)}{p.weight_based ? '/kg' : ''}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
 
          <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 min-h-full flex flex-col">
              <div className="grid grid-cols-12 gap-2 p-3 border-b bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider rounded-t-2xl">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-5">Item Details</div>
                <div className="col-span-3 text-center">Quantity</div>
                <div className="col-span-3 text-right pr-2">Line Total</div>
              </div>
              <div className="divide-y divide-gray-100 flex-1">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 min-h-[300px]">
                    <ShoppingCart size={64} className="mb-4 text-gray-300" />
                    <p className="text-xl font-bold text-gray-500">Scan items to begin</p>
                    <p className="text-sm mt-2">Ready for next customer</p>
                  </div>
                ) : cart.map((item, index) => (
                  <div key={item.product.id} className={`grid grid-cols-12 gap-2 p-3 items-center group transition-colors ${item.product.stock < item.quantity ? 'bg-red-50' : 'hover:bg-[#F8FCFB]'}`}>
                    <div className="col-span-1 text-center text-sm font-bold text-gray-400">{index + 1}</div>
                    <div className="col-span-5">
                      <div className="font-bold text-gray-900 leading-tight">{item.product.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-[#0F6E5B] font-bold">@ {item.product.selling_price.toFixed(2)}{item.product.weight_based ? '/kg' : ''}</span>
                        {item.product.stock <= settings.low_stock_threshold && (
                          <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Low Stock ({item.product.stock})</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-3 flex justify-center">
                      <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 p-0.5 shadow-sm">
                        <button onClick={() => updateQuantity(item.product.id, item.product.weight_based ? -0.05 : -1)} className="p-2 hover:bg-white hover:text-red-600 rounded-lg transition-colors"><Minus size={16} strokeWidth={3} /></button>
                        <input
                          type="number"
                          step={item.product.weight_based ? 0.05 : 1}
                          value={item.quantity}
                          onChange={e => setExactQuantity(item.product.id, e.target.value)}
                          className="font-bold w-14 text-center text-lg bg-transparent outline-none"
                        />
                        <button onClick={() => updateQuantity(item.product.id, item.product.weight_based ? 0.05 : 1)} className="p-2 hover:bg-white hover:text-[#0F6E5B] rounded-lg transition-colors"><Plus size={16} strokeWidth={3} /></button>
                      </div>
                    </div>
                    <div className="col-span-3 flex justify-end items-center gap-3 pr-2">
                      <span className="font-black text-lg">{money(item.product.selling_price * item.quantity)}</span>
                      <button onClick={() => removeFromCart(item.product.id)} className="p-2 text-gray-300 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={20} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
 
        <div className="w-full md:w-[420px] bg-white border-l border-[#E7E3DB] flex flex-col h-full shadow-2xl z-30">
          <div className="p-5 border-b border-gray-100 bg-white">
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 block">Customer</label>
            {selectedCustomer ? (
              <div className="bg-[#F8FCFB] border-2 border-[#0F6E5B]/20 rounded-2xl p-4 relative">
                <button onClick={clearCustomer} className="absolute top-3 right-3 text-gray-400 hover:text-red-600 bg-white p-1 rounded-full shadow-sm"><X size={16} /></button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0F6E5B] text-white flex items-center justify-center font-bold text-lg">{selectedCustomer.full_name.charAt(0)}</div>
                  <div>
                    <div className="font-bold text-lg leading-tight">{selectedCustomer.full_name}</div>
                    <div className="text-sm text-gray-500 font-medium">{selectedCustomer.phone}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-200">
                  <div className="bg-white p-2 rounded-xl border text-center shadow-sm">
                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Loyalty Pts</div>
                    <div className="font-black text-orange-600 flex items-center justify-center gap-1"><Award size={14} /> {selectedCustomer.loyalty_points || 0}</div>
                  </div>
                  <div className={`bg-white p-2 rounded-xl border text-center shadow-sm ${selectedCustomer.loan_balance && selectedCustomer.loan_balance > 0 ? 'border-red-200' : ''}`}>
                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Loan Owed</div>
                    <div className={`font-black flex items-center justify-center gap-1 ${selectedCustomer.loan_balance && selectedCustomer.loan_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <Wallet size={14} /> {money(selectedCustomer.loan_balance || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCustomerSubmit} className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  ref={customerInputRef}
                  type="tel"
                  value={customerQuery}
                  onChange={e => { setCustomerQuery(e.target.value); setCustomerNotFound(false); }}
                  placeholder="Phone number, then Enter"
                  className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 rounded-2xl font-bold focus:bg-white outline-none transition-all placeholder:font-normal ${customerNotFound ? 'border-red-300' : 'border-gray-200 focus:border-[#0F6E5B]'}`}
                />
              </form>
            )}
          </div>
 
          <div className="p-4 grid grid-cols-2 gap-3 border-b border-gray-100 bg-gray-50/50 relative">
            <button onClick={voidSale} disabled={cart.length === 0} className="py-3 rounded-xl font-bold text-sm bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              <Trash2 size={18} /> Void Sale (F8)
            </button>
            <button onClick={openDiscountPanel} disabled={cart.length === 0} className="py-3 rounded-xl font-bold text-sm bg-white border border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              <Tag size={18} /> {discountValue > 0 ? 'Edit Discount' : 'Add Discount'}
            </button>
 
            {showDiscountPanel && (
              <div className="absolute top-full left-4 right-4 mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl z-40 p-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button onClick={() => setDiscountType('flat')} className={`py-2 rounded-lg font-bold text-sm border-2 ${discountType === 'flat' ? 'border-[#0F6E5B] bg-[#E4F3EF] text-[#0F6E5B]' : 'border-gray-200 text-gray-500'}`}>Flat (LKR)</button>
                  <button onClick={() => setDiscountType('percent')} className={`py-2 rounded-lg font-bold text-sm border-2 ${discountType === 'percent' ? 'border-[#0F6E5B] bg-[#E4F3EF] text-[#0F6E5B]' : 'border-gray-200 text-gray-500'}`}>Percent (%)</button>
                </div>
                <input
                  type="number"
                  autoFocus
                  value={discountDraft}
                  onChange={e => setDiscountDraft(e.target.value)}
                  placeholder={discountType === 'flat' ? 'e.g. 100' : 'e.g. 10'}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg font-bold focus:border-[#0F6E5B] outline-none mb-3"
                />
                <div className="flex gap-2">
                  <button onClick={clearDiscount} className="flex-1 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">Remove</button>
                  <button onClick={applyDiscount} className="flex-[2] py-2 rounded-lg font-bold text-sm bg-[#0F6E5B] text-white hover:bg-[#0B4F41]">Apply</button>
                </div>
              </div>
            )}
          </div>
 
          <div className="mt-auto p-6 bg-white flex flex-col gap-3">
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-gray-500 font-medium text-sm"><span>Subtotal ({cart.length} items)</span><span>{money(subtotal)}</span></div>
              {discountValue > 0 && (
                <div className="flex justify-between text-blue-600 font-bold text-sm bg-blue-50 p-2 rounded-lg">
                  <span className="flex items-center gap-1"><Tag size={14} /> Discount ({discountType === 'percent' ? `${discountValue}%` : 'Flat'})</span>
                  <span>-{money(discountAmount)}</span>
                </div>
              )}
              {settings.tax_rate > 0 && (
                <div className="flex justify-between text-gray-500 font-medium text-sm border-b border-dashed border-gray-200 pb-4">
                  <span>Tax ({(settings.tax_rate * 100).toFixed(1)}%)</span>
                  <span>{money(taxAmount)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-end mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <span className="font-black text-gray-400 uppercase tracking-widest text-sm mb-1">Total Due</span>
              <span className="text-4xl font-black text-[#0F6E5B] tracking-tight">{money(finalTotal)}</span>
            </div>
            <button onClick={openPayment} disabled={cart.length === 0} className="w-full bg-[#1C1B19] hover:bg-black disabled:bg-gray-300 text-white py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-xl transition-all">
              PAY NOW (F4) <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </div>
 
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => !processing && setShowPayment(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
            <div className="w-full md:w-1/3 bg-gray-50 p-6 border-r flex flex-col gap-3">
              <h3 className="font-black text-gray-400 uppercase tracking-widest text-xs mb-2">Payment Method</h3>
              <button onClick={() => setPaymentMethod('cash')} className={`py-4 px-4 rounded-2xl border-2 font-bold flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'cash' ? 'border-[#0F6E5B] bg-white text-[#0F6E5B] shadow-md scale-105' : 'border-transparent hover:bg-gray-200 text-gray-600'}`}>
                <Banknote size={32} /> Cash
              </button>
              <button onClick={() => setPaymentMethod('card')} className={`py-4 px-4 rounded-2xl border-2 font-bold flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'card' ? 'border-[#0F6E5B] bg-white text-[#0F6E5B] shadow-md scale-105' : 'border-transparent hover:bg-gray-200 text-gray-600'}`}>
                <CreditCard size={32} /> Card
              </button>
              <button onClick={() => setPaymentMethod('loan')} className={`py-4 px-4 rounded-2xl border-2 font-bold flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'loan' ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-md scale-105' : 'border-transparent hover:bg-gray-200 text-gray-600'}`}>
                <Wallet size={32} /> Loan
              </button>
            </div>
            <div className="w-full md:w-2/3 flex flex-col bg-white">
              <div className="p-8 flex-1 flex flex-col justify-center overflow-y-auto max-h-[70vh]">
                <div className="text-center mb-6">
                  <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Amount Due</div>
                  <div className="text-5xl font-black text-[#0F6E5B]">{money(finalTotal)}</div>
                </div>
                {paymentMethod === 'cash' && (
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Coins size={14} /> Coins</div>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {COINS.map(n => (
                        <button key={n} onClick={() => tapDenomination(n)} className="py-3 rounded-full border-2 border-[#0F6E5B]/20 bg-[#F8FCFB] text-[#0F6E5B] font-bold hover:bg-[#0F6E5B] hover:text-white transition-colors shadow-sm">
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Banknote size={14} /> Notes</div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {NOTES.map(n => (
                        <button key={n} onClick={() => tapDenomination(n)} className="py-3 rounded-xl border-2 border-[#0F6E5B]/20 bg-[#F8FCFB] text-[#0F6E5B] font-bold text-lg hover:bg-[#0F6E5B] hover:text-white transition-colors shadow-sm">
                          {n}
                        </button>
                      ))}
                    </div>
                    {noteBreakdown.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {noteBreakdown.map(n => (
                          <span key={n.denom} className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{n.count} x {n.denom}</span>
                        ))}
                        <button onClick={() => { setCashNotes([]); setCashTendered(''); }} className="text-xs font-bold text-red-500 px-2 py-1 hover:underline">Clear</button>
                      </div>
                    )}
                    <div className="relative mb-6">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none font-bold text-gray-400">LKR</div>
                      <input
                        ref={cashInputRef}
                        type="number"
                        value={cashTendered}
                        onChange={e => { setCashTendered(e.target.value); setCashNotes([]); }}
                        className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-3xl font-black focus:border-[#0F6E5B] focus:bg-white outline-none transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div className={`flex justify-between items-center p-5 rounded-2xl border-2 transition-colors ${cashChange > 0 ? 'bg-green-50 border-green-200 text-green-800' : Number(cashTendered || 0) < finalTotal && Number(cashTendered || 0) > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                      <span className="font-bold text-lg uppercase tracking-wider">Change Due</span>
                      <span className="font-black text-3xl">{money(cashChange)}</span>
                    </div>
                  </div>
                )}
                {paymentMethod === 'card' && (
                  <div className="text-center p-8 bg-blue-50 border-2 border-blue-100 rounded-2xl">
                    <CreditCard size={64} className="mx-auto text-blue-400 mb-4" />
                    <h3 className="font-bold text-blue-900 text-xl">Process on terminal</h3>
                    <p className="text-blue-700 mt-2">Swipe, insert, or tap on the card machine, then confirm below once approved.</p>
                  </div>
                )}
                {paymentMethod === 'loan' && (
                  <div className={`text-center p-8 border-2 rounded-2xl ${selectedCustomer ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
                    <Wallet size={64} className={`mx-auto mb-4 ${selectedCustomer ? 'text-orange-400' : 'text-red-400'}`} />
                    {selectedCustomer ? (
                      <>
                        <h3 className="font-bold text-orange-900 text-xl">{selectedCustomer.full_name}'s Account</h3>
                        <p className="text-orange-700 mt-2 font-medium">New balance will be: <span className="font-black">{money((selectedCustomer.loan_balance || 0) + finalTotal)}</span></p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-bold text-red-900 text-xl">No customer assigned</h3>
                        <p className="text-red-700 mt-2">Cancel and look up a customer to charge to their loan.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 border-t bg-gray-50 flex gap-4">
                <button onClick={() => setShowPayment(false)} disabled={processing} className="px-8 py-4 rounded-2xl font-bold bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                <button
                  onClick={confirmCharge}
                  disabled={processing || (paymentMethod === 'loan' && !selectedCustomer) || (paymentMethod === 'cash' && Number(cashTendered || 0) < finalTotal)}
                  className="flex-1 py-4 rounded-2xl font-black text-white bg-[#0F6E5B] hover:bg-[#0B4F41] disabled:opacity-50 flex items-center justify-center gap-3 text-xl shadow-lg transition-all"
                >
                  {processing ? <><Loader2 className="animate-spin" size={24} /> Processing...</> : <><Check size={28} /> Complete Sale (Enter)</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
 
      {showHeldModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowHeldModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-3xl">
              <h2 className="font-black text-2xl flex items-center gap-2"><Clock size={28} className="text-orange-600" /> Parked Sales</h2>
              <button onClick={() => setShowHeldModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-200 shadow-sm"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {heldSales.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <PauseCircle size={64} className="mx-auto mb-4 opacity-50" />
                  <p className="text-xl font-bold">No parked sales</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {heldSales.map(sale => (
                    <div key={sale.id} className="border-2 border-gray-100 rounded-2xl p-5 hover:border-orange-200 transition-colors flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-lg">{sale.label}</h4>
                        <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                          <span><Clock size={14} className="inline mr-1" /> {formatTime(sale.heldAt)}</span>
                          <span><ShoppingCart size={14} className="inline mr-1" /> {sale.cart.length} items</span>
                          <span className="font-bold text-[#0F6E5B]">{money(sale.cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0))}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setHeldSales(p => p.filter(h => h.id !== sale.id))} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Delete">
                          <Trash2 size={20} />
                        </button>
                        <button onClick={() => resumeHeldSale(sale.id)} className="px-6 py-3 bg-orange-100 text-orange-700 font-bold rounded-xl hover:bg-orange-500 hover:text-white transition-colors flex items-center gap-2 shadow-sm">
                          <PlayCircle size={20} /> Resume
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}