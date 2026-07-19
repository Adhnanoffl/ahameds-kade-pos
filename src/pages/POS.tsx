//@ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  ShoppingCart, Plus, Minus, X, User, Receipt, Barcode, Trash2, Tag,
  AlertCircle, PauseCircle, PlayCircle, Banknote, Wallet, Loader2,
  Phone, Award, LayoutGrid, Scale, Check, Percent, CreditCard, UserPlus,
  Wifi, WifiOff, Clock, Search, ChevronRight, Hash, Edit3
} from 'lucide-react';

// --- TYPES ---
interface Category { id: string; name: string; color: string; }
interface Product { id: string; category_id: string | null; name: string; barcode: string | null; selling_price: number; stock: number; weight_based?: boolean; }
interface Customer { id: string; full_name: string; phone: string | null; loyalty_points?: number; loan_balance?: number; }
interface CartItem { product: Product; quantity: number; note?: string; }
interface HeldSale { id: string; label: string; cart: CartItem[]; customerId: string | null; heldAt: Date; discountType: 'flat' | 'percent'; discountValue: number; }
interface StoreSettings { tax_rate: number; receipt_header: string; receipt_footer: string; low_stock_threshold: number; }

const NOTES = [20, 50, 100, 500, 1000, 5000];
const money = (n: number) => `LKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

export default function POS() {
  // --- STATE: Data ---
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ tax_rate: 0, receipt_header: '', receipt_footer: '', low_stock_threshold: 5 });
  const [cashierId, setCashierId] = useState<string | null>(null);
  
  // --- STATE: System ---
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- STATE: POS UI ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGrid, setShowGrid] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // --- STATE: Customer ---
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ full_name: '', phone: '' });
  const [addingCustomer, setAddingCustomer] = useState(false);

  // --- STATE: Discounts & Hold ---
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  // --- STATE: Payment ---
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'loan'>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [cashNotes, setCashNotes] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // INITIALIZATION & EFFECTS
  // ==========================================

  // FIX: This was missing in the previous code! This loads the data on mount.
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
      
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
      setCustomers(customersRes.data || []);
      
      if (settingsRes.data) {
        setSettings({
          tax_rate: Number(settingsRes.data.tax_rate || 0) / 100,
          receipt_header: settingsRes.data.receipt_header || '',
          receipt_footer: settingsRes.data.receipt_footer || '',
          low_stock_threshold: Number(settingsRes.data.low_stock_threshold || 5)
        });
      }
      setCashierId(userRes.data?.user?.id || null);
    } catch (err: any) {
      setLoadError(err.message || 'Database connection failed. Are you offline?');
      toast.error('Failed to sync terminal data.');
    } finally {
      setLoading(false);
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      // Prevent default browser shortcuts if targeting our app
      if (e.key === 'F2') {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0 && !showPayment) openPayment();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && !showPayment && window.confirm("Void this current transaction?")) voidSale();
      } else if (e.key === 'F9') {
        e.preventDefault();
        setShowGrid(s => !s);
      } else if (e.key === 'Escape') {
        if (showPayment && !processing) {
          setShowPayment(false);
          scanInputRef.current?.focus();
        }
        if (showHeldModal) setShowHeldModal(false);
        if (showAddCustomer) setShowAddCustomer(false);
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [cart, showPayment, processing, showHeldModal, showAddCustomer]);

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

  // ==========================================
  // SCANNER & BARCODE LOGIC
  // ==========================================

  const parseSupermarketBarcode = (barcode: string) => {
    // Standard format for meat/veg: 21XXXXXWWWWWC (13 chars)
    // 21 = prefix, XXXXX = item code, WWWWW = weight or price, C = checksum
    if ((barcode.startsWith('20') || barcode.startsWith('21') || barcode.startsWith('02')) && barcode.length === 13) {
      const itemCode = barcode.substring(2, 7);
      const weightData = barcode.substring(7, 12); // e.g. 01500 = 1.500 kg
      const weight = Number(weightData) / 1000;
      
      const product = products.find(p => p.barcode && p.barcode.endsWith(itemCode));
      if (product) {
        return { product, weight };
      }
    }
    return null;
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim().toLowerCase();
    
    // 1. Check Exact Match
    let match = products.find(p => p.barcode?.toLowerCase() === query);
    let qtyToAdd = 1;

    // 2. Check Weighted Barcode
    if (!match && query.length === 13) {
      const parsed = parseSupermarketBarcode(query);
      if (parsed) {
        match = parsed.product;
        qtyToAdd = parsed.weight;
      }
    }

    // 3. Check Name Search (fallback)
    if (!match) {
      match = products.find(p => p.name.toLowerCase() === query);
    }

    if (match) {
      playBeep();
      addToCart(match, qtyToAdd);
    } else {
      toast.error('Item not found in database.');
    }
    setSearchQuery('');
  };

  // Auto-scan listener (if barcode scanner types fast and hits enter)
  useEffect(() => {
    if (searchQuery.length >= 8) {
      const exactMatch = products.find(p => p.barcode === searchQuery);
      if (exactMatch) {
        playBeep();
        addToCart(exactMatch, 1);
        setSearchQuery('');
      }
    }
  }, [searchQuery, products, playBeep]);

  // ==========================================
  // CART MANAGEMENT
  // ==========================================

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
        // Prevent floating point weirdness on scales
        let newQty = Number((item.quantity + delta).toFixed(3));
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const setExactQuantity = (productId: string) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    const val = window.prompt(`Enter exact quantity for ${item.product.name}:`, item.quantity.toString());
    if (val !== null) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: num } : i));
      } else if (num === 0) {
        removeFromCart(productId);
      }
    }
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.product.id !== productId));

  const voidSale = () => {
    setCart([]);
    setDiscountValue(0);
    setDiscountType('flat');
    clearCustomer();
    scanInputRef.current?.focus();
  };

  // ==========================================
  // CUSTOMER MANAGEMENT
  // ==========================================

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return customers.filter(c => (c.phone && c.phone.includes(q)) || c.full_name.toLowerCase().includes(q));
  }, [customerQuery, customers]);

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerQuery('');
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.full_name || !newCustomerForm.phone) return toast.error("Name and Phone required.");
    
    setAddingCustomer(true);
    try {
      const { data, error } = await supabase.from('customers').insert({
        full_name: newCustomerForm.full_name,
        phone: newCustomerForm.phone,
        loan_balance: 0,
        loyalty_points: 0
      }).select().single();

      if (error) throw error;
      
      setCustomers(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setSelectedCustomer(data);
      setShowAddCustomer(false);
      setNewCustomerForm({ full_name: '', phone: '' });
      toast.success("Customer added!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create customer");
    } finally {
      setAddingCustomer(false);
    }
  };

  // ==========================================
  // DISCOUNTS & HELD SALES
  // ==========================================

  const promptDiscount = () => {
    const type = window.confirm("Click OK for Flat Amount (LKR) or Cancel for Percentage (%)");
    setDiscountType(type ? 'flat' : 'percent');
    
    const val = window.prompt(`Enter discount ${type ? 'amount (LKR)' : 'percentage (%)'}:`, discountValue.toString());
    if (val !== null) {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        if (!type && num > 100) return toast.error("Percentage cannot exceed 100%");
        setDiscountValue(num);
      }
    }
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
      discountValue
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

  // ==========================================
  // CALCULATIONS
  // ==========================================

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

  // ==========================================
  // PAYMENT & PRINTING
  // ==========================================

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

    // FIX: Open popup BEFORE async database calls to bypass browser popup blockers!
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');

    try {
      // 1. Save Sale
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

      // 2. Save Items & Update Stock (Optimized batching)
      const saleItems = cart.map(item => ({
        sale_id: saleRow.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.selling_price,
        line_total: item.product.selling_price * item.quantity,
      }));
      await supabase.from('sale_items').insert(saleItems);

      const stockUpdates = cart.map(item => 
        supabase.from('products').update({ stock: item.product.stock - item.quantity }).eq('id', item.product.id)
      );
      await Promise.all(stockUpdates); // Fire all stock updates concurrently

      // 3. Update Loan / Points
      let newLoanBalance = selectedCustomer?.loan_balance || 0;
      let newPoints = selectedCustomer?.loyalty_points || 0;
      
      if (selectedCustomer) {
        if (paymentMethod === 'loan') newLoanBalance += finalTotal;
        if (paymentMethod !== 'loan') newPoints += Math.floor(finalTotal / 100); // 1 point per 100 LKR
        
        await supabase.from('customers').update({ 
          loan_balance: newLoanBalance,
          loyalty_points: newPoints
        }).eq('id', selectedCustomer.id);
        
        // Update local state so it reflects immediately for the next sale
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, loan_balance: newLoanBalance, loyalty_points: newPoints } : c));
      }

      // 4. Generate & Print ESC/POS Style HTML Receipt
      if (receiptWindow) {
        const dStr = discountAmount > 0 ? `<div class="flex-between"><span>Discount:</span><span>-${money(discountAmount)}</span></div>` : '';
        const taxStr = taxAmount > 0 ? `<div class="flex-between"><span>Tax (${(settings.tax_rate * 100).toFixed(1)}%):</span><span>${money(taxAmount)}</span></div>` : '';
        const loanStr = paymentMethod === 'loan' ? `<div class="divider"></div><div class="flex-between bold"><span>NEW LOAN BAL:</span><span>${money(newLoanBalance)}</span></div>` : '';
        const loyaltyStr = (selectedCustomer && paymentMethod !== 'loan') ? `<div class="text-center" style="font-size:10px; margin-top:5px;">Loyalty Points Earned: ${Math.floor(finalTotal/100)}<br>Total Points: ${newPoints}</div>` : '';
        
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
              <div class="flex-between small"><span>Receipt: #${saleRow.id.substring(0,8)}</span><span>Cashier: SYS</span></div>
              ${selectedCustomer ? `<div class="small" style="margin-top:3px;">Customer: ${selectedCustomer.full_name}</div>` : ''}
              <div class="small" style="margin-top:3px;">Type: <span class="bold">${paymentMethod.toUpperCase()}</span></div>
              <div class="divider"></div>
              
              <table style="width: 100%; font-size: 11px; text-align: left; border-collapse: collapse;">
                <tr><th style="padding-bottom:4px;">Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Total</th></tr>
                ${cart.map(item => `
                  <tr>
                    <td style="padding-bottom:3px;">${item.product.name}</td>
                    <td style="text-align:center;">${item.quantity}</td>
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
              ` : ''}
              
              ${loanStr}
              ${loyaltyStr}
              
              <div class="divider"></div>
              <div class="text-center small">
                <p>${settings.receipt_footer || 'Thank you for shopping with us!'}</p>
                <p>* Please keep receipt for returns *</p>
                <div style="font-family: 'Libre Barcode 39', cursive; font-size: 32px; margin-top:10px;">*${saleRow.id.substring(0,8)}*</div>
              </div>
            </body>
          </html>
        `);
        receiptWindow.document.close();
        setTimeout(() => { receiptWindow.print(); receiptWindow.close(); }, 400); // Wait for fonts/render
      }

      toast.success('Transaction Successful!');
      voidSale();
      setShowPayment(false);
      
      // Update local product stock
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.product.id === p.id);
        return cartItem ? { ...p, stock: p.stock - cartItem.quantity } : p;
      }));
      
    } catch (err: any) {
      if (receiptWindow) receiptWindow.close();
      toast.error('Transaction failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const gridProducts = useMemo(() => {
    let filtered = activeCategory ? products.filter(p => p.category_id === activeCategory) : products;
    if (searchQuery && showGrid) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.includes(q));
    }
    return filtered;
  }, [products, activeCategory, searchQuery, showGrid]);

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
      
      {/* ================= HEADER BAR ================= */}
      <header className="bg-[#0F6E5B] text-white px-4 py-2 flex justify-between items-center z-30 shadow-md">
        <div className="flex items-center gap-4">
          <div className="font-bold text-xl tracking-tight flex items-center gap-2">
            <ShoppingCart size={20} /> Ahamed's Kade POS
          </div>
          <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${isOnline ? 'bg-green-500/20 text-green-100' : 'bg-red-500 text-white'}`}>
            {isOnline ? <Wifi size={14}/> : <WifiOff size={14}/>} {isOnline ? 'ONLINE' : 'OFFLINE MODE'}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="flex items-center gap-1 opacity-80"><Clock size={16}/> {formatTime(currentTime)}</div>
          <div className="flex items-center gap-1 bg-black/20 px-3 py-1 rounded-full"><User size={16}/> {cashierId ? 'Cashier 01' : 'Admin'}</div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* ================= LEFT PANEL (SCAN/GRID/CART) ================= */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* Action Bar */}
          <div className="bg-white p-4 shadow-sm z-20 border-b border-[#E7E3DB] flex gap-3 items-center">
            <form onSubmit={handleScanSubmit} className="relative flex-1">
              <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0F6E5B]" size={24} />
              <input
                ref={scanInputRef}
                type="text"
                placeholder="Scan Barcode or Search Item (F2)"
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
            
            <button onClick={() => setShowGrid(s => !s)} title="Toggle Grid (F9)" className={`p-4 rounded-xl border-2 transition-all ${showGrid ? 'border-[#0F6E5B] bg-[#E4F3EF] text-[#0F6E5B] shadow-inner' : 'border-[#E7E3DB] bg-white hover:bg-gray-50'}`}>
              <LayoutGrid size={24} />
            </button>
            <div className="h-10 w-px bg-gray-200 mx-1"></div>
            <button onClick={holdCurrentSale} title="Hold Sale" className="p-4 rounded-xl border-2 border-[#E7E3DB] bg-white hover:text-orange-600 hover:border-orange-200 transition-colors">
              <PauseCircle size={24} />
            </button>
            <button onClick={() => setShowHeldModal(true)} title="View Held Sales" className="relative p-4 rounded-xl border-2 border-[#E7E3DB] bg-white hover:text-[#0F6E5B] transition-colors">
              <PlayCircle size={24} />
              {heldSales.length > 0 && <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-pulse">{heldSales.length}</span>}
            </button>
          </div>

          {/* Search Dropdown Overlay */}
          {!showGrid && searchQuery && (
            <div className="absolute top-20 left-4 right-4 md:right-[416px] bg-white rounded-xl shadow-2xl z-50 border border-gray-200 max-h-96 overflow-y-auto">
              {gridProducts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No products found matching "{searchQuery}"</div>
              ) : (
                gridProducts.map(p => (
                  <button key={p.id} onClick={() => { addToCart(p); setSearchQuery(''); }} className="w-full text-left p-4 border-b hover:bg-[#E4F3EF] flex justify-between items-center group">
                    <div>
                      <div className="font-bold text-lg group-hover:text-[#0F6E5B]">{p.name}</div>
                      <div className="text-sm text-gray-500 flex gap-4">
                        <span>{p.barcode || 'No barcode'}</span>
                        <span className={p.stock <= settings.low_stock_threshold ? 'text-red-600 font-bold' : ''}>Stock: {p.stock}</span>
                      </div>
                    </div>
                    <div className="font-bold text-xl">{money(p.selling_price)}</div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Product Grid View */}
          {showGrid && (
            <div className="bg-white border-b border-[#E7E3DB] flex flex-col h-1/2 shadow-inner z-10">
              <div className="flex gap-2 overflow-x-auto p-3 border-b bg-gray-50 hide-scrollbar">
                <button onClick={() => setActiveCategory(null)} className={`px-5 py-2.5 rounded-full font-bold border-2 transition-all whitespace-nowrap ${!activeCategory ? 'bg-black text-white border-black shadow-md' : 'border-gray-200 bg-white text-gray-600'}`}>All Items</button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setActiveCategory(c.id)} className={`px-5 py-2.5 rounded-full font-bold border-2 transition-all whitespace-nowrap bg-white`} style={activeCategory === c.id ? {backgroundColor: c.color, color: '#fff', borderColor: c.color, boxShadow: `0 4px 12px ${c.color}40`} : {color: c.color, borderColor: '#e5e7eb'}}>
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {gridProducts.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} className="text-left p-3 rounded-2xl border-2 border-gray-100 bg-white hover:border-[#0F6E5B] hover:shadow-lg transition-all relative group flex flex-col h-full">
                    {p.stock <= settings.low_stock_threshold && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>}
                    <div className="font-bold text-sm leading-tight flex-1 group-hover:text-[#0F6E5B]">{p.name}</div>
                    <div className="text-xs font-bold text-gray-400 mt-2">{p.barcode || '-'}</div>
                    <div className="text-sm font-black text-[#0F6E5B] mt-1">{money(p.selling_price)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cart View (Receipt Tape) */}
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
                        <span className="text-sm text-[#0F6E5B] font-bold">@ {item.product.selling_price.toFixed(2)}</span>
                        {item.product.stock <= settings.low_stock_threshold && (
                          <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Low Stock ({item.product.stock})</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="col-span-3 flex justify-center">
                      <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 p-0.5 shadow-sm">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="p-2 hover:bg-white hover:text-red-600 rounded-lg transition-colors"><Minus size={16} strokeWidth={3} /></button>
                        <button onClick={() => setExactQuantity(item.product.id)} className="font-bold w-10 text-center text-lg hover:bg-gray-200 rounded px-1 transition-colors">{item.quantity}</button>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="p-2 hover:bg-white hover:text-[#0F6E5B] rounded-lg transition-colors"><Plus size={16} strokeWidth={3} /></button>
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

        {/* ================= RIGHT PANEL (CHECKOUT) ================= */}
        <div className="w-full md:w-[420px] bg-white border-l border-[#E7E3DB] flex flex-col h-full shadow-2xl z-30">
          
          {/* Customer Section */}
          <div className="p-5 border-b border-gray-100 bg-white">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Assigned Customer</label>
              {!selectedCustomer && (
                <button onClick={() => setShowAddCustomer(true)} className="text-xs font-bold text-[#0F6E5B] bg-[#E4F3EF] px-2 py-1 rounded-md flex items-center gap-1 hover:bg-[#0F6E5B] hover:text-white transition-colors"><UserPlus size={12}/> New</button>
              )}
            </div>

            {selectedCustomer ? (
              <div className="bg-[#F8FCFB] border-2 border-[#0F6E5B]/20 rounded-2xl p-4 relative group">
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
                    <div className="font-black text-orange-600 flex items-center justify-center gap-1"><Award size={14}/> {selectedCustomer.loyalty_points || 0}</div>
                  </div>
                  <div className={`bg-white p-2 rounded-xl border text-center shadow-sm ${selectedCustomer.loan_balance && selectedCustomer.loan_balance > 0 ? 'border-red-200' : ''}`}>
                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Store Credit / Owed</div>
                    <div className={`font-black flex items-center justify-center gap-1 ${selectedCustomer.loan_balance && selectedCustomer.loan_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <Wallet size={14}/> {money(selectedCustomer.loan_balance || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  value={customerQuery} 
                  onChange={e => setCustomerQuery(e.target.value)} 
                  placeholder="Search by name or phone..." 
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl font-bold focus:border-[#0F6E5B] focus:bg-white outline-none transition-all placeholder:font-normal" 
                />
                {customerMatches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border z-50 max-h-60 overflow-y-auto">
                    {customerMatches.map(c => (
                      <button key={c.id} onClick={() => handleCustomerSelect(c)} className="w-full text-left p-3 border-b hover:bg-gray-50 flex justify-between items-center">
                        <div>
                          <div className="font-bold">{c.full_name}</div>
                          <div className="text-xs text-gray-500">{c.phone}</div>
                        </div>
                        {c.loan_balance && c.loan_balance > 0 && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">Owes {money(c.loan_balance)}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="p-4 grid grid-cols-2 gap-3 border-b border-gray-100 bg-gray-50/50">
            <button onClick={voidSale} disabled={cart.length===0} className="py-3 rounded-xl font-bold text-sm bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm disabled:opacity-50 disabled:hover:bg-white flex items-center justify-center gap-2 transition-all">
              <Trash2 size={18}/> Void Sale (F8)
            </button>
            <button onClick={promptDiscount} disabled={cart.length===0} className="py-3 rounded-xl font-bold text-sm bg-white border border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 shadow-sm disabled:opacity-50 disabled:hover:bg-white flex items-center justify-center gap-2 transition-all">
              <Tag size={18}/> {discountValue > 0 ? 'Edit Discount' : 'Add Discount'}
            </button>
          </div>

          {/* Totals Section */}
          <div className="mt-auto p-6 bg-white flex flex-col gap-3">
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-gray-500 font-medium text-sm"><span>Subtotal ({cart.length} items)</span><span>{money(subtotal)}</span></div>
              
              {discountValue > 0 && (
                <div className="flex justify-between text-blue-600 font-bold text-sm bg-blue-50 p-2 rounded-lg">
                  <span className="flex items-center gap-1"><Tag size={14}/> Discount ({discountType === 'percent' ? `${discountValue}%` : 'Flat'})</span>
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

            <button onClick={openPayment} disabled={cart.length === 0} className="w-full bg-[#1C1B19] hover:bg-black disabled:bg-gray-300 text-white py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5 active:translate-y-0 relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out rounded-2xl"></div>
              <span className="relative z-10 flex items-center gap-2">PAY NOW (F4) <ChevronRight size={24} /></span>
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODALS */}
      {/* ================================================================= */}

      {/* 1. PAYMENT MODAL */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => !processing && setShowPayment(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            {/* Left side: Method Selection */}
            <div className="w-full md:w-1/3 bg-gray-50 p-6 border-r flex flex-col gap-3">
              <h3 className="font-black text-gray-400 uppercase tracking-widest text-xs mb-2">Payment Method</h3>
              
              <button onClick={() => setPaymentMethod('cash')} className={`py-4 px-4 rounded-2xl border-2 font-bold flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'cash' ? 'border-[#0F6E5B] bg-white text-[#0F6E5B] shadow-md scale-105' : 'border-transparent hover:bg-gray-200 text-gray-600'}`}>
                <Banknote size={32}/> Cash
              </button>
              
              <button onClick={() => setPaymentMethod('card')} className={`py-4 px-4 rounded-2xl border-2 font-bold flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'card' ? 'border-[#0F6E5B] bg-white text-[#0F6E5B] shadow-md scale-105' : 'border-transparent hover:bg-gray-200 text-gray-600'}`}>
                <CreditCard size={32}/> Credit/Debit
              </button>
              
              <button onClick={() => setPaymentMethod('loan')} className={`py-4 px-4 rounded-2xl border-2 font-bold flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'loan' ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-md scale-105' : 'border-transparent hover:bg-gray-200 text-gray-600'}`}>
                <Wallet size={32}/> Store Credit
              </button>
            </div>

            {/* Right side: Input & Confirmation */}
            <div className="w-full md:w-2/3 flex flex-col bg-white">
              <div className="p-8 flex-1 flex flex-col justify-center">
                <div className="text-center mb-8">
                  <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Amount Due</div>
                  <div className="text-5xl font-black text-[#0F6E5B]">{money(finalTotal)}</div>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {NOTES.map(n => (
                        <button key={n} onClick={() => { setCashNotes(p => [...p, n]); setCashTendered(p => (Number(p||0)+n).toString()); }} className="py-3 rounded-xl border border-[#0F6E5B]/20 bg-[#F8FCFB] text-[#0F6E5B] font-bold text-lg hover:bg-[#0F6E5B] hover:text-white transition-colors shadow-sm">
                          +{n}
                        </button>
                      ))}
                    </div>
                    
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
                      <button onClick={() => { setCashTendered(finalTotal.toString()); setCashNotes([]); }} className="absolute inset-y-2 right-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 rounded-xl font-bold text-sm transition-colors">Exact</button>
                    </div>
                    
                    <div className={`flex justify-between items-center p-5 rounded-2xl border-2 transition-colors ${cashChange > 0 ? 'bg-green-50 border-green-200 text-green-800' : cashChange < 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                      <span className="font-bold text-lg uppercase tracking-wider">{cashChange < 0 ? 'Amount Short' : 'Change Due'}</span>
                      <span className="font-black text-3xl">{money(Math.abs(cashChange))}</span>
                    </div>
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="text-center p-8 bg-blue-50 border-2 border-blue-100 rounded-2xl animate-in fade-in duration-300">
                    <CreditCard size={64} className="mx-auto text-blue-400 mb-4" />
                    <h3 className="font-bold text-blue-900 text-xl">Process on Terminal</h3>
                    <p className="text-blue-700 mt-2">Swipe, insert, or tap card on the external payment terminal. Press confirm below once approved.</p>
                  </div>
                )}

                {paymentMethod === 'loan' && (
                  <div className={`text-center p-8 border-2 rounded-2xl animate-in fade-in duration-300 ${selectedCustomer ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
                    <Wallet size={64} className={`mx-auto mb-4 ${selectedCustomer ? 'text-orange-400' : 'text-red-400'}`} />
                    {selectedCustomer ? (
                      <>
                        <h3 className="font-bold text-orange-900 text-xl">{selectedCustomer.full_name}'s Account</h3>
                        <p className="text-orange-700 mt-2 font-medium">New Balance will be: <span className="font-black">{money((selectedCustomer.loan_balance || 0) + finalTotal)}</span></p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-bold text-red-900 text-xl">No Customer Assigned</h3>
                        <p className="text-red-700 mt-2">You must cancel payment and assign a customer to use Store Credit.</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border-t bg-gray-50 flex gap-4">
                <button onClick={() => setShowPayment(false)} disabled={processing} className="px-8 py-4 rounded-2xl font-bold bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                <button 
                  onClick={confirmCharge} 
                  disabled={processing || (paymentMethod === 'loan' && !selectedCustomer) || (paymentMethod === 'cash' && Number(cashTendered||0) < finalTotal)} 
                  className="flex-1 py-4 rounded-2xl font-black text-white bg-[#0F6E5B] hover:bg-[#0B4F41] disabled:opacity-50 disabled:hover:bg-[#0F6E5B] flex items-center justify-center gap-3 text-xl shadow-lg transition-all"
                >
                  {processing ? <><Loader2 className="animate-spin" size={24} /> Processing...</> : <><Check size={28} /> Complete Sale (Enter)</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ADD CUSTOMER MODAL */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => !addingCustomer && setShowAddCustomer(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0F6E5B] p-6 text-white flex justify-between items-center">
              <h2 className="font-bold text-xl flex items-center gap-2"><UserPlus size={24}/> Add New Customer</h2>
              <button onClick={() => setShowAddCustomer(false)} className="hover:bg-white/20 p-1 rounded"><X size={24}/></button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name *</label>
                <input autoFocus type="text" value={newCustomerForm.full_name} onChange={e => setNewCustomerForm({...newCustomerForm, full_name: e.target.value})} className="w-full p-3 border-2 rounded-xl focus:border-[#0F6E5B] outline-none font-medium" placeholder="John Doe" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number *</label>
                <input type="tel" value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})} className="w-full p-3 border-2 rounded-xl focus:border-[#0F6E5B] outline-none font-medium" placeholder="07XXXXXXXX" required />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddCustomer(false)} className="flex-1 py-3 font-bold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={addingCustomer} className="flex-[2] py-3 font-bold rounded-xl bg-[#0F6E5B] text-white hover:bg-[#0B4F41] flex justify-center items-center gap-2">
                  {addingCustomer ? <Loader2 className="animate-spin" size={20}/> : <UserPlus size={20}/>} Create & Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. HELD SALES MODAL */}
      {showHeldModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowHeldModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-3xl">
              <h2 className="font-black text-2xl flex items-center gap-2"><Clock size={28} className="text-orange-600"/> Parked Sales</h2>
              <button onClick={() => setShowHeldModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-200 shadow-sm"><X size={20}/></button>
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
                    <div key={sale.id} className="border-2 border-gray-100 rounded-2xl p-5 hover:border-orange-200 transition-colors flex justify-between items-center group">
                      <div>
                        <h4 className="font-bold text-lg">{sale.label}</h4>
                        <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                          <span><Clock size={14} className="inline mr-1"/> {formatTime(sale.heldAt)}</span>
                          <span><ShoppingCart size={14} className="inline mr-1"/> {sale.cart.length} items</span>
                          <span className="font-bold text-[#0F6E5B]">{money(sale.cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0))}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setHeldSales(p => p.filter(h => h.id !== sale.id))} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Delete">
                          <Trash2 size={20}/>
                        </button>
                        <button onClick={() => resumeHeldSale(sale.id)} className="px-6 py-3 bg-orange-100 text-orange-700 font-bold rounded-xl hover:bg-orange-500 hover:text-white transition-colors flex items-center gap-2 shadow-sm">
                          <PlayCircle size={20}/> Resume
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