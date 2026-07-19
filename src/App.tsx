//@ts-nocheck
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { Loader2, ShieldAlert } from 'lucide-react';

// Layout & Pages
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Login from './pages/Login';

// 1. Strict TypeScript Interfaces for Enterprise Safety
interface UserProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'manager' | 'cashier';
  pin_code?: string;
  avatar_url?: string;
}

// 2. Protected Route Component (The Security Gatekeeper)
interface ProtectedRouteProps {
  isAllowed: boolean;
  redirectPath?: string;
  children: React.ReactNode;
}

const ProtectedRoute = ({ isAllowed, redirectPath = '/pos', children }: ProtectedRouteProps) => {
  if (!isAllowed) {
    return <Navigate to={redirectPath} replace />;
  }
  return <>{children}</>;
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);

  // Helper function to fetch user profile details from our custom table
  const fetchUserProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, pin_code, avatar_url')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data as UserProfile);
    } catch (err) {
      console.error("Error fetching user management profile:", err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    // Check initial active session on application load
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const currentSession = data?.session || null;
        setSession(currentSession);
        
        if (currentSession?.user?.id) {
          await fetchUserProfile(currentSession.user.id);
        }
      } catch (error) {
        console.error("Session verification failed:", error);
      } finally {
        setAuthLoading(false);
      }
    };

    checkSession();

    // Dynamically listen for sign-in/sign-out events
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user?.id) {
        await fetchUserProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Professional Animated Loading Screen while booting up
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={44} />
        <p className="text-slate-600 font-medium text-sm tracking-wide">
          Securing terminal connection...
        </p>
      </div>
    );
  }

  // If no user session exists, send straight to login
  if (!session) {
    return (
      <>
        <Toaster position="top-center" />
        <Login />
      </>
    );
  }

  // Define access shortcuts based on roles
  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';
  const isAdminOnly = profile?.role === 'admin';

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans antialiased text-slate-800">
        
        {/* Pass user profile down to sidebar so it can dynamically hide options */}
        <Sidebar userProfile={profile} />
        
        <main className="flex-1 overflow-y-auto relative focus:outline-none">
          <Routes>
            {/* Restricted Route: Dashboard (Admins & Managers Only) */}
            <Route path="/" element={
              <ProtectedRoute isAllowed={isAdminOrManager} redirectPath="/pos">
                <Dashboard />
              </ProtectedRoute>
            } />

            {/* Public Terminals: All Authenticated Staff can run transactions */}
            <Route path="/pos" element={<POS />} />
            
            {/* Restricted Route: Inventory Management (Admins & Managers Only) */}
            <Route path="/inventory" element={
              <ProtectedRoute isAllowed={isAdminOrManager} redirectPath="/pos">
                <Inventory />
              </ProtectedRoute>
            } />

            {/* Shared Route: Customers Management (All Staff) */}
            <Route path="/customers" element={<Customers />} />
            
            {/* Strict Route: Application Settings (Absolute Admins Only) */}
            <Route path="/settings" element={
              <ProtectedRoute isAllowed={isAdminOnly} redirectPath="/pos">
                <Settings />
              </ProtectedRoute>
            } />
            
            {/* Fallback Strategy */}
            <Route path="*" element={<Navigate to={isAdminOrManager ? "/" : "/pos"} replace />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-center" />
    </Router>
  );
}