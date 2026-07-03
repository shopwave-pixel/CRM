/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNav } from '../context/NavContext';
import { useAuth } from '../context/AuthContext';
import { Client } from '../types';
import { 
  Phone, 
  MessageCircle, 
  Copy, 
  User, 
  PlusCircle, 
  MoreVertical,
  X,
  Smartphone,
  Tag,
  Trash2
} from 'lucide-react';
import { handlePhoneCall, handleWhatsAppMessage, copyToClipboard, formatBDPhoneForDisplay } from '../utils';
import { crmApi } from '../services/api';
import toast from 'react-hot-toast';
import { DeleteClientConfirmationModal } from './DeleteClientConfirmationModal';

interface QuickActionsProps {
  client: Client;
  triggerElement?: React.ReactNode;
}

export const useLongPress = (onLongPress: () => void, onClick?: () => void) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, 500); // 500ms long press trigger
  };

  const stop = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) {
      onClick();
    }
  };

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
    onClick: handleClick,
  };
};

export const ClientQuickActions: React.FC<QuickActionsProps> = ({ client, triggerElement }) => {
  const { navigateTo } = useNav();
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const isAuthorized = profile?.role === 'Admin' || profile?.role === 'Owner';

  const handleArchiveConfirm = async () => {
    try {
      const res = await crmApi.updateClient({ id: client.id, isArchived: true });
      if (res.success) {
        toast.success('📦 Client archived successfully.');
        setDeleteModalOpen(false);
        window.dispatchEvent(new Event('clients-updated'));
        navigateTo('dashboard');
      } else {
        toast.error('❌ Failed to archive client. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('❌ Failed to archive client. Please try again.');
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const res = await crmApi.deleteClient(client.id);
      if (res.success) {
        toast.success('🔥 Client permanently deleted.');
        setDeleteModalOpen(false);
        window.dispatchEvent(new Event('clients-updated'));
        navigateTo('dashboard');
      } else {
        toast.error('❌ Failed to delete client. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('❌ Failed to delete client. Please try again.');
    }
  };

  const handleAddTicket = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    sessionStorage.setItem('openAddTicketModal', 'true');
    navigateTo('clientDetail', { clientId: client.id });
  };

  const handleOpenProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    navigateTo('clientDetail', { clientId: client.id });
  };

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
        aria-label="Quick Actions Menu"
      >
        {triggerElement || <MoreVertical className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div 
            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/50">
              <div className="space-y-0.5 text-left">
                <span className="text-[9px] font-black font-mono text-blue-500 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded uppercase">
                  {client.id}
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight mt-1">
                  {client.name}
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-left">
              <button
                onClick={() => {
                  setIsOpen(false);
                  handlePhoneCall(client.phone);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <Phone className="w-4 h-4 text-emerald-500" />
                <span>📞 Call Mobile</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  handleWhatsAppMessage(client.phone);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span>💬 WhatsApp Chat</span>
              </button>

              <div className="h-px bg-slate-50 dark:bg-slate-800/50 my-1" />

              <button
                onClick={() => {
                  copyToClipboard(client.name, 'Client name copied.');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <Copy className="w-4 h-4 text-slate-400" />
                <span>📋 Copy Client Name</span>
              </button>

              <button
                onClick={() => {
                  copyToClipboard(client.phone, 'Phone number copied.');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <Smartphone className="w-4 h-4 text-slate-400" />
                <span>📱 Copy Phone Number</span>
              </button>

              <button
                onClick={() => {
                  copyToClipboard(client.id, 'Client ID copied.');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <Tag className="w-4 h-4 text-slate-400" />
                <span>🆔 Copy Client ID</span>
              </button>

              <div className="h-px bg-slate-50 dark:bg-slate-800/50 my-1" />

              <button
                onClick={handleAddTicket}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <PlusCircle className="w-4 h-4 text-sky-500" />
                <span>🎫 Add Support Ticket</span>
              </button>

              <button
                onClick={handleOpenProfile}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <User className="w-4 h-4" />
                <span>👤 Open Full Profile</span>
              </button>

              {isAuthorized && (
                <>
                  <div className="h-px bg-slate-50 dark:bg-slate-800/50 my-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setDeleteModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-2xl transition-colors cursor-pointer"
                    style={{ minHeight: '44px' }}
                    id="quick-action-delete-button"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>🗑️ Delete Client</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <DeleteClientConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        onArchive={handleArchiveConfirm}
        clientName={client.name}
        clientId={client.id}
      />
    </div>
  );
};

// Global Context/Sheet for Long Presses
interface LongPressModalProps {
  type: 'name' | 'phone' | null;
  client: Client | null;
  onClose: () => void;
}

export const LongPressActionsModal: React.FC<LongPressModalProps> = ({ type, client, onClose }) => {
  if (!type || !client) return null;

  const handleCopyName = () => {
    copyToClipboard(client.name, 'Client name copied.');
    onClose();
  };

  const handleCopyId = () => {
    copyToClipboard(client.id, 'Client ID copied.');
    onClose();
  };

  const handleCopyPhone = () => {
    copyToClipboard(client.phone, 'Phone number copied.');
    onClose();
  };

  const handleCall = () => {
    handlePhoneCall(client.phone);
    onClose();
  };

  const handleWA = () => {
    handleWhatsAppMessage(client.phone);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/50">
          <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight text-left">
            {type === 'name' ? 'Client Name Options' : 'Phone Number Options'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5 text-left">
          {type === 'name' ? (
            <>
              <button
                onClick={handleCopyName}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copy Name</span>
              </button>
              <button
                onClick={handleCopyId}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <Tag className="w-4 h-4 text-slate-400" />
                <span>Copy Client ID</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCopyPhone}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copy Number</span>
              </button>
              <button
                onClick={handleCall}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <Phone className="w-4 h-4 text-emerald-500" />
                <span>Call Number</span>
              </button>
              <button
                onClick={handleWA}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span>WhatsApp Chat</span>
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 mt-2 text-xs font-extrabold text-slate-500 dark:text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
            style={{ minHeight: '44px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

interface LongPressableProps {
  children: React.ReactNode;
  onLongPress: () => void;
  onClick?: () => void;
  className?: string;
}

export const LongPressable: React.FC<LongPressableProps> = ({ children, onLongPress, onClick, className = "" }) => {
  const pressHandlers = useLongPress(onLongPress, onClick);
  return (
    <span {...pressHandlers} className={`cursor-pointer ${className}`}>
      {children}
    </span>
  );
};

