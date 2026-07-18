// @ts-nocheck
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useProducts } from '../hooks/useProducts';
import { Search, ShoppingCart, Trash2, CreditCard, Banknote, Plus, Minus, ScanBarcode, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export default function POS() {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal } = useStore();
  const { products, loading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter real products from Supabase
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const handleCheckout = async (method: string) => {
    if (cart.length === 0) return toast.error("Cart is empty");
    setIsProcessing(true);
    
    try {
      // 1. Create the sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          subtotal: cartTotal,
          total: cartTotal,
          payment_method: method,
          status: 'completed'
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Prepare sale items for insertion
      const saleItems = cart.map(item => ({
        sale_id: saleData.id,
        product_id: item.id,
        quantity: item.cart_quantity,
        unit_price: item.price || item.selling_price,
        subtotal: item.subtotal
      }));

      // 3. Insert all items
      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;

      // 4. Update Stock (Simple version)
      for (const item of cart) {
        await supabase.rpc('decrement_stock', { p_id: item.id, p_amount: item.cart_quantity });
      }

      toast.success(`Payment of Rs. ${cartTotal.toFixed(2)} received via ${method}`);
      clearCart();
    } catch (error: any) {
      toast.error(error.message || "Checkout failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 overflow-hidden">
      {/* LEFT: PRODUCTS */}
      <div className="w-full lg:w-2/3 flex flex-col h-[50vh] lg:h-full">
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

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p>No products found in database.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart({ ...product, price: product.selling_price })}
                  className="bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center text-center border border-gray-100 h-32"
                >
                  <span className="font-semibold text-gray-800 line-clamp-2">{product.name}</span>
                  <span className="text-brand-600 font-bold mt-2">Rs. {product.selling_price.toFixed(2)}</span>
                  <span className="text-xs text-gray-400 mt-1">Stock: {product.stock}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: CART (Unchanged) */}
      <div className="w-full lg:w-1/3 bg-white border-t lg:border-l border-gray-200 flex flex-col h-[50vh] lg:h-full shadow-2xl z-20">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart size={24} /> Current Bill
          </h2>
          <button onClick={clearCart} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
            <Trash2 size={20} />
          </button>
        </div>

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
              {isProcessing ? <Loader2 className="animate-spin" /> : <><Banknote size={24} /> Cash</>}
            </button>
            <button 
              onClick={() => handleCheckout('card')}
              disabled={isProcessing || cart.length === 0}
              className="bg-gray-800 hover:bg-gray-900 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <><CreditCard size={24} /> Card</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}