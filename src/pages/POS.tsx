import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Search, ShoppingCart, Trash2, CreditCard, Banknote, Plus, Minus, ScanBarcode } from 'lucide-react';
import toast from 'react-hot-toast';

// Dummy data for initial render (Replace with Supabase fetch in production)
const DUMMY_PRODUCTS = [
  { id: '1', name: 'Samba Rice 1kg', price: 250, category_id: 'cat1', stock: 50 },
  { id: '2', name: 'Red Onion 500g', price: 180, category_id: 'cat2', stock: 20 },
  { id: '3', name: 'Munchee Super Cream Cracker', price: 150, category_id: 'cat3', stock: 100 },
  { id: '4', name: 'Highland Milk Powder 400g', price: 1100, category_id: 'cat4', stock: 15 },
  { id: '5', name: 'Carrot 250g', price: 120, category_id: 'cat2', stock: 10 },
  { id: '6', name: 'Coconut (Large)', price: 90, category_id: 'cat5', stock: 200 },
];

export default function POS() {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredProducts = DUMMY_PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCheckout = async (method: string) => {
    if (cart.length === 0) return toast.error("Cart is empty");
    setIsProcessing(true);
    
    // Simulate network delay for Supabase insert
    setTimeout(() => {
      toast.success(`Payment of Rs. ${cartTotal.toFixed(2)} received via ${method}`);
      clearCart();
      setIsProcessing(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 overflow-hidden">
      
      {/* LEFT: PRODUCTS & CATEGORIES (70% width on Desktop) */}
      <div className="w-full lg:w-2/3 flex flex-col h-[50vh] lg:h-full">
        {/* Header / Search bar */}
        <div className="bg-white p-4 shadow-sm z-10 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search products or scan barcode..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 transition-all text-lg"
            />
          </div>
          <button className="p-3 bg-gray-100 rounded-xl text-gray-600 hover:bg-gray-200">
            <ScanBarcode size={24} />
          </button>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center text-center border border-gray-100 h-32"
            >
              <span className="font-semibold text-gray-800 line-clamp-2">{product.name}</span>
              <span className="text-brand-600 font-bold mt-2">Rs. {product.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: CART & CHECKOUT (30% width on Desktop) */}
      <div className="w-full lg:w-1/3 bg-white border-t lg:border-l border-gray-200 flex flex-col h-[50vh] lg:h-full shadow-2xl z-20">
        
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart size={24} /> Current Bill
          </h2>
          <button onClick={clearCart} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
            <Trash2 size={20} />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart size={48} className="mb-4 opacity-20" />
              <p>No items in cart</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800 text-sm">{item.name}</h3>
                  <p className="text-brand-600 font-semibold">Rs. {(item.price * item.cart_quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
                  <button onClick={() => updateQuantity(item.id, item.cart_quantity - 1)} className="p-1 bg-white rounded-md shadow-sm">
                    <Minus size={16} />
                  </button>
                  <span className="font-semibold w-6 text-center">{item.cart_quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.cart_quantity + 1)} className="p-1 bg-white rounded-md shadow-sm text-brand-600">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Section */}
        <div className="p-4 bg-white border-t border-gray-100 pb-safe">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium text-lg">Rs. {cartTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-xl font-bold text-gray-800">Total</span>
            <span className="text-3xl font-black text-brand-600">Rs. {cartTotal.toFixed(2)}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleCheckout('cash')}
              disabled={isProcessing || cart.length === 0}
              className="bg-brand-500 hover:bg-brand-600 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Banknote size={24} /> Cash
            </button>
            <button 
              onClick={() => handleCheckout('card')}
              disabled={isProcessing || cart.length === 0}
              className="bg-gray-800 hover:bg-gray-900 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <CreditCard size={24} /> Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}