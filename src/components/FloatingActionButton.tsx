/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNav } from '../context/NavContext';
import { Plus, UserPlus, FileText, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export const FloatingActionButton: React.FC = () => {
  const { navigateTo, currentView } = useNav();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hide FAB on forms or profile pages to save screen space
  if (['addClient', 'profile'].includes(currentView)) {
    return null;
  }

  return (
    <div ref={containerRef} className="fixed bottom-20 right-6 z-40 max-w-md mx-auto">
      <div className="relative">
        {/* Expanded Options */}
        <AnimatePresence>
          {isOpen && (
            <div className="absolute bottom-16 right-0 flex flex-col items-end gap-3 mb-2">
              {/* Add Ticket option */}
              <motion.button
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to search first so they select a client to add a ticket to!
                  navigateTo('search');
                }}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2.5 rounded-full shadow-lg active:scale-95 transition-all text-sm border border-blue-400/20"
                id="fab-add-ticket"
              >
                <span>Add Ticket</span>
                <div className="bg-white/25 p-1 rounded-full">
                  <FileText className="w-4 h-4 text-white" />
                </div>
              </motion.button>

              {/* Add Client option */}
              <motion.button
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.9 }}
                transition={{ duration: 0.15, delay: 0.05 }}
                onClick={() => {
                  setIsOpen(false);
                  navigateTo('addClient');
                }}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2.5 rounded-full shadow-lg active:scale-95 transition-all text-sm border border-emerald-400/20"
                id="fab-add-client"
              >
                <span>Add Client</span>
                <div className="bg-white/25 p-1 rounded-full">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
              </motion.button>
            </div>
          )}
        </AnimatePresence>

        {/* Main Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-4 rounded-full shadow-xl active:scale-90 transition-all duration-300 border ${
            isOpen
              ? 'bg-slate-800 border-slate-700 text-white'
              : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700 hover:border-blue-600'
          }`}
          style={{ minWidth: '56px', minHeight: '56px' }}
          aria-expanded={isOpen}
          aria-label="Quick Actions"
          id="main-fab-trigger"
        >
          <motion.div
            animate={{ rotate: isOpen ? 135 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="w-6 h-6" />
          </motion.div>
        </button>
      </div>
    </div>
  );
};
export default FloatingActionButton;
