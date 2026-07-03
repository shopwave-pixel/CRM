/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useNav } from '../context/NavContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Moon, Sun, Database, Cloud } from 'lucide-react';
import { getStoredAppsScriptUrl } from '../services/api';

export const Header: React.FC = () => {
  const { currentView, goBack, history } = useNav();
  const { theme, toggleTheme } = useTheme();
  const { profile } = useAuth();
  const isGasConnected = !!getStoredAppsScriptUrl();

  const getTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return 'CRM Dashboard';
      case 'search':
        return 'Search Records';
      case 'addClient':
        return 'Add New Client';
      case 'followUps':
        return "Today's Follow Ups";
      case 'profile':
        return 'User & Settings';
      case 'clientDetail':
        return 'Client Profile';
      case 'ticketDetail':
        return 'Ticket Timeline';
      default:
        return 'Mobile CRM';
    }
  };

  const showBack = history.length > 1;

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 px-4 h-16 flex items-center justify-between shadow-sm max-w-md mx-auto">
      <div className="flex items-center gap-2">
        {showBack ? (
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 py-1.5 px-2.5 -ml-2 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            aria-label="Go back"
            id="header-back-button"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <ArrowLeft className="w-4 h-4 text-blue-500" />
            <span>Back</span>
          </button>
        ) : null}
        
        <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-none">
          {getTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Status Badge */}
        {profile && (
          <div 
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
              isGasConnected 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30'
            }`}
            title={isGasConnected ? "Connected to Google Sheets" : "Running in Sandbox Database mode"}
          >
            {isGasConnected ? (
              <>
                <Cloud className="w-3 h-3" />
                <span>Sheets</span>
              </>
            ) : (
              <>
                <Database className="w-3 h-3" />
                <span>Sandbox</span>
              </>
            )}
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
          aria-label="Toggle theme"
          id="theme-toggle-button"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      </div>
    </header>
  );
};
export default Header;
