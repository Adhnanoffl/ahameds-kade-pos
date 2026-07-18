// @ts-nocheck
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
    // 1. Safely check active session on load without crashing
    const checkSession = async () => {
      try {
        if (supabase.auth.getSession) {
          // Supabase v2
          const { data } = await supabase.auth.getSession();
          setSession(data?.session || null);
        } else {
          // Supabase v1 fallback
          setSession(supabase.auth.session());
        }
      } catch (error) {
        console.error("Session check failed:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // 2. Listen for login/logout events
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
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