import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import POS from './pages/POS';

// Placeholder for other pages to ensure routing works
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center h-full text-2xl font-bold text-gray-300">
    {title} Screen
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<POS />} />
          <Route path="dashboard" element={<Placeholder title="Dashboard" />} />
          <Route path="inventory" element={<Placeholder title="Inventory" />} />
          <Route path="customers" element={<Placeholder title="Customers" />} />
          <Route path="settings" element={<Placeholder title="Settings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}