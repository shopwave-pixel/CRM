/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth, hashPassword } from '../context/AuthContext';
import { LogIn, ShieldAlert, Sparkles, Database, FileSpreadsheet, Eye, EyeOff, Lock, User } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { login, changePassword, refreshAuth, loading, authError } = useAuth();

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Force password change state
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim()) {
      toast.error('Please enter your Login ID.');
      return;
    }
    if (!password) {
      toast.error('Please enter your Password.');
      return;
    }

    const hashed = await hashPassword(password);
    const result = await login(loginId.trim(), hashed, rememberMe);

    if (result.success) {
      if (result.forcePasswordChange) {
        setMustChangePassword(true);
        toast.success('Login successful! You are required to change your password now.');
      } else {
        // Proceed automatically since auth status is updated
      }
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const hashed = await hashPassword(newPassword);
      const res = await changePassword(hashed);
      if (res.success) {
        toast.success('Your password has been changed successfully!');
        await refreshAuth(); // Proceed to dashboard
      } else {
        toast.error(res.message || 'Failed to update password.');
      }
    } catch (err: any) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-slate-100 selection:bg-blue-500/30">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Animated Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-3"
        >
          <div className="inline-flex items-center justify-center p-3.5 bg-blue-600/10 dark:bg-blue-400/10 rounded-3xl border border-blue-500/20 shadow-inner">
            <FileSpreadsheet className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Enterprise Mobile CRM
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Secure Corporate Access Terminal
            </p>
          </div>
        </motion.div>

        {/* Change default password view */}
        {mustChangePassword ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800/80 shadow-xl space-y-6 text-left"
          >
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                <Lock className="w-5 h-5 text-amber-500 animate-pulse" />
                <span>Change Default Password</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                For security reasons, you must change your default password before entering the CRM dashboard.
              </p>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl py-3 px-4 text-sm font-medium transition-all outline-none"
                    style={{ minHeight: '44px' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl py-3 px-4 text-sm font-medium transition-all outline-none"
                    style={{ minHeight: '44px' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full flex items-center justify-center gap-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3.5 px-6 rounded-2xl shadow-lg active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all cursor-pointer text-sm"
                style={{ minHeight: '44px' }}
              >
                {changingPassword ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Change Password &amp; Proceed</span>
                )}
              </button>
            </form>
          </motion.div>
        ) : (
          /* Standard Login View */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800/80 shadow-xl dark:shadow-slate-950/50 space-y-6 text-left"
          >
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Authorized Personnel Only
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Log in using your corporate CRM credentials. Keep your session credentials secure.
              </p>
            </div>

            {/* Authorization Error Banner */}
            {authError && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs rounded-2xl flex items-start gap-3 text-left leading-relaxed shadow-sm"
              >
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Authorization Denied</span>
                  {authError}
                </div>
              </motion.div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Login ID
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="e.g., ADM001"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium transition-all outline-none"
                    style={{ minHeight: '44px' }}
                    id="login-id-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider flex justify-between items-center">
                  <span>Password</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline outline-none flex items-center gap-1"
                    id="show-password-toggle"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Show</span>
                      </>
                    )}
                  </button>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium transition-all outline-none"
                    style={{ minHeight: '44px' }}
                    id="password-input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-offset-0"
                    id="remember-me-checkbox"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Remember Me
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-2xl shadow-lg hover:shadow-blue-500/20 active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all cursor-pointer border border-blue-500/20 text-sm"
                style={{ minHeight: '44px' }}
                id="login-button"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Login</span>
                  </>
                )}
              </button>
            </form>

            <div className="flex justify-center items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-50 dark:border-slate-800/50">
              <div className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                <span>Local DB Hashed Auth</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mobile Optimized</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer info */}
        <p className="text-[11px] text-slate-400 dark:text-slate-600 font-medium tracking-tight">
          Enterprise Mobile CRM &copy; 2026. Secure Credentials Auth. Version 4.0.0
        </p>
      </div>
    </div>
  );
};
export default Login;
