/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useNav, ViewType } from '../context/NavContext';
import { LayoutDashboard, Search, UserPlus, CalendarClock, User } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { currentView, navigateTo } = useNav();

  const navItems = [
    { view: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
    { view: 'search' as ViewType, label: 'Search', icon: Search },
    { view: 'addClient' as ViewType, label: 'Add Client', icon: UserPlus },
    { view: 'followUps' as ViewType, label: 'Follow Ups', icon: CalendarClock },
    { view: 'profile' as ViewType, label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800/80 px-2 pb-safe-bottom shadow-[0_-4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          const Icon = item.icon;

          return (
            <button
              key={item.view}
              onClick={() => navigateTo(item.view)}
              className="flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-200 active:scale-95"
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-label={item.label}
              id={`nav-item-${item.view}`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-200 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 scale-110'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
                }`}
              />
              <span
                className={`text-[10px] font-medium mt-1 tracking-tight transition-colors duration-200 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
export default BottomNav;
