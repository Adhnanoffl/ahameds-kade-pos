import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface DbProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  purchase_price: number;
  selling_price: number;
  stock: number;
  weight_based: boolean;
}

export function useProducts() {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Fetch products from Supabase
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      if (data) {
        setProducts(data);
      }
    } catch (error: any) {
      console.error('Error fetching products:', error.message);
      toast.error('Failed to load products from database');
    } finally {
      setLoading(false);
    }
  };

  return { products, loading, refreshProducts: fetchProducts };
}