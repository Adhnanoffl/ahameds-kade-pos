import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category_id: string;
  barcode?: string;
  stock: number;
}

export interface CartItem extends Product {
  cart_quantity: number;
  subtotal: number;
}

interface POSState {
  cart: CartItem[];
  addToCart: (product: Product, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartItemCount: number;
}

export const useStore = create<POSState>()(
  persist(
    (set, get) => ({
      cart: [],
      cartTotal: 0,
      cartItemCount: 0,
      
      addToCart: (product, qty = 1) => {
        const cart = get().cart;
        const existing = cart.find(item => item.id === product.id);
        
        let newCart;
        if (existing) {
          newCart = cart.map(item => 
            item.id === product.id 
              ? { ...item, cart_quantity: item.cart_quantity + qty, subtotal: (item.cart_quantity + qty) * item.price }
              : item
          );
        } else {
          newCart = [...cart, { ...product, cart_quantity: qty, subtotal: product.price * qty }];
        }
        
        set({
          cart: newCart,
          cartTotal: newCart.reduce((sum, item) => sum + item.subtotal, 0),
          cartItemCount: newCart.reduce((sum, item) => sum + item.cart_quantity, 0)
        });
      },
      
      removeFromCart: (productId) => {
        const newCart = get().cart.filter(item => item.id !== productId);
        set({
          cart: newCart,
          cartTotal: newCart.reduce((sum, item) => sum + item.subtotal, 0),
          cartItemCount: newCart.reduce((sum, item) => sum + item.cart_quantity, 0)
        });
      },
      
      updateQuantity: (productId, qty) => {
        if (qty <= 0) return get().removeFromCart(productId);
        const newCart = get().cart.map(item => 
          item.id === productId 
            ? { ...item, cart_quantity: qty, subtotal: qty * item.price }
            : item
        );
        set({
          cart: newCart,
          cartTotal: newCart.reduce((sum, item) => sum + item.subtotal, 0),
          cartItemCount: newCart.reduce((sum, item) => sum + item.cart_quantity, 0)
        });
      },
      
      clearCart: () => set({ cart: [], cartTotal: 0, cartItemCount: 0 })
    }),
    {
      name: 'ahameds-kade-pos-storage',
    }
  )
);