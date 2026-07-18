import React, { useState, useMemo } from 'react';
import { 
    useReactTable, 
//@ts-ignore
    getCoreRowModel, 
  flexRender, 
//@ts-ignore  
  createColumnHelper 
} from '@tanstack/react-table';
import { Plus, Search, Layers, ArrowUpDown, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  unit: string;
}

const INITIAL_DATA: InventoryItem[] = [
  { id: '1', sku: 'VEG-SAM-01', name: 'Samba Rice', category: 'Grains', purchasePrice: 210, sellingPrice: 250, stock: 50, unit: 'kg' },
  { id: '2', sku: 'VEG-ONN-02', name: 'Red Onion', category: 'Vegetables', purchasePrice: 140, sellingPrice: 180, stock: 20, unit: 'kg' },
  { id: '3', sku: 'BCK-CRM-03', name: 'Munchee Cream Cracker', category: 'Biscuits', purchasePrice: 130, sellingPrice: 150, stock: 100, unit: 'pcs' },
  { id: '4', sku: 'MIL-HIG-04', name: 'Highland Milk Powder', category: 'Dairy', purchasePrice: 980, sellingPrice: 1100, stock: 5, unit: 'pcs' },
  { id: '5', sku: 'VEG-CRT-05', name: 'Carrot', category: 'Vegetables', purchasePrice: 90, sellingPrice: 120, stock: 10, unit: 'kg' },
];

export default function Inventory() {
  const [data, setData] = useState<InventoryItem[]>(INITIAL_DATA);
  const [globalFilter, setGlobalFilter] = useState('');

  const filteredData = useMemo(() => {
    return data.filter(item => 
      item.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
      item.sku.toLowerCase().includes(globalFilter.toLowerCase()) ||
      item.category.toLowerCase().includes(globalFilter.toLowerCase())
    );
  }, [data, globalFilter]);

  const handleQuickStockUpdate = (id: string, currentStock: number) => {
    const amountStr = prompt(`Update stock level. Enter new count:`, currentStock.toString());
    if (amountStr === null) return;
    const amount = parseInt(amountStr, 10);
    
    if (isNaN(amount) || amount < 0) {
      return toast.error("Please enter a valid positive number");
    }

    setData(prev => prev.map(item => item.id === id ? { ...item, stock: amount } : item));
    toast.success("Stock system updated successfully");
  };

  const columnHelper = createColumnHelper<InventoryItem>();

  const columns = useMemo(() => [
    columnHelper.accessor('sku', {
      header: 'SKU / ID',
      cell: (info: any) => <span className="font-mono text-xs text-gray-500">{info.getValue()}</span>,
    }),
    columnHelper.accessor('name', {
      header: 'Product Name',
      cell: (info: any) => <span className="font-bold text-gray-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: (info: any) => <span className="bg-gray-100 px-2 py-1 rounded-md text-xs font-semibold text-gray-600">{info.getValue()}</span>,
    }),
    columnHelper.accessor('purchasePrice', {
      header: 'Cost (LKR)',
      cell: (info: any) => <span>{info.getValue().toFixed(2)}</span>,
    }),
    columnHelper.accessor('sellingPrice', {
      header: 'Price (LKR)',
      cell: (info: any) => <span className="font-semibold text-brand-600">{info.getValue().toFixed(2)}</span>,
    }),
    columnHelper.accessor('stock', {
      header: 'Stock Level',
      cell: (info: any) => {
        const stock = info.getValue();
        const row = info.row.original;
        const isLow = stock <= 20;
        return (
          <button 
            onClick={() => handleQuickStockUpdate(row.id, stock)}
            className={`px-3 py-1.5 rounded-xl font-bold text-sm tracking-wide transition-transform active:scale-95 ${
              isLow ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}
          >
            {stock} {row.unit}
          </button>
        );
      },
    }),
  ], [data]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-4 lg:p-8 space-y-6 pb-24 lg:pb-8">
      {/* Top action block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Inventory Catalog</h1>
          <p className="text-gray-500">Track and update stock levels instantly with tap-to-edit counts.</p>
        </div>
        <button 
          onClick={() => toast.success("Feature coming in upcoming production build")}
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-5 py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus size={20} /> Add Product
        </button>
      </div>

      {/* Filter controls */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Search items by code, label, or grouping..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm transition-all"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id} className="bg-gray-50 border-b border-gray-100">
                  {headerGroup.headers.map((header: any) => (
                    <th key={header.id} className="p-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 text-sm">
                    No items matching your search requirements.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row: any) => (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors last:border-none">
                    {row.getVisibleCells().map((cell: any) => (
                      <td key={cell.id} className="p-4 text-sm align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}