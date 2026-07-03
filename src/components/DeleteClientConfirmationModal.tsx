/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, X, Archive, ShieldAlert } from 'lucide-react';

interface DeleteClientConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onArchive?: () => Promise<void>;
  clientName: string;
  clientId: string;
  initialMode?: 'choice' | 'delete';
}

export const DeleteClientConfirmationModal: React.FC<DeleteClientConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onArchive,
  clientName,
  clientId,
  initialMode = 'choice'
}) => {
  const [mode, setMode] = useState<'choice' | 'delete'>('choice');
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset states on open/close
  useEffect(() => {
    if (isOpen) {
      setMode(onArchive ? initialMode : 'delete');
      setConfirmText('');
      setIsSubmitting(false);
    }
  }, [isOpen, onArchive, initialMode]);

  if (!isOpen) return null;

  const handleArchiveSubmit = async () => {
    if (!onArchive) return;
    try {
      setIsSubmitting(true);
      await onArchive();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'DELETE') return;

    try {
      setIsSubmitting(true);
      await onConfirm();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        id="delete-client-modal-container"
      >
        {/* Header Section */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/60">
          <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-xl text-rose-500 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-base font-black text-slate-900 dark:text-white" id="delete-client-modal-title">
              {mode === 'choice' ? 'Delete or Archive Client?' : 'Delete Permanently?'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider mt-0.5">
              Client ID: {clientId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
            id="delete-client-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'choice' ? (
          <div className="space-y-4 text-left">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
              How would you like to handle <strong className="text-slate-900 dark:text-white font-black">"{clientName}"</strong>?
            </p>

            <div className="space-y-3">
              {/* Option 1: Archive Client (Recommended) */}
              <button
                type="button"
                onClick={handleArchiveSubmit}
                disabled={isSubmitting}
                className="w-full p-4 bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/15 dark:hover:bg-blue-950/35 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl flex items-start gap-3 text-left transition-all hover:scale-[1.01] active:scale-95 cursor-pointer disabled:opacity-50"
                id="choice-archive-btn"
              >
                <div className="p-2 bg-blue-500 text-white rounded-xl shrink-0 mt-0.5">
                  <Archive className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-blue-700 dark:text-blue-400">Archive Client</span>
                    <span className="text-[9px] bg-blue-600 text-white font-black px-1.5 py-0.25 rounded">RECOMMENDED</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Hide client from normal search & dashboard. Preserve all tickets, conversations & history. Restore anytime.
                  </p>
                </div>
              </button>

              {/* Option 2: Delete Permanently */}
              <button
                type="button"
                onClick={() => setMode('delete')}
                disabled={isSubmitting}
                className="w-full p-4 bg-rose-50/40 hover:bg-rose-100/40 dark:bg-rose-950/5 dark:hover:bg-rose-950/15 border border-rose-100/20 dark:border-rose-900/10 rounded-2xl flex items-start gap-3 text-left transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                id="choice-delete-btn"
              >
                <div className="p-2 bg-rose-500 text-white rounded-xl shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-rose-600 dark:text-rose-450">Delete Permanently</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Completely wipe this client and all associated tickets & conversation history from database. Cannot be undone.
                  </p>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-xs transition-colors cursor-pointer text-center"
              style={{ minHeight: '44px' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          /* Typing Confirmation Form */
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="space-y-3 text-left">
              <p className="text-xs font-extrabold text-rose-600 dark:text-rose-450 flex items-center gap-1.5 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-2.5 rounded-xl border border-rose-100/10">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>⚠️ This action cannot be undone.</span>
              </p>

              <div className="space-y-1">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                  Deleting <strong className="text-slate-900 dark:text-white font-black">"{clientName}"</strong> will permanently remove client details, tickets, and conversation logs.
                </p>
              </div>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                Type <span className="text-rose-500 font-mono font-black">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-rose-500/15 focus:border-rose-500 font-black tracking-widest text-center transition-all font-mono uppercase"
                required
                id="delete-client-confirm-input"
              />
            </div>

            {/* Action Buttons with Large Touch Targets */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (onArchive) {
                    setMode('choice');
                  } else {
                    onClose();
                  }
                }}
                disabled={isSubmitting}
                className="flex-1 order-2 sm:order-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-xs transition-colors active:scale-95 disabled:scale-100 disabled:opacity-50 cursor-pointer text-center"
                style={{ minHeight: '44px' }}
                id="delete-client-cancel-btn"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={confirmText !== 'DELETE' || isSubmitting}
                className={`flex-1 order-1 sm:order-2 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  confirmText === 'DELETE'
                    ? 'bg-rose-600 hover:bg-rose-750 text-white border-rose-700 shadow-lg shadow-rose-500/10 active:scale-95'
                    : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-transparent cursor-not-allowed'
                }`}
                style={{ minHeight: '44px' }}
                id="delete-client-confirm-btn"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
