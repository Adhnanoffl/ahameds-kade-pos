import React, { useState, KeyboardEvent, useRef, useEffect } from 'react';

// --- TypeScript Interfaces ---
interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
}

interface CartItem extends Product {
  quantity: number;
  total: number;
}

interface Customer {
  memberId: string;
  name: string;
  phone: string;
  points: number;
  creditLimit: number; // Important for 'Loan' payments
}

interface Receipt {
  transactionId: string;
  date: Date;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  method: 'Cash' | 'Card' | 'Loan';
  customer?: Customer | null;
  amountTendered?: number;
  change?: number;
}

// --- Main Component ---
export default function AdvancedPOS() {
  // State Management
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerInput, setCustomerInput] = useState('');
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [customerError, setCustomerError] = useState('');
  
  // Payment & Billing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [amountTendered, setAmountTendered] = useState<number>(0);

  const customerInputRef = useRef<HTMLInputElement>(null);

  // Financial Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxRate = 0.08; // 8% Tax
  const tax = subtotal * taxRate;
  const grandTotal = subtotal + tax;

  // --- 1. Customer Lookup Logic ---
  const handleCustomerKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setCustomerError('');
      
      if (!customerInput.trim()) {
        setActiveCustomer(null);
        return;
      }

      try {
        // REPLACE THIS with your actual API call: await fetch(`/api/customers/${customerInput}`)
        const fetchedCustomer = mockFetchCustomer(customerInput);
        
        if (fetchedCustomer) {
          setActiveCustomer(fetchedCustomer);
          setCustomerInput(''); // Clear input after successful load
        } else {
          setActiveCustomer(null);
          setCustomerError('Customer not found.');
        }
      } catch (err) {
        setCustomerError('Error looking up customer.');
      }
    }
  };

  // --- 2. Billing & Payment Logic ---
  const handlePayment = (method: 'Cash' | 'Card' | 'Loan') => {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    // Professional Validation: Loan checks
    if (method === 'Loan') {
      if (!activeCustomer) {
        alert("A customer must be attached to process a Loan.");
        return;
      }
      if (grandTotal > activeCustomer.creditLimit) {
        alert(`Credit Limit Exceeded! Customer only has $${activeCustomer.creditLimit.toFixed(2)} available.`);
        return;
      }
    }

    setIsProcessing(true);

    // Simulate API call to save transaction and generate bill
    setTimeout(() => {
      const newReceipt: Receipt = {
        transactionId: `TXN-${Math.floor(Math.random() * 1000000)}`,
        date: new Date(),
        items: [...cart],
        subtotal,
        tax,
        total: grandTotal,
        method,
        customer: activeCustomer,
        amountTendered: method === 'Cash' ? amountTendered || grandTotal : grandTotal,
        change: method === 'Cash' ? (amountTendered || grandTotal) - grandTotal : 0,
      };

      setReceipt(newReceipt);
      setIsProcessing(false);
      
      // Clear terminal for next customer
      setCart([]);
      setActiveCustomer(null);
      setAmountTendered(0);
    }, 800); // Simulated network delay
  };

  const handlePrintBill = () => {
    // In a real app, this triggers a thermal printer or PDF generation
    window.print();
  };

  const resetTerminal = () => {
    setReceipt(null);
    customerInputRef.current?.focus();
  };

  // --- Mock Data Helpers ---
  const mockFetchCustomer = (id: string): Customer | null => {
    const db: Record<string, Customer> = {
      '1001': { memberId: '1001', name: 'John Doe', phone: '555-0192', points: 450, creditLimit: 200.00 },
      '1002': { memberId: '1002', name: 'Jane Smith', phone: '555-9938', points: 1200, creditLimit: 50.00 }
    };
    return db[id] || null;
  };

  // Add dummy item for testing
  const addTestItem = () => {
    const item: CartItem = { id: Date.now().toString(), sku: 'SKU-102', name: 'Premium Coffee Beans', price: 15.99, quantity: 1, total: 15.99 };
    setCart([...cart, item]);
  };

  // --- Render ---
  if (receipt) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md print:shadow-none print:w-full print:p-0">
          <h2 className="text-2xl font-bold text-center mb-4">SUPERMARKET INC.</h2>
          <p className="text-center text-sm text-gray-500 mb-6">Receipt #: {receipt.transactionId}</p>
          
          <div className="border-t border-b border-gray-200 py-4 mb-4">
            {receipt.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm mb-2">
                <span>{item.quantity}x {item.name}</span>
                <span>${item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal:</span> <span>${receipt.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Tax (8%):</span> <span>${receipt.tax.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-lg"><span>Total:</span> <span>${receipt.total.toFixed(2)}</span></div>
          </div>

          <div className="border-t border-gray-200 mt-4 pt-4 text-sm">
            <div className="flex justify-between"><span>Payment Method:</span> <span className="uppercase">{receipt.method}</span></div>
            {receipt.method === 'Cash' && (
              <>
                <div className="flex justify-between"><span>Tendered:</span> <span>${receipt.amountTendered?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Change:</span> <span>${receipt.change?.toFixed(2)}</span></div>
              </>
            )}
            {receipt.customer && (
              <div className="mt-4 text-gray-600 text-xs">
                Member: {receipt.customer.name} (ID: {receipt.customer.memberId})<br/>
                Points Earned: {Math.floor(receipt.total)}
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-4 print:hidden">
            <button onClick={handlePrintBill} className="flex-1 bg-blue-600 text-white py-3 rounded hover:bg-blue-700">Print Bill</button>
            <button onClick={resetTerminal} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded hover:bg-gray-300">Next Customer</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      
      {/* LEFT PANEL: Cart & Products */}
      <div className="w-2/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 bg-gray-800 text-white flex justify-between items-center">
          <h1 className="text-xl font-bold">Terminal #1</h1>
          <button onClick={addTestItem} className="bg-green-600 px-4 py-2 rounded text-sm hover:bg-green-500 transition">
            + Scan Dummy Item
          </button>
        </div>
        
        {/* Cart Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500 uppercase text-xs">
                <th className="py-2">Item</th>
                <th className="py-2">Price</th>
                <th className="py-2">Qty</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-4 font-medium">{item.name} <br/><span className="text-xs text-gray-400">{item.sku}</span></td>
                  <td className="py-4">${item.price.toFixed(2)}</td>
                  <td className="py-4">{item.quantity}</td>
                  <td className="py-4 text-right font-medium">${item.total.toFixed(2)}</td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400">Cart is empty. Scan an item to begin.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT PANEL: Customer & Payment */}
      <div className="w-1/3 bg-gray-50 flex flex-col">
        
        {/* Customer Section */}
        <div className="p-6 border-b border-gray-200 bg-white shadow-sm z-10">
          <label className="block text-sm font-medium text-gray-700 mb-2">Member ID</label>
          <input
            ref={customerInputRef}
            type="text"
            value={customerInput}
            onChange={(e) => setCustomerInput(e.target.value)}
            onKeyDown={handleCustomerKeyDown}
            autoComplete="off"     /* Strictly disables browser suggestions */
            spellCheck={false}
            placeholder="Type ID and press Enter..."
            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {customerError && <p className="text-red-500 text-xs mt-2">{customerError}</p>}
          
          {/* Customer Details Card (Replaces the Add Button) */}
          {activeCustomer && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-blue-900">{activeCustomer.name}</h3>
                  <p className="text-xs text-blue-700">{activeCustomer.phone}</p>
                </div>
                <button onClick={() => setActiveCustomer(null)} className="text-blue-400 hover:text-blue-700 text-sm">Remove</button>
              </div>
              <div className="mt-3 flex gap-4 text-sm border-t border-blue-100 pt-3">
                <div>
                  <span className="block text-xs text-blue-500">Loyalty Points</span>
                  <span className="font-medium text-blue-900">{activeCustomer.points}</span>
                </div>
                <div>
                  <span className="block text-xs text-blue-500">Credit Limit</span>
                  <span className="font-medium text-blue-900">${activeCustomer.creditLimit.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Totals Section */}
        <div className="p-6 flex-1 flex flex-col justify-end">
          <div className="space-y-3 mb-6 text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (8%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xl font-bold text-gray-900 border-t pt-3">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Cash Tender Input (Only matters if paying by cash) */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Cash Given (Optional)</label>
            <input 
              type="number" 
              value={amountTendered || ''}
              onChange={(e) => setAmountTendered(parseFloat(e.target.value))}
              placeholder={`Default: $${grandTotal.toFixed(2)}`}
              className="w-full p-2 border border-gray-300 rounded text-right"
            />
          </div>

          {/* Payment Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              disabled={isProcessing || cart.length === 0}
              onClick={() => handlePayment('Cash')}
              className="bg-green-600 text-white p-4 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition"
            >
              CASH
            </button>
            <button 
              disabled={isProcessing || cart.length === 0}
              onClick={() => handlePayment('Card')}
              className="bg-blue-600 text-white p-4 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              CARD
            </button>
            <button 
              disabled={isProcessing || cart.length === 0}
              onClick={() => handlePayment('Loan')}
              className="col-span-2 bg-yellow-500 text-white p-4 rounded-lg font-bold hover:bg-yellow-600 disabled:opacity-50 transition"
            >
              STORE LOAN / CREDIT
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}