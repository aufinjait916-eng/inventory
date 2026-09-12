import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Lock, Mail, ArrowRight, AlertCircle, Wrench, ShieldCheck, HelpCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('Please enter your email address or username.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const result = await login(identifier.trim(), password);
      if (!result.success) {
        setErrorMessage(result.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while logging in.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (user: string, pass: string) => {
    setIdentifier(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-[#F8FAFC] text-slate-700 p-4 relative overflow-hidden">
      {/* Background Subtle Gradient Glow with Soft Amber */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-orange-100/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-5">
        {/* Branding Logo & Title */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/80 shadow-2xs text-amber-700 mb-1">
            <span className="font-semibold text-base tracking-tight">
              AU
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-800 flex items-center justify-center gap-2">
            <span>AU Assetflow</span>
          </h1>
          <p className="text-xs font-medium text-amber-700/90 tracking-wide">
            AU Equipment & Tools
          </p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Industrial inventory tracking, asset life-cycle management & maintenance
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 sm:p-7 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="login-identifier" className="block font-medium text-slate-700">
                  Email Address or Username
                </label>
                <span
                  title="Use admin@assetflow.internal or manager@assetflow.internal"
                  className="text-[10px] text-slate-400 hover:text-amber-600 cursor-help flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Help</span>
                </span>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  tabIndex={1}
                  placeholder="admin@assetflow.internal"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  title="Enter your username or email address (Press Tab to advance to Password)"
                  className="w-full pl-10 pr-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition text-xs font-normal"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block font-medium text-slate-700">
                  Password
                </label>
                <span className="text-[10px] text-slate-400">Default demo: admin123</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type="password"
                  required
                  tabIndex={2}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  title="Enter your account password (Press Tab to advance to Sign In button)"
                  className="w-full pl-10 pr-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition text-xs font-normal"
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              tabIndex={3}
              disabled={loading}
              title="Click to sign in to AU Assetflow (or press Enter)"
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-medium rounded-xl shadow-2xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 text-xs mt-1"
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In to AU Assetflow</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Pills */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] font-normal text-slate-400 mb-2 text-center">
              Quick One-Click Demo Access:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                tabIndex={4}
                onClick={() => handleQuickFill('admin@assetflow.internal', 'admin123')}
                title="Populate Admin credentials (Full Access & Configuration)"
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-[11px] font-medium text-amber-700 hover:text-amber-800 transition text-center cursor-pointer"
              >
                System Admin
              </button>
              <button
                type="button"
                tabIndex={5}
                onClick={() => handleQuickFill('manager@assetflow.internal', 'manager123')}
                title="Populate Manager credentials (Stock & Approvals)"
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-[11px] font-medium text-slate-600 hover:text-slate-800 transition text-center cursor-pointer"
              >
                Super Manager
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 font-normal">
          AU Assetflow • PostgreSQL Dual Storage • Multi-Branch Architecture
        </div>
      </div>
    </div>
  );
};
