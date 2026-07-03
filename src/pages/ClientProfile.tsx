/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNav } from '../context/NavContext';
import { useAuth } from '../context/AuthContext';
import { crmApi } from '../services/api';
import { Client, Ticket, Conversation, TicketStatus, TicketPriority } from '../types';
import { CardSkeleton, ListSkeleton } from '../components/Skeleton';
import { useForm } from 'react-hook-form';
import { 
  Phone, 
  MessageCircle, 
  Plus, 
  ChevronRight, 
  FileText, 
  Calendar, 
  Clock, 
  X, 
  AlertCircle,
  FolderOpen,
  Copy,
  Check,
  User,
  Activity,
  UserCheck,
  Star,
  MapPin,
  Edit3,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseBDDate, bdDateToInput, inputDateToBD, getBangladeshDateString, handlePhoneCall, formatBDPhoneForDisplay } from '../utils';
import { DeleteClientConfirmationModal } from '../components/DeleteClientConfirmationModal';

interface TicketFormInputs {
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  nextFollowUp: string;
}

export const ClientProfile: React.FC = () => {
  const { 
    activeClientId, 
    navigateTo, 
    goBack, 
    activeModalCloseHandler, 
    setActiveModalCloseHandler, 
    unsavedChanges, 
    setUnsavedChanges 
  } = useNav();
  const { profile } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profileTab, setProfileTab] = useState<'timeline' | 'calls'>('calls');
  const [callFilter, setCallFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const [isCallDetailsModalOpen, setIsCallDetailsModalOpen] = useState(false);
  const [isLongPressSheetOpen, setIsLongPressSheetOpen] = useState(false);

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);

  // Edit Client States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [submittingEditClient, setSubmittingEditClient] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editStatus, setEditStatus] = useState<any>('New');
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const editOriginalFollowUp = React.useRef<string>('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const isAuthorized = profile?.role === 'Admin' || profile?.role === 'Owner';

  const handleArchiveConfirm = async () => {
    if (!client) return;
    try {
      const res = await crmApi.updateClient({ id: client.id, isArchived: true });
      if (res.success) {
        toast.success('📦 Client archived successfully.');
        setDeleteModalOpen(false);
        navigateTo('dashboard');
        window.dispatchEvent(new Event('clients-updated'));
      } else {
        toast.error('❌ Failed to archive client. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('❌ Failed to archive client. Please try again.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!client) return;
    try {
      const res = await crmApi.deleteClient(client.id);
      if (res.success) {
        toast.success('🔥 Client permanently deleted.');
        setDeleteModalOpen(false);
        navigateTo('dashboard');
        window.dispatchEvent(new Event('clients-updated'));
      } else {
        toast.error('❌ Failed to delete client. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('❌ Failed to delete client. Please try again.');
    }
  };

  const openEditModal = () => {
    if (!client) return;
    setEditName(client.name);
    setEditPhone(client.phone);
    setEditCompany(client.company || '');
    setEditDistrict(client.district || 'Dhaka');
    setEditStatus(client.status);
    
    const dateInput = bdDateToInput(client.nextFollowUp || '');
    setEditFollowUpDate(dateInput);
    editOriginalFollowUp.current = dateInput;
    
    setEditModalOpen(true);
  };

  const handleEditClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    if (!editName.trim()) {
      toast.error('Client name is required.');
      return;
    }
    if (!editPhone.trim()) {
      toast.error('Phone number is required.');
      return;
    }
    
    try {
      setSubmittingEditClient(true);
      const res = await crmApi.updateClient({
        id: client.id,
        name: editName.trim(),
        phone: editPhone.trim(),
        company: editCompany.trim(),
        district: editDistrict.trim(),
        status: editStatus,
        nextFollowUp: editFollowUpDate
      });

      if (res.success) {
        toast.success('Client profile updated successfully!');
        setUnsavedChanges(false);
        setEditModalOpen(false);
        await loadClientDetails();
      } else {
        toast.error('Failed to update client profile.');
      }
    } catch (err: any) {
      console.error('Error updating client:', err);
      toast.error(err.message || 'Error updating client profile.');
    } finally {
      setSubmittingEditClient(false);
    }
  };

  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<TicketFormInputs>({
    defaultValues: {
      title: '',
      description: '',
      priority: 'Medium',
      status: 'Open',
      nextFollowUp: new Date().toISOString().split('T')[0]
    }
  });

  // Register Back modal close handler
  useEffect(() => {
    let targetHandler: (() => void) | null = null;
    if (modalOpen) {
      targetHandler = () => setModalOpen(false);
    } else if (editModalOpen) {
      targetHandler = () => setEditModalOpen(false);
    } else if (deleteModalOpen) {
      targetHandler = () => setDeleteModalOpen(false);
    }

    if (targetHandler !== activeModalCloseHandler) {
      Promise.resolve().then(() => {
        setActiveModalCloseHandler(targetHandler);
      });
    }
    return () => {
      Promise.resolve().then(() => {
        setActiveModalCloseHandler(null);
      });
    };
  }, [modalOpen, editModalOpen, deleteModalOpen, setActiveModalCloseHandler, activeModalCloseHandler]);

  // Track unsaved changes in modals
  useEffect(() => {
    let targetUnsaved = false;
    if (modalOpen) {
      targetUnsaved = isDirty;
    } else if (editModalOpen && client) {
      const hasChanges = 
        editName !== client.name ||
        editPhone !== client.phone ||
        editCompany !== (client.company || '') ||
        editDistrict !== (client.district || 'Dhaka') ||
        editStatus !== client.status ||
        editFollowUpDate !== bdDateToInput(client.nextFollowUp || '');
      targetUnsaved = hasChanges;
    }

    if (targetUnsaved !== unsavedChanges) {
      Promise.resolve().then(() => {
        setUnsavedChanges(targetUnsaved);
      });
    }
    return () => {
      Promise.resolve().then(() => {
        setUnsavedChanges(false);
      });
    };
  }, [modalOpen, isDirty, editModalOpen, editName, editPhone, editCompany, editDistrict, editStatus, editFollowUpDate, client, setUnsavedChanges, unsavedChanges]);

  const loadClientDetails = async () => {
    if (!activeClientId) return;
    try {
      setLoading(true);
      const [clientsRes, ticketsRes, convsRes] = await Promise.all([
        crmApi.getClients(),
        crmApi.getTickets(),
        crmApi.getConversations()
      ]);
      
      const foundClient = clientsRes.find(c => c.id === activeClientId);
      if (foundClient) {
        setClient(foundClient);
        
        // Filter and sort tickets for this client (newest first)
        const clientTickets = ticketsRes
          .filter(t => t.clientId === activeClientId)
          .sort((a, b) => {
            const dateA = parseBDDate(a.createdDate) || new Date(a.createdDate);
            const dateB = parseBDDate(b.createdDate) || new Date(b.createdDate);
            return dateB.getTime() - dateA.getTime();
          });
        setTickets(clientTickets);

        // Filter and sort conversations for this client's tickets (newest first)
        const clientTicketIds = clientTickets.map(t => t.id);
        const clientConvs = convsRes
          .filter(c => clientTicketIds.includes(c.ticketId))
          .sort((a, b) => {
            const dateA = parseBDDate(a.dateTime) || new Date(a.dateTime);
            const dateB = parseBDDate(b.dateTime) || new Date(b.dateTime);
            return dateB.getTime() - dateA.getTime();
          });
        setConversations(clientConvs);
      } else {
        toast.error('Client not found.');
        goBack();
      }
    } catch (err: any) {
      console.error('Error loading client profile:', err);
      toast.error('Failed to load client information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientDetails();
  }, [activeClientId]);

  const handleTogglePin = async () => {
    if (!client) return;
    try {
      const newPinStatus = !client.isPinned;
      const res = await crmApi.updateClient({
        id: client.id,
        isPinned: newPinStatus
      });
      if (res.success) {
        setClient({ ...client, isPinned: newPinStatus });
        toast.success(newPinStatus ? 'Client pinned to top!' : 'Client unpinned.');
      } else {
        toast.error('Failed to update pin status.');
      }
    } catch (err: any) {
      console.error('Error toggling pin:', err);
      toast.error('Error toggling pin status.');
    }
  };

  // Clickable tel and wa actions (strip all spaces, hyphens, and dashes)
  const getCleanPhone = (phoneStr: string) => {
    return phoneStr.replace(/[\s\-\(\)\+]/g, '');
  };

  const handleCall = () => {
    if (!client) return;
    handlePhoneCall(client.phone, client);
  };

  const handleWhatsApp = () => {
    if (!client) return;
    const cleanNum = getCleanPhone(client.phone);
    window.open(`https://wa.me/${cleanNum}`, '_blank', 'noreferrer');
  };

  const handleCopyPhone = () => {
    if (!client) return;
    navigator.clipboard.writeText(client.phone);
    setCopiedPhone(true);
    toast.success('Phone number copied!');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopyWA = () => {
    if (!client) return;
    const cleanNum = getCleanPhone(client.phone);
    const waLink = `https://wa.me/${cleanNum}`;
    navigator.clipboard.writeText(waLink);
    setCopiedWA(true);
    toast.success('WhatsApp link copied!');
    setTimeout(() => setCopiedWA(false), 2000);
  };

  const handleCopyPhoneExact = () => {
    if (!client) return;
    navigator.clipboard.writeText(client.phone);
    toast.success('✅ Phone number copied successfully.');
  };

  const pressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPressActive = React.useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    isLongPressActive.current = false;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      isLongPressActive.current = true;
      setIsLongPressSheetOpen(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch (err) {}
      }
    }, 600);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (isLongPressActive.current) {
      e.preventDefault();
    } else {
      handleCall();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isLongPressActive.current = false;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      isLongPressActive.current = true;
      setIsLongPressSheetOpen(true);
    }, 600);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleNumberClick = (e: React.MouseEvent) => {
    if (isLongPressActive.current) {
      e.preventDefault();
      return;
    }
    handleCall();
  };

  const onSubmitTicket = async (data: TicketFormInputs) => {
    if (!activeClientId || !client) return;
    try {
      setSubmittingTicket(true);
      const res = await crmApi.addTicket({
        clientId: activeClientId,
        title: data.title.trim(),
        description: data.description.trim(),
        priority: data.priority,
        status: data.status,
        nextFollowUp: data.nextFollowUp
      });

      if (res.success) {
        toast.success(`Ticket created successfully: ${res.ticket.id}`);
        setModalOpen(false);
        reset();
        await loadClientDetails(); // Reload client data
      } else {
        toast.error('Could not create ticket.');
      }
    } catch (err: any) {
      console.error('Error submitting ticket:', err);
      toast.error(err.message || 'Failed to sync ticket to database.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Badge stylings to respect Bangladesh spec
  const getTicketStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'Open':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/20';
      case 'Pending':
        return 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-100/20';
      case 'Follow Up':
        return 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100/20';
      case 'Closed':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/20';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-100/20';
    }
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/20';
      case 'Medium':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100/20';
      case 'Low':
        return 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100/20';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-500';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="space-y-3">
          <div className="h-5 w-1/3 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
          <ListSkeleton />
        </div>
      </div>
    );
  }

  if (!client) return null;

  const callLogs = conversations
    .map(conv => {
      if (!conv.conversationNote.startsWith('[Call Log]')) return null;
      const note = conv.conversationNote;
      const parts = note.split(' | ');
      const statusPart = parts.find(p => p.startsWith('Status: '));
      const durationPart = parts.find(p => p.startsWith('Duration: '));
      const summaryPart = parts.find(p => p.startsWith('Summary: '));
      
      return {
        ...conv,
        status: statusPart ? statusPart.replace('Status: ', '') : 'Connected',
        duration: durationPart ? durationPart.replace('Duration: ', '') : '2 mins',
        summary: summaryPart ? summaryPart.replace('Summary: ', '') : note.replace(/\[Call Log\]\s*/, '')
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const totalCallsCount = callLogs.length;
  const latestCall = callLogs[0];
  const lastCallDate = latestCall ? latestCall.dateTime.split(' ')[0] : 'None';
  const lastCallTime = latestCall ? latestCall.dateTime.split(' ').slice(1).join(' ') : 'None';
  const lastCallStatus = latestCall ? latestCall.status : 'None';
  const lastCallDuration = latestCall ? latestCall.duration : 'None';

  return (
    <div className="space-y-6 pb-24">
      {/* Client Summary Header Card */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold text-blue-500 font-mono bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded leading-none">
                {client.id}
              </span>
              <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                client.status === 'Customer'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                  : client.status === 'Interested'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  : client.status === 'Lost'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {client.status}
              </span>
            </div>
            <div className="flex justify-between items-center w-full gap-2 pt-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{client.name}</h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={openEditModal}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                  id="open-edit-client-modal"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">Edit</span>
                </button>
                <button
                  onClick={handleTogglePin}
                  className={`px-3 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer shrink-0 ${
                    client.isPinned
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-500'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600'
                  }`}
                  title={client.isPinned ? 'Unpin Client' : 'Pin Client'}
                  id="toggle-pin-button"
                >
                  <Star className={`w-3.5 h-3.5 ${client.isPinned ? 'fill-amber-400 text-amber-500' : ''}`} />
                  <span className="text-[10px] font-bold">{client.isPinned ? 'Pinned' : 'Pin'}</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>{client.company || 'Individual client'}</span>
              {client.district && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{client.district}</span>
                  </span>
                </>
              )}
            </div>

            {/* Sticky Phone Action Bar */}
            <div 
              className="sticky top-16 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-100 dark:border-slate-800/80 rounded-2xl p-1.5 shadow-md flex items-center justify-between gap-1.5 w-full text-xs font-black tracking-tight"
              id="sticky-phone-action-bar-container"
            >
              {/* Call Button */}
              <button
                onClick={handleCall}
                className="flex-1 py-3 text-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 active:scale-95 transition-all cursor-pointer rounded-xl flex items-center justify-center gap-1 min-h-[48px]"
                id="phone-action-bar-call"
              >
                <span>📞 Call</span>
              </button>

              <span className="text-slate-200 dark:text-slate-800 self-stretch flex items-center font-normal">|</span>

              {/* Clickable Phone Number */}
              <div
                onClick={handleNumberClick}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="flex-1 py-3 text-center text-slate-850 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-95 transition-all cursor-pointer rounded-xl font-black font-mono select-none flex items-center justify-center min-h-[48px] whitespace-nowrap"
                id="phone-action-bar-number"
                title="Hold for more options"
              >
                <span>{formatBDPhoneForDisplay(client.phone)}</span>
              </div>

              <span className="text-slate-200 dark:text-slate-800 self-stretch flex items-center font-normal">|</span>

              {/* Copy Button */}
              <button
                onClick={handleCopyPhoneExact}
                className="flex-1 py-3 text-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 active:scale-95 transition-all cursor-pointer rounded-xl flex items-center justify-center gap-1 min-h-[48px]"
                id="phone-action-bar-copy"
              >
                <span>📋 Copy</span>
              </button>

              <span className="text-slate-200 dark:text-slate-800 self-stretch flex items-center font-normal">|</span>

              {/* Call Count */}
              <button
                onClick={() => setIsCallDetailsModalOpen(true)}
                className="flex-1 py-3 text-center text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 active:scale-95 transition-all cursor-pointer rounded-xl flex items-center justify-center gap-1 min-h-[48px] whitespace-nowrap"
                id="phone-action-bar-calls"
              >
                <span>☎️ {totalCallsCount} Calls</span>
              </button>
            </div>

            {/* Clickable Mobile & WhatsApp Actions with Copy Buttons */}
            <div className="pt-2 flex flex-col gap-2 border-t border-slate-50 dark:border-slate-800/40">
              <div className="flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-950/40 px-3 py-2 rounded-xl">
                <a 
                  href={`tel:+${getCleanPhone(client.phone)}`}
                  className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{client.phone}</span>
                </a>
                <button
                  onClick={handleCopyPhone}
                  className="p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  title="Copy Phone Number"
                >
                  {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-950/40 px-3 py-2 rounded-xl">
                <a 
                  href={`https://wa.me/${getCleanPhone(client.phone)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                  <span>wa.me/{getCleanPhone(client.phone)}</span>
                </a>
                <button
                  onClick={handleCopyWA}
                  className="p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  title="Copy WhatsApp Link"
                >
                  {copiedWA ? <Check className="w-3.5 h-3.5 text-blue-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Dates Info in BST */}
        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-50 dark:border-slate-800/60 text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Next Follow Up</span>
            <span className="font-bold text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>{client.nextFollowUp || 'None scheduled'}</span>
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Last Contact</span>
            <span className="font-bold text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{client.lastContact ? client.lastContact.split(' ')[0] : 'Never contacted'}</span>
            </span>
          </div>
        </div>

        {/* Large Easy Action Buttons for One-Hand Mobile Usage */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleCall}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs transition-colors shadow-sm shadow-emerald-500/10 cursor-pointer"
            style={{ minHeight: '44px' }}
            id="client-profile-call-button-primary"
          >
            <Phone className="w-4 h-4" />
            <span>Call Mobile</span>
          </button>

          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs transition-colors shadow-sm shadow-blue-500/10 cursor-pointer"
            style={{ minHeight: '44px' }}
            id="client-profile-whatsapp-button-primary"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>
        </div>

        {isAuthorized && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-1 flex justify-center">
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 dark:bg-rose-950/15 hover:bg-rose-100 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl font-bold text-xs active:scale-95 transition-all cursor-pointer border border-rose-100/30 dark:border-rose-900/30"
              style={{ minHeight: '44px' }}
              id="client-profile-delete-button"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete Client</span>
            </button>
          </div>
        )}
      </div>

      {/* Tickets List Section with Bangladesh Badges */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-500" />
            <span>Support Tickets ({tickets.length})</span>
          </h3>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 rounded-xl active:scale-95 transition-all cursor-pointer"
            id="open-add-ticket-modal-button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Ticket</span>
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="p-10 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-100 dark:border-slate-800 text-center space-y-2">
            <FolderOpen className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No active tickets</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              Create a support ticket to track onboarding issues, billing questions, or product requests.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map(ticket => (
              <div
                key={ticket.id}
                onClick={() => navigateTo('ticketDetail', { ticketId: ticket.id })}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm hover:border-slate-200 dark:hover:border-slate-700 transition-all flex justify-between items-start cursor-pointer active:scale-99"
              >
                <div className="space-y-1.5 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold text-blue-500 font-mono bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                      {ticket.id}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded ${getPriorityBadge(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded ${getTicketStatusBadge(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-extrabold text-slate-800 dark:text-white leading-tight">
                    {ticket.title}
                  </h4>
                  
                  <p className="text-xs text-slate-500 dark:text-slate-450 line-clamp-1">
                    {ticket.description}
                  </p>
                  
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      <span>Updated: {ticket.lastUpdated.split(' ')[0]}</span>
                    </span>
                    {ticket.totalConversations > 0 && (
                      <span className="bg-slate-50 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-bold">
                        {ticket.totalConversations} logs
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 mt-1 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TAB SELECTOR FOR HISTORY SECTION */}
      <div className="flex border-b border-slate-100 dark:border-slate-850/80 mb-4 pt-4">
        <button
          onClick={() => setProfileTab('calls')}
          className={`flex-1 py-3 text-xs font-black text-center border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
            profileTab === 'calls'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-extrabold'
              : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:border-slate-200'
          }`}
          id="profile-tab-calls-btn"
        >
          📞 Call History ({
            conversations.filter(c => c.conversationNote.startsWith('[Call Log]')).length
          })
        </button>
        <button
          onClick={() => setProfileTab('timeline')}
          className={`flex-1 py-3 text-xs font-black text-center border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
            profileTab === 'timeline'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-extrabold'
              : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:border-slate-200'
          }`}
          id="profile-tab-timeline-btn"
        >
          💬 Timeline History ({conversations.length})
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      {profileTab === 'calls' ? (
        <div className="space-y-4">
          
          {/* Segmented Control Filter for Call Logs */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Filter Call Logs:
            </h4>
            <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-900 rounded-xl" id="call-history-filters">
              {[
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setCallFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    callFilter === f.id
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700'
                  }`}
                  id={`filter-call-${f.id}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Call Logs Render */}
          {(() => {
            const callLogs = conversations
              .map(conv => {
                if (!conv.conversationNote.startsWith('[Call Log]')) return null;
                const note = conv.conversationNote;
                const parts = note.split(' | ');
                const statusPart = parts.find(p => p.startsWith('Status: '));
                const durationPart = parts.find(p => p.startsWith('Duration: '));
                const summaryPart = parts.find(p => p.startsWith('Summary: '));
                
                return {
                  ...conv,
                  status: statusPart ? statusPart.replace('Status: ', '') : 'Connected',
                  duration: durationPart ? durationPart.replace('Duration: ', '') : '2 mins',
                  summary: summaryPart ? summaryPart.replace('Summary: ', '') : note.replace(/\[Call Log\]\s*/, '')
                };
              })
              .filter((c): c is NonNullable<typeof c> => c !== null);

            const filteredCallLogs = callLogs.filter(log => {
              const logDate = parseBDDate(log.dateTime) || new Date(log.dateTime);
              const now = new Date();
              
              if (callFilter === 'today') {
                const todayStr = getBangladeshDateString(now);
                return log.dateTime.startsWith(todayStr);
              }
              if (callFilter === 'week') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                return logDate.getTime() >= oneWeekAgo.getTime();
              }
              if (callFilter === 'month') {
                const oneMonthAgo = new Date();
                oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
                return logDate.getTime() >= oneMonthAgo.getTime();
              }
              return true;
            });

            if (filteredCallLogs.length === 0) {
              return (
                <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-100 dark:border-slate-800 text-center space-y-2">
                  <Phone className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto animate-pulse" />
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">No calls tracked</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                    No phone logs found matching the selected filter. Click the Call button above to place a dialer request.
                  </p>
                </div>
              );
            }

            const getStatusBadge = (statusLabel: string) => {
              switch (statusLabel) {
                case 'Connected':
                  return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/20';
                case 'No Answer':
                  return 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-100/20';
                case 'Busy':
                  return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100/20';
                case 'Switched Off':
                  return 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/20';
                case 'Call Back Later':
                  return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/20';
                case 'Wrong Number':
                  return 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-100/20';
                default:
                  return 'bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-100/20';
              }
            };

            return (
              <div className="space-y-3">
                {filteredCallLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850/80 rounded-2xl shadow-xs hover:shadow-md transition-all space-y-2.5 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-center flex-wrap gap-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-lg ${getStatusBadge(log.status)}`}>
                          {log.status}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-mono rounded-lg flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{log.duration}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">
                        {log.dateTime}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed break-words whitespace-pre-wrap pl-1">
                      {log.summary}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-850/40 text-[9px] font-bold">
                      <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Logged by: {log.createdBy} ({log.userEmail.split('@')[0]})</span>
                      </span>
                      {log.nextFollowUp && (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Next Follow-up: {log.nextFollowUp}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-emerald-500" />
            <span>Timeline History ({conversations.length})</span>
          </h3>

          {conversations.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-100 dark:border-slate-800 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">No logs found</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                Open a support ticket above and click 'Add Log' to register customer briefing sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
              {conversations.map((conv) => (
                <div key={conv.id} className="flex gap-3 pl-1.5 group">
                  {/* Timeline node */}
                  <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-900 shadow-sm relative z-10 mt-1.5 shrink-0" />
                  
                  {/* Content card */}
                  <div className="flex-1 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-2">
                    <div className="flex justify-between items-start flex-wrap gap-y-1">
                      <span className="text-[10px] font-extrabold text-emerald-600 font-mono bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                        Log {conv.id} (Ticket ID: {conv.ticketId})
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">
                        {conv.dateTime}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed break-words whitespace-pre-wrap">
                      {conv.conversationNote}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-850/60 text-[10px]">
                      <div className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                        <User className="w-3 h-3" />
                        <span>By: {conv.createdBy} ({conv.userEmail.split('@')[0]})</span>
                      </div>

                      {conv.nextFollowUp && (
                        <div className="bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-slate-500 dark:text-slate-400 font-bold rounded flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>F/U: {conv.nextFollowUp}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Add Ticket Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4.5 h-4.5 text-blue-500" />
                <span>Create Support Ticket</span>
              </h3>
              <button
                onClick={() => {
                  setModalOpen(false);
                  reset();
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitTicket)} className="space-y-4">
              {/* Ticket Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Ticket Title *</label>
                <input
                  type="text"
                  placeholder="e.g. API Access Onboarding"
                  {...register('title', { required: 'Ticket Title is required' })}
                  className={`w-full p-3.5 bg-slate-50 dark:bg-slate-950 border ${
                    errors.title ? 'border-rose-500' : 'border-slate-100 dark:border-slate-800'
                  } rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-semibold transition-all`}
                />
                {errors.title && (
                  <p className="text-[10px] text-rose-500 font-bold">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Problem Description *</label>
                <textarea
                  rows={3}
                  placeholder="Provide essential details..."
                  {...register('description', { required: 'Description is required' })}
                  className={`w-full p-3.5 bg-slate-50 dark:bg-slate-950 border ${
                    errors.description ? 'border-rose-500' : 'border-slate-100 dark:border-slate-800'
                  } rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-medium transition-all`}
                />
                {errors.description && (
                  <p className="text-[10px] text-rose-500 font-bold">{errors.description.message}</p>
                )}
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Priority</label>
                  <select
                    {...register('priority')}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-350 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Status</label>
                  <select
                    {...register('status')}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-350 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  >
                    <option value="Open">Open</option>
                    <option value="Pending">Pending</option>
                    <option value="Follow Up">Follow Up</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Follow Up Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Next Follow Up Date</label>
                <input
                  type="date"
                  {...register('nextFollowUp')}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 font-mono"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submittingTicket}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow hover:shadow-blue-500/10 transition-all active:scale-95 disabled:scale-100 disabled:opacity-50 cursor-pointer border border-blue-500/10 mt-2"
                style={{ minHeight: '44px' }}
                id="modal-add-ticket-submit-button"
              >
                {submittingTicket ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  <span>Create Ticket &amp; Sync</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div 
            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/50">
              <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                Edit Client Profile
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                id="close-edit-client-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditClientSubmit} className="space-y-4 text-left">
              {/* Client Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Client Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-semibold transition-all"
                  required
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Phone Number *</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. 01712345678"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-semibold transition-all font-mono"
                  required
                />
              </div>

              {/* Company */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Company Name</label>
                <input
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-medium transition-all"
                />
              </div>

              {/* District */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">District / Location</label>
                <input
                  type="text"
                  value={editDistrict}
                  onChange={(e) => setEditDistrict(e.target.value)}
                  placeholder="e.g. Dhaka, Chittagong"
                  list="districts-list"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-medium transition-all"
                />
                <datalist id="districts-list">
                  <option value="Dhaka" />
                  <option value="Chittagong" />
                  <option value="Sylhet" />
                  <option value="Rajshahi" />
                  <option value="Khulna" />
                  <option value="Barisal" />
                  <option value="Rangpur" />
                  <option value="Mymensingh" />
                </datalist>
              </div>

              {/* Status / Stage */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">CRM Stage</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-350 focus:outline-none focus:ring-2 focus:ring-blue-500/15 cursor-pointer"
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Interested">Interested</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Customer">Customer</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>

              {/* Next Follow-up Date Field Group */}
              <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>Next Follow Up Date</span>
                </label>
                
                <div className="space-y-2.5">
                  {/* Status Display */}
                  {!editFollowUpDate ? (
                    <div className="p-3 bg-slate-100/50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                      <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                        No Follow-up Scheduled
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100/20 rounded-xl text-center">
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                        Scheduled: {inputDateToBD(editFollowUpDate)}
                      </span>
                    </div>
                  )}

                  {/* Date Picker Input */}
                  <input
                    type="date"
                    value={editFollowUpDate}
                    onChange={(e) => setEditFollowUpDate(e.target.value)}
                    className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm text-sm dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-mono transition-all"
                  />

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        setEditFollowUpDate(todayStr);
                      }}
                      className="flex items-center justify-center gap-1 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100/10 rounded-xl text-[10px] font-black active:scale-95 transition-all cursor-pointer"
                      style={{ minHeight: '44px' }}
                      id="edit-client-select-date-button"
                    >
                      <span>Select Date</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditFollowUpDate('');
                      }}
                      className="flex items-center justify-center gap-1 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-100/10 rounded-xl text-[10px] font-black active:scale-95 transition-all cursor-pointer"
                      style={{ minHeight: '44px' }}
                      id="edit-client-clear-date-button"
                    >
                      <span>🗑️ Clear Date</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditFollowUpDate(editOriginalFollowUp.current);
                      }}
                      className="flex items-center justify-center gap-1 py-2 bg-slate-100 hover:bg-slate-150 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200/50 rounded-xl text-[10px] font-black active:scale-95 transition-all cursor-pointer"
                      style={{ minHeight: '44px' }}
                      id="edit-client-cancel-date-button"
                    >
                      <span>Cancel</span>
                    </button>
                  </div>
                  
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => setEditFollowUpDate('')}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                      id="edit-client-no-followup-button"
                    >
                      <span>No Follow-up</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingEditClient}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-lg hover:shadow-blue-500/10 transition-all active:scale-95 disabled:scale-100 disabled:opacity-50 cursor-pointer border border-blue-500/10 mt-2"
                style={{ minHeight: '44px' }}
                id="edit-client-submit-button"
              >
                {submittingEditClient ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  <span>Save Profile Updates</span>
                )}
              </button>

              {isAuthorized && (
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setDeleteModalOpen(true);
                  }}
                  className="w-full py-3 bg-rose-50 dark:bg-rose-950/15 hover:bg-rose-100 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl font-bold text-xs transition-all active:scale-95 cursor-pointer border border-rose-100/30 dark:border-rose-900/30 mt-2 flex items-center justify-center gap-2"
                  style={{ minHeight: '44px' }}
                  id="edit-client-delete-button"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>Delete Client</span>
                </button>
              )}
            </form>
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

      {/* Call History Details Modal */}
      {isCallDetailsModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-2xl p-6 relative overflow-hidden space-y-4">
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-850/60">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <span className="text-base">☎️</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Call History
                </h3>
              </div>
              <button
                onClick={() => setIsCallDetailsModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors cursor-pointer"
                id="call-details-close-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 py-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 dark:text-slate-500">Total Calls</span>
                <span className="font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg font-mono">
                  {totalCallsCount}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 dark:text-slate-500">Last Call Date</span>
                <span className="font-black text-slate-700 dark:text-slate-300 font-mono">
                  {lastCallDate}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 dark:text-slate-500">Last Call Time</span>
                <span className="font-black text-slate-700 dark:text-slate-300 font-mono">
                  {lastCallTime}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 dark:text-slate-500">Last Call Status</span>
                <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-lg ${
                  lastCallStatus === 'Connected'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/20'
                    : lastCallStatus === 'None'
                    ? 'bg-slate-50 dark:bg-slate-800 text-slate-500'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100/20'
                }`}>
                  {lastCallStatus}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 dark:text-slate-500">Last Call Duration</span>
                <span className="font-black text-slate-700 dark:text-slate-300 font-mono">
                  {lastCallDuration}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setIsCallDetailsModalOpen(false);
                setProfileTab('calls');
                setTimeout(() => {
                  const element = document.getElementById('profile-tab-calls-btn');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 150);
              }}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl active:scale-95 transition-all text-center cursor-pointer shadow-md shadow-blue-500/10"
              style={{ minHeight: '48px' }}
              id="view-full-call-history-btn"
            >
              View Full Call History
            </button>
          </div>
        </div>
      )}

      {/* Mobile Long Press Bottom Sheet */}
      {isLongPressSheetOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xs flex items-end justify-center">
          <div className="absolute inset-0 animate-fade-in" onClick={() => setIsLongPressSheetOpen(false)} />
          
          <div className="relative w-full max-w-md bg-white dark:bg-slate-950 rounded-t-[32px] border-t border-slate-100 dark:border-slate-800/80 shadow-2xl p-6 space-y-3 pb-8 z-10 animate-slide-up">
            <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-2" />
            
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
              Quick Actions
            </h4>
            <p className="text-xs font-bold text-center text-slate-800 dark:text-slate-300 font-mono pb-2">
              {formatBDPhoneForDisplay(client.phone)}
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setIsLongPressSheetOpen(false);
                  handleCall();
                }}
                className="w-full py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs transition-colors flex items-center justify-center gap-2"
                style={{ minHeight: '48px' }}
                id="longpress-sheet-call"
              >
                <span>📞 Call</span>
              </button>

              <button
                onClick={() => {
                  setIsLongPressSheetOpen(false);
                  handleWhatsApp();
                }}
                className="w-full py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs transition-colors flex items-center justify-center gap-2"
                style={{ minHeight: '48px' }}
                id="longpress-sheet-whatsapp"
              >
                <span>💬 WhatsApp</span>
              </button>

              <button
                onClick={() => {
                  setIsLongPressSheetOpen(false);
                  handleCopyPhoneExact();
                }}
                className="w-full py-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs transition-colors flex items-center justify-center gap-2"
                style={{ minHeight: '48px' }}
                id="longpress-sheet-copy"
              >
                <span>📋 Copy Number</span>
              </button>

              <button
                onClick={() => setIsLongPressSheetOpen(false)}
                className="w-full py-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-xs transition-colors flex items-center justify-center gap-2 mt-1"
                style={{ minHeight: '48px' }}
                id="longpress-sheet-cancel"
              >
                <span>❌ Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ClientProfile;
