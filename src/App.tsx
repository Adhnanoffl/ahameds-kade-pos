//@ts-nocheck
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';

// Layout & Pages
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Login from './pages/Login';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active session on load
    const currentSession = supabase.auth.session();
    setSession(currentSession);
    setLoading(false);

    // 2. Listen for login/logout events
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  // Show nothing while checking auth status to prevent flashing
  if (loading) return null; 

  // If no user is logged in, ONLY show the Login screen
  if (!session) {
    return (
      <>
        <Toaster position="top-center" />
        <Login />
      </>
    );
  }

  // If user is logged in, show the App with the Sidebar and all routes
  return (
    <Router>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/inventory" element={<Inventory />} />
            {/* NEW ROUTES ADDED HERE */}
            <Route path="/customers" element={<Customers />} />
            <Route path="/settings" element={<Settings />} />
            
            {/* Catch-all route sends unknown URLs back to Dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-center" />
    </Router>
  );
}