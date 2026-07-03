/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { crmApi } from '../services/api';
import { offlineDb } from '../services/offlineDb';
import toast from 'react-hot-toast';

// Helper to compute SHA-256 hash using native Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

interface AuthContextType {
  user: { email: string; displayName: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  authorized: boolean;
  authError: string | null;
  login: (loginId: string, passwordHash: string, rememberMe: boolean) => Promise<{ success: boolean; forcePasswordChange?: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  changePassword: (newPasswordHash: string) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ email: string; displayName: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkUserAuthorization = async () => {
    try {
      const token = localStorage.getItem('CRM_SESSION_TOKEN');
      if (!token) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Verify the session token with the backend
      const res = await crmApi.checkUser();
      
      if (res.authorized && res.user) {
        setProfile(res.user);
        setUser({
          email: res.user.email || '',
          displayName: res.user.fullName
        });
        setAuthorized(true);
        setAuthError(null);
      } else {
        localStorage.removeItem('CRM_SESSION_TOKEN');
        setProfile(null);
        setUser(null);
        setAuthorized(false);
        setAuthError(res.message || 'Session expired or unauthorized.');
      }
    } catch (err: any) {
      console.error('Auth verification error:', err);
      setProfile(null);
      setUser(null);
      setAuthorized(false);
      setAuthError('Connection failed. Please verify your Internet connection and Google Apps Script setup.');
    } finally {
      setLoading(false);
    }
  };

  const refreshAuth = async () => {
    setLoading(true);
    await checkUserAuthorization();
  };

  useEffect(() => {
    checkUserAuthorization();
  }, []);

  const login = async (loginId: string, passwordHash: string, rememberMe: boolean) => {
    setLoading(true);
    setAuthError(null);

    // If working offline, authenticate via local encrypted cache
    if (!navigator.onLine) {
      try {
        const cachedAuth = await offlineDb.getCache<{ loginId: string; passwordHash: string; profile: UserProfile }>('cached_auth');
        if (cachedAuth && cachedAuth.loginId.toLowerCase() === loginId.toLowerCase() && cachedAuth.passwordHash === passwordHash) {
          localStorage.setItem('CRM_SESSION_TOKEN', 'offline_session_token');
          setProfile(cachedAuth.profile);
          setUser({
            email: cachedAuth.profile.email || '',
            displayName: cachedAuth.profile.fullName
          });
          setAuthorized(true);
          setAuthError(null);
          toast.success(`Welcome back (offline mode), ${cachedAuth.profile.fullName}!`);
          setLoading(false);
          return { success: true };
        } else {
          const errorMsg = 'Offline login not available. Please verify credentials or connect to the internet.';
          setAuthError(errorMsg);
          toast.error(errorMsg);
          setAuthorized(false);
          setLoading(false);
          return { success: false, error: errorMsg };
        }
      } catch (err) {
        const errorMsg = 'Failed to authenticate offline.';
        setAuthError(errorMsg);
        toast.error(errorMsg);
        setAuthorized(false);
        setLoading(false);
        return { success: false, error: errorMsg };
      }
    }

    try {
      // Direct login POST request
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-apps-script-url': localStorage.getItem('GOOGLE_APPS_SCRIPT_URL') || ''
        },
        body: JSON.stringify({ loginId, passwordHash, rememberMe })
      });

      const res = await response.json();

      if (response.ok && res.success && res.token && res.user) {
        localStorage.setItem('CRM_SESSION_TOKEN', res.token);
        setProfile(res.user);
        setUser({
          email: res.user.email || '',
          displayName: res.user.fullName
        });
        setAuthorized(true);
        setAuthError(null);

        // Securely cache login session and credentials for subsequent offline logins
        await offlineDb.setCache('cached_auth', { loginId, passwordHash, profile: res.user });
        await offlineDb.setCache('cached_profile', res.user);

        toast.success(`Welcome back, ${res.user.fullName}!`);
        return { success: true, forcePasswordChange: res.forcePasswordChange };
      } else {
        const errorMsg = res.error || 'Login failed. Please check your credentials.';
        setAuthError(errorMsg);
        toast.error(errorMsg);
        setAuthorized(false);
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errMsg = 'Failed to login. Please try again.';
      setAuthError(errMsg);
      toast.error(errMsg);
      setAuthorized(false);
      return { success: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('CRM_SESSION_TOKEN');
      setUser(null);
      setProfile(null);
      setAuthorized(false);
      setAuthError(null);
      toast.success('Logged out successfully.');
    } catch (err: any) {
      console.error('Sign out error:', err);
      toast.error('Failed to log out.');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (newPasswordHash: string) => {
    try {
      if (!profile) {
        throw new Error('No user logged in.');
      }
      
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('CRM_SESSION_TOKEN')}`,
          'x-apps-script-url': localStorage.getItem('GOOGLE_APPS_SCRIPT_URL') || ''
        },
        body: JSON.stringify({ loginId: profile.loginId, newPasswordHash })
      });

      const res = await response.json();
      if (response.ok && res.success) {
        toast.success('Password changed successfully!');
        if (profile.notes === 'FORCE_CHANGE') {
          // Update local profile notes
          setProfile(prev => prev ? { ...prev, notes: '' } : null);
        }
        return { success: true };
      } else {
        return { success: false, message: res.error || 'Failed to change password.' };
      }
    } catch (err: any) {
      console.error('Change password error:', err);
      return { success: false, message: err.message || 'Error occurred.' };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      authorized,
      authError,
      login,
      logout,
      refreshAuth,
      changePassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
