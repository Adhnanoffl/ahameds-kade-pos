// @ts-nocheck
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Store, Mail, Lock, User, Shield, 
  Eye, EyeOff, Loader2, CheckCircle2, UserCheck 
} from 'lucide-react';

export default function Login({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('cashier'); // default role

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Please fill in all required fields");
    
    setLoading(true);

    try {
      if (isSignUp) {
        // Registering a new staff member
        if (!fullName) {
          toast.error("Full name is required for staff registration");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role, // 'cashier' or 'manager'
            }
          }
        });

        if (error) throw error;
        
        toast.success(`Staff account created! Role assigned: ${role.toUpperCase()}`);
        setIsSignUp(false); // Switch back to login view
      } else {
        // Logging in existing staff
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
        
        const userRole = data.user?.user_metadata?.role || 'cashier';
        toast.success(`Welcome back! Logged in as ${userRole.toUpperCase()}`);
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  // Quick Action: Directly change current logged-in user's role to Cashier for rapid testing
  const forceRoleToCashier = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No active session found. Please sign in first.");
        return;
      }

      const { data, error } = await supabase.auth.updateUser({
        data: { role: 'cashier' }
      });

      if (error) throw error;
      toast.success("Your structural role has been updated to CASHIER!");
      if (onAuthSuccess) onAuthSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      
      {/* LEFT SIDE: Brand Hub & Core System Overview */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative p-12 flex-col justify-between overflow-hidden">
        {/* Background Decorative Gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl -ml-40 -mb-40"></div>
        
        {/* Top Header Branding */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-600/30">
            <Store size={28} />
          </div>
          <div>
            <span className="text-xl font-black text-white tracking-tight">Ahamed's Kade</span>
            <span className="text-xs block text-slate-400 font-bold tracking-widest uppercase mt-0.5">Supermarket ERP v2.0</span>
          </div>
        </div>

        {/* Dynamic Highlight Card */}
        <div className="relative z-10 my-auto max-w-md">
          <h2 className="text-4xl font-black text-white leading-tight tracking-tight">
            Enterprise-grade store management at your fingertips.
          </h2>
          <p className="text-slate-400 mt-4 text-base leading-relaxed font-medium">
            A unified hyper-secure environment engineered for real-time barcode scanning, fluid automated checkout, inventory controls, and live predictive analytics.
          </p>

          <div className="mt-8 space-y-3.5">
            <div className="flex items-center gap-3 text-sm font-bold text-slate-300">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> Dual-Mode Hardware Scanner Integration Enabled
            </div>
            <div className="flex items-center gap-3 text-sm font-bold text-slate-300">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> Cryptographic Role-Based Access Controls (RBAC)
            </div>
            <div className="flex items-center gap-3 text-sm font-bold text-slate-300">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> Automatic Local 80mm Thermal Print Spooler
            </div>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="text-xs font-bold text-slate-500 relative z-10 tracking-wide">
          © 2026 AHAMED'S KADE SYSTEM TRADING PLC. ALL RIGHTS RESERVED.
        </div>
      </div>

      {/* RIGHT SIDE: Interactive Auth Workspace */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-md space-y-8">
          
          {/* Section Header Switcher */}
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {isSignUp ? "Register Supermarket Staff" : "Terminal Gate Access"}
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              {isSignUp 
                ? "Provision a secure system node with specific checkout or administrative privileges." 
                : "Please enter your cryptographic corporate credentials to access the terminal grids."}
            </p>
          </div>

          {/* Form Processing Unit */}
          <form onSubmit={handleAuth} className="space-y-5">
            
            {isSignUp && (
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">Staff Member Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 bg-slate-50/50 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 font-medium transition-all"
                    placeholder="e.g. Aslam Ahamed" 
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">Corporate Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  required
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 border border-slate-200 bg-slate-50/50 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 font-medium transition-all"
                  placeholder="name@kade.com" 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">Security Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  required
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 border border-slate-200 bg-slate-50/50 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-800 font-bold tracking-wide transition-all"
                  placeholder="••••••••••••" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Role Assignment Module (Shown only during staff creation) */}
            {isSignUp && (
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">System Level Access Role</label>
                <div className="relative">
                  <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 bg-slate-50/50 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-700 font-bold appearance-none transition-all cursor-pointer"
                  >
                    <option value="cashier">Cashier (POS Checkout Access Only)</option>
                    <option value="manager">Manager (Full ERP, Dashboard & Warehouse Controls)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Submit Action */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/10 transition-all active:scale-[0.99]"
            >
              {loading ? <Loader2 className="animate-spin" size={22} /> : (isSignUp ? 'PROVISION STAFF PROFILE' : 'INITIALIZE SYSTEM SESSION')}
            </button>
          </form>

          {/* Toggle Screen Actions */}
          <div className="text-center space-y-4 pt-2">
            <button 
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4"
            >
              {isSignUp ? "Already have an account? Access Terminal" : "Need to onboard a new user? Register Staff"}
            </button>
            
            <div className="relative flex py-2 items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="mx-4">Developer Override Matrix</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Immediate Testing Button: Switch current user to cashier status */}
            <button
              type="button"
              onClick={forceRoleToCashier}
              disabled={loading}
              className="w-full py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <UserCheck size={16} /> FORCE LOGGED IN USER ROLE TO: "CASHIER" (FOR TESTING)
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}