/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NavProvider, useNav } from './context/NavContext';
import { OfflineProvider, useOffline } from './context/OfflineContext';
import { Toaster, toast } from 'react-hot-toast';
import { AnimatePresence, motion } from 'motion/react';
import { FileSpreadsheet, AlertTriangle, WifiOff, RefreshCw, Layers } from 'lucide-react';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import AddClient from './pages/AddClient';
import FollowUps from './pages/FollowUps';
import Profile from './pages/Profile';
import ClientProfile from './pages/ClientProfile';
import TicketPage from './pages/TicketPage';
import ArchivedClients from './pages/ArchivedClients';

// Components
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import FloatingActionButton from './components/FloatingActionButton';
import { CallResultModal } from './components/CallResultModal';
import { crmApi } from './services/api';
import { Client } from './types';
import { SetupWizard } from './components/SetupWizard';

const MainAppContent: React.FC = () => {
  const { user, authorized, loading, profile } = useAuth();
  const { isOffline, isSyncing, queue, conflictItem, resolveConflict } = useOffline();
  
  const [showSyncSuccessBanner, setShowSyncSuccessBanner] = React.useState<boolean>(false);
  const prevIsSyncingRef = React.useRef<boolean>(isSyncing);

  React.useEffect(() => {
    if (prevIsSyncingRef.current && !isSyncing && queue.length === 0 && !isOffline) {
      setShowSyncSuccessBanner(true);
      const timer = setTimeout(() => {
        setShowSyncSuccessBanner(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing, queue.length, isOffline]);

  const [setupCompleted, setSetupCompleted] = React.useState<boolean>(() => {
    return localStorage.getItem('crm_setup_completed') === 'true' || !!localStorage.getItem('GOOGLE_APPS_SCRIPT_URL');
  });
  const { 
    currentView, 
    navigateTo,
    scrollPositions, 
    setScrollPosition,
    showUnsavedConfirm,
    setShowUnsavedConfirm,
    pendingBackAction,
    setPendingBackAction,
    setUnsavedChanges
  } = useNav();

  const [activeCallClient, setActiveCallClient] = React.useState<Client | null>(null);
  const [callModalOpen, setCallModalOpen] = React.useState<boolean>(false);

  // Check if owner
  const isOwner = profile?.role === 'Owner' || profile?.role === 'Admin';

  // Protect Owner-only views
  React.useEffect(() => {
    if (currentView === 'archivedClients' && !isOwner && !loading && authorized) {
      toast.error('403 Forbidden: Access Denied. Owner access required.');
      navigateTo('dashboard');
    }
  }, [currentView, isOwner, loading, authorized, navigateTo]);

  // Setup listener for phone calls to automatically trigger Call Result Modal
  React.useEffect(() => {
    const handlePhoneCallEvent = async (e: any) => {
      const { phoneNumber, client } = e.detail || {};
      if (client) {
        setActiveCallClient(client);
        setTimeout(() => {
          setCallModalOpen(true);
        }, 1200);
      } else {
        try {
          const list = await crmApi.getClients();
          const cleanNum = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
          const matched = list.find(c => {
            const cleanCPhone = c.phone.replace(/[\s\-\(\)\+]/g, '');
            return cleanCPhone.includes(cleanNum) || cleanNum.includes(cleanCPhone);
          });
          if (matched) {
            setActiveCallClient(matched);
            setTimeout(() => {
              setCallModalOpen(true);
            }, 1200);
          }
        } catch (err) {
          console.error('Error matching client for call result:', err);
        }
      }
    };

    window.addEventListener('crm-phone-call', handlePhoneCallEvent);
    return () => window.removeEventListener('crm-phone-call', handlePhoneCallEvent);
  }, []);

  const mainRef = React.useRef<HTMLDivElement>(null);
  const prevViewRef = React.useRef<string>(currentView);

  // Track and restore scroll positions on view changes
  React.useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    // Save previous scroll position
    if (prevViewRef.current !== currentView) {
      setScrollPosition(prevViewRef.current, mainEl.scrollTop);
    }

    // Restore current scroll position
    const savedScroll = scrollPositions[currentView] || 0;
    const timer = setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.scrollTop = savedScroll;
      }
    }, 40);

    prevViewRef.current = currentView;
    return () => clearTimeout(timer);
  }, [currentView, scrollPositions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-900 dark:text-slate-100">
        <div className="space-y-4 text-center animate-pulse">
          <div className="inline-flex items-center justify-center p-4 bg-blue-600/10 dark:bg-blue-400/10 rounded-3xl border border-blue-500/20">
            <FileSpreadsheet className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-bounce" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Accessing Secure Ledger...</h1>
          <p className="text-xs text-slate-400 font-medium">Verifying credentials and Sheets sync status</p>
        </div>
      </div>
    );
  }

  // Google Authentication Router Protection
  if (!user || !authorized) {
    return <Login />;
  }

  // Automatic First-Time Setup Wizard
  if (!setupCompleted) {
    return <SetupWizard onComplete={() => setSetupCompleted(true)} />;
  }

  // View Router Map
  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'search':
        return <Search />;
      case 'addClient':
        return <AddClient />;
      case 'followUps':
        return <FollowUps />;
      case 'profile':
        return <Profile />;
      case 'clientDetail':
        return <ClientProfile />;
      case 'ticketDetail':
        return <TicketPage />;
      case 'archivedClients':
        return <ArchivedClients />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-900 dark:text-slate-100 flex items-center justify-center p-0 md:p-6 lg:p-12 selection:bg-blue-500/30 font-sans">
      <div className="flex items-center justify-center w-full max-w-5xl mx-auto">
        
        {/* Device Frame (responsive: full-screen on mobile, rounded device frame on medium/large screens) */}
        <div className="relative w-full max-w-md md:w-[375px] md:h-[735px] md:rounded-[48px] md:border-[8px] md:border-slate-800 dark:md:border-slate-800 md:shadow-2xl overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
          
          {/* Status Bar Notch (only visible on device mode) */}
          <div className="hidden md:flex absolute top-0 w-full h-8 bg-transparent justify-center items-center z-50 pointer-events-none">
            <div className="w-32 h-5 bg-slate-800 rounded-b-2xl"></div>
          </div>

          {/* Sticky Offline / Sync Banner */}
          {isOffline && (
            <div className="bg-rose-600 text-white text-[11px] leading-tight py-2.5 px-4 text-center font-bold flex flex-col items-center justify-center gap-0.5 shadow-md shrink-0 animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                <span>🔴 Offline Mode</span>
              </div>
              <span className="font-medium opacity-90">You're working offline. All changes are saved locally and will sync automatically when internet is available.</span>
            </div>
          )}

          {!isOffline && isSyncing && (
            <div className="bg-blue-600 text-white text-[11px] leading-tight py-2.5 px-4 text-center font-bold flex flex-col items-center justify-center gap-0.5 shadow-md shrink-0 animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                <span>🟢 Online</span>
              </div>
              <span className="font-medium opacity-90">Synchronizing data...</span>
            </div>
          )}

          {!isOffline && !isSyncing && showSyncSuccessBanner && (
            <div className="bg-green-600 text-white text-[11px] leading-tight py-2.5 px-4 text-center font-bold flex items-center justify-center gap-1.5 shadow-md shrink-0 animate-in slide-in-from-top duration-200">
              <span>✅ All pending changes have been synchronized successfully.</span>
            </div>
          )}

          <Header />
          
          {/* Animated View Container */}
          <main 
            ref={mainRef}
            className="flex-1 overflow-y-auto px-4 pt-5 pb-24 md:pt-6 bg-slate-50 dark:bg-slate-950"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="w-full"
              >
                {renderActiveView()}
              </motion.div>
            </AnimatePresence>
          </main>

          <FloatingActionButton />
          <BottomNav />
        </div>

        {/* Unsaved Changes Confirmation Modal */}
        {showUnsavedConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xs p-6 border border-slate-100 dark:border-slate-800 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-500">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Unsaved Changes</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  You have unsaved changes. Do you want to leave this page?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedConfirm(false);
                    setPendingBackAction(null);
                  }}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer"
                  style={{ minHeight: '44px' }}
                  id="confirm-stay-button"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnsavedChanges(false);
                    setShowUnsavedConfirm(false);
                    if (pendingBackAction) {
                      pendingBackAction();
                      setPendingBackAction(null);
                    }
                  }}
                  className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black active:scale-95 transition-all cursor-pointer"
                  style={{ minHeight: '44px' }}
                  id="confirm-leave-button"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Call Result Dialog Tracker */}
        <CallResultModal
          isOpen={callModalOpen}
          onClose={() => {
            setCallModalOpen(false);
            setActiveCallClient(null);
          }}
          client={activeCallClient}
          currentUser={{ name: profile?.name, email: user?.email }}
          onSaved={() => {
            window.dispatchEvent(new Event('clients-updated'));
          }}
        />

        {/* Enterprise Offline Conflict Resolution Modal */}
        {conflictItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 text-rose-500">
                <WifiOff className="w-5 h-5 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider">Conflict Detected</h3>
              </div>
              
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  A client or record has been updated on another device. Select which version to keep:
                </p>
              </div>

              {/* Conflict Columns */}
              <div className="grid grid-cols-2 gap-2 text-xs border border-slate-100 dark:border-slate-800 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/40">
                <div className="space-y-1 border-r border-slate-100 dark:border-slate-800 pr-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400">Local Version</span>
                  <p className="text-[10px] text-slate-500 break-all">Name: {conflictItem.local?.name || 'N/A'}</p>
                  <p className="text-[10px] text-slate-500">Status: {conflictItem.local?.status || 'N/A'}</p>
                  <p className="text-[10px] text-slate-500">Phone: {conflictItem.local?.phone || 'N/A'}</p>
                  <p className="text-[10px] text-slate-550 italic">Last Offline Edit</p>
                </div>
                <div className="space-y-1 pl-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400">Server Version</span>
                  <p className="text-[10px] text-slate-500 break-all">Name: {conflictItem.server?.name || 'N/A'}</p>
                  <p className="text-[10px] text-slate-500">Status: {conflictItem.server?.status || 'N/A'}</p>
                  <p className="text-[10px] text-slate-500">Phone: {conflictItem.server?.phone || 'N/A'}</p>
                  <p className="text-[10px] text-slate-550 italic">Cloud Record</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => resolveConflict('local')}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Keep Local Version (Overwrite Cloud)
                </button>
                <button
                  type="button"
                  onClick={() => resolveConflict('server')}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Keep Server Version (Discard Local)
                </button>
                <button
                  type="button"
                  onClick={() => resolveConflict('merge')}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Merge Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Descriptive Right Panel (hidden on mobile, shown on lg screens) */}
        <div className="ml-12 max-w-md hidden lg:block text-left">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-[32px] border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-500 w-3 h-3 rounded-full animate-pulse"></div>
              <p className="text-white font-bold tracking-widest text-xs uppercase">Live Deployment</p>
            </div>
            <h2 className="text-4xl font-black text-white leading-tight mb-4">Enterprise CRM Mobile Suite</h2>
            <p className="text-slate-300 text-base mb-8 leading-relaxed">Fully integrated with Google Sheets. Real-time REST API sync. Firebase Secure. Built for operational speed.</p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 text-slate-200 text-sm font-semibold">
                <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/10">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span>Google OAuth 2.0 Auth Only</span>
              </div>
              <div className="flex items-center gap-3.5 text-slate-200 text-sm font-semibold">
                <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/10">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span>Sheets-as-a-Database Architecture</span>
              </div>
              <div className="flex items-center gap-3.5 text-slate-200 text-sm font-semibold">
                <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/10">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span>WhatsApp/Call Native Integration</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <OfflineProvider>
        <AuthProvider>
          <NavProvider>
            <Toaster 
              position="top-center"
              toastOptions={{
                duration: 3500,
                className: 'font-semibold text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 dark:text-white text-slate-900 shadow-xl',
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#ffffff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#f43f5e',
                    secondary: '#ffffff',
                  },
                },
              }}
            />
            <MainAppContent />
          </NavProvider>
        </AuthProvider>
      </OfflineProvider>
    </ThemeProvider>
  );
}
