/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type ViewType = 
  | 'dashboard' 
  | 'search' 
  | 'addClient' 
  | 'followUps' 
  | 'profile' 
  | 'clientDetail' 
  | 'ticketDetail'
  | 'archivedClients';

export interface HistoryItem {
  view: ViewType;
  clientId: string | null;
  ticketId: string | null;
}

interface NavContextType {
  currentView: ViewType;
  history: HistoryItem[];
  activeClientId: string | null;
  activeTicketId: string | null;
  navigateTo: (view: ViewType, params?: { clientId?: string; ticketId?: string }) => void;
  goBack: () => void;
  
  // Unsaved changes tracking
  unsavedChanges: boolean;
  setUnsavedChanges: (val: boolean) => void;
  showUnsavedConfirm: boolean;
  setShowUnsavedConfirm: (val: boolean) => void;
  pendingBackAction: (() => void) | null;
  setPendingBackAction: (action: (() => void) | null) => void;

  // Scroll Position preservation
  scrollPositions: Record<string, number>;
  setScrollPosition: (view: string, position: number) => void;

  // Global search and filters preservation
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  dashboardSearchQuery: string;
  setDashboardSearchQuery: (q: string) => void;
  dashboardSearchFilter: string;
  setDashboardSearchFilter: (f: string) => void;
  searchPrefilledPhone: string;
  setSearchPrefilledPhone: (p: string) => void;

  // Modal Back handling
  activeModalCloseHandler: (() => void) | null;
  setActiveModalCloseHandler: (handler: (() => void) | null) => void;
}

const NavContext = createContext<NavContextType | undefined>(undefined);

export const NavProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [history, setHistory] = useState<HistoryItem[]>([
    { view: 'dashboard', clientId: null, ticketId: null }
  ]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // States for features
  const [unsavedChanges, setUnsavedChanges] = useState<boolean>(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState<boolean>(false);
  const [pendingBackAction, setPendingBackAction] = useState<(() => void) | null>(null);
  
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState<string>('');
  const [dashboardSearchFilter, setDashboardSearchFilter] = useState<string>('All');
  const [searchPrefilledPhone, setSearchPrefilledPhone] = useState<string>('');
  
  const [activeModalCloseHandler, setActiveModalCloseHandler] = useState<(() => void) | null>(null);

  const setScrollPosition = (view: string, position: number) => {
    setScrollPositions(prev => ({ ...prev, [view]: position }));
  };

  const navigateTo = (view: ViewType, params?: { clientId?: string; ticketId?: string }) => {
    const nextClientId = params?.clientId ?? null;
    const nextTicketId = params?.ticketId ?? null;

    const performNavigation = () => {
      if (params?.clientId) setActiveClientId(params.clientId);
      if (params?.ticketId) setActiveTicketId(params.ticketId);
      
      // Bottom navigation items reset state parameters
      if (['dashboard', 'search', 'addClient', 'followUps', 'profile'].includes(view)) {
        if (view !== 'clientDetail' && !params?.clientId) {
          setActiveClientId(null);
        }
        if (view !== 'ticketDetail' && !params?.ticketId) {
          setActiveTicketId(null);
        }
      }

      setHistory(prev => [...prev, { view, clientId: nextClientId, ticketId: nextTicketId }]);
      setCurrentView(view);
      setUnsavedChanges(false);
    };

    if (unsavedChanges) {
      setPendingBackAction(() => performNavigation);
      setShowUnsavedConfirm(true);
    } else {
      performNavigation();
    }
  };

  const goBack = () => {
    // If a popup or modal is open, close it first and do not navigate away
    if (activeModalCloseHandler) {
      activeModalCloseHandler();
      setActiveModalCloseHandler(null);
      return;
    }

    const performBack = () => {
      if (history.length > 1) {
        const newHistory = [...history];
        newHistory.pop(); // Remove current
        const prevState = newHistory[newHistory.length - 1];
        
        setHistory(newHistory);
        setCurrentView(prevState.view);
        setActiveClientId(prevState.clientId);
        setActiveTicketId(prevState.ticketId);
      } else {
        setCurrentView('dashboard');
        setActiveClientId(null);
        setActiveTicketId(null);
      }
      setUnsavedChanges(false);
    };

    if (unsavedChanges) {
      setPendingBackAction(() => performBack);
      setShowUnsavedConfirm(true);
    } else {
      performBack();
    }
  };

  // Sync browser back gesture/button with our React navigation
  useEffect(() => {
    // Push initial state
    window.history.replaceState({ historyIndex: 0 }, '');
    
    let historyIndex = 0;

    const handlePopState = (event: PopStateEvent) => {
      // Browser back button triggered
      event.preventDefault();
      
      // Call our internal goBack
      goBack();
      
      // Re-push state so that the browser's forward/back behaves consistently with our SPA view history
      window.history.pushState({ historyIndex: ++historyIndex }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [history, unsavedChanges, activeModalCloseHandler]);

  return (
    <NavContext.Provider value={{
      currentView,
      history,
      activeClientId,
      activeTicketId,
      navigateTo,
      goBack,
      unsavedChanges,
      setUnsavedChanges,
      showUnsavedConfirm,
      setShowUnsavedConfirm,
      pendingBackAction,
      setPendingBackAction,
      scrollPositions,
      setScrollPosition,
      searchQuery,
      setSearchQuery,
      dashboardSearchQuery,
      setDashboardSearchQuery,
      dashboardSearchFilter,
      setDashboardSearchFilter,
      searchPrefilledPhone,
      setSearchPrefilledPhone,
      activeModalCloseHandler,
      setActiveModalCloseHandler
    }}>
      {children}
    </NavContext.Provider>
  );
};

export const useNav = () => {
  const context = useContext(NavContext);
  if (context === undefined) {
    throw new Error('useNav must be used within a NavProvider');
  }
  return context;
};
