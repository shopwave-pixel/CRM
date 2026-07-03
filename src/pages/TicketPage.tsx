/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNav } from '../context/NavContext';
import { useAuth } from '../context/AuthContext';
import { crmApi } from '../services/api';
import { Ticket, Conversation, TicketStatus, TicketPriority } from '../types';
import { CardSkeleton, ListSkeleton } from '../components/Skeleton';
import { useForm } from 'react-hook-form';
import { 
  MessageSquarePlus, 
  Edit3, 
  CheckSquare, 
  Calendar, 
  Clock, 
  MessageCircle, 
  X, 
  User, 
  Activity, 
  AlertCircle,
  FileText,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ConversationFormInputs {
  conversationNote: string;
  nextFollowUp: string;
}

interface EditTicketFormInputs {
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  nextFollowUp: string;
}

export const TicketPage: React.FC = () => {
  const { 
    activeTicketId, 
    navigateTo, 
    goBack, 
    activeModalCloseHandler, 
    setActiveModalCloseHandler, 
    unsavedChanges, 
    setUnsavedChanges 
  } = useNav();
  const { profile, user } = useAuth();
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [clientName, setClientName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submittingLog, setSubmittingLog] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const logForm = useForm<ConversationFormInputs>({
    defaultValues: {
      conversationNote: '',
      nextFollowUp: new Date().toISOString().split('T')[0]
    }
  });

  const editForm = useForm<EditTicketFormInputs>();

  // Register modal close handler
  useEffect(() => {
    let targetHandler: (() => void) | null = null;
    if (isLogModalOpen) {
      targetHandler = () => setIsLogModalOpen(false);
    } else if (isEditModalOpen) {
      targetHandler = () => setIsEditModalOpen(false);
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
  }, [isLogModalOpen, isEditModalOpen, setActiveModalCloseHandler, activeModalCloseHandler]);

  // Track unsaved changes in modals
  useEffect(() => {
    let targetUnsaved = false;
    if (isLogModalOpen) {
      targetUnsaved = logForm.formState.isDirty;
    } else if (isEditModalOpen) {
      targetUnsaved = editForm.formState.isDirty;
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
  }, [isLogModalOpen, logForm.formState.isDirty, isEditModalOpen, editForm.formState.isDirty, setUnsavedChanges, unsavedChanges]);

  const loadTicketData = async () => {
    if (!activeTicketId) return;
    try {
      setLoading(true);
      const [ticketsRes, convsRes, clientsRes] = await Promise.all([
        crmApi.getTickets(),
        crmApi.getConversations(),
        crmApi.getClients()
      ]);

      const foundTicket = ticketsRes.find(t => t.id === activeTicketId);
      if (foundTicket) {
        setTicket(foundTicket);
        
        // Load associated client name
        const client = clientsRes.find(c => c.id === foundTicket.clientId);
        if (client) setClientName(client.name);

        // Filter conversations for this ticket, sort newest first
        const ticketConvs = convsRes
          .filter(c => c.ticketId === activeTicketId)
          .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        setConversations(ticketConvs);

        // Populate edit form defaults
        editForm.reset({
          title: foundTicket.title,
          description: foundTicket.description,
          priority: foundTicket.priority,
          status: foundTicket.status,
          nextFollowUp: foundTicket.nextFollowUp || new Date().toISOString().split('T')[0]
        });
      } else {
        toast.error('Ticket not found.');
        goBack();
      }
    } catch (err: any) {
      console.error('Error loading ticket details:', err);
      toast.error('Failed to load ticket timeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicketData();
  }, [activeTicketId]);

  // Handle Quick Close Ticket
  const handleCloseTicket = async () => {
    if (!ticket) return;
    try {
      const res = await crmApi.updateTicket({
        id: ticket.id,
        status: 'Closed'
      });
      if (res.success) {
        toast.success(`Ticket ${ticket.id} closed!`);
        await loadTicketData();
      } else {
        toast.error('Failed to close ticket.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating database.');
    }
  };

  // Submit Conversation Note (Add Log)
  const onSubmitLog = async (data: ConversationFormInputs) => {
    if (!ticket) return;
    try {
      setSubmittingLog(true);
      const res = await crmApi.addConversation({
        ticketId: ticket.id,
        conversationNote: data.conversationNote.trim(),
        nextFollowUp: data.nextFollowUp,
        createdBy: profile?.name || user?.displayName || 'CRM Agent',
        userEmail: user?.email || 'unknown@example.com'
      });

      if (res.success) {
        toast.success('Conversation log entry added!');
        setIsLogModalOpen(false);
        logForm.reset();
        await loadTicketData(); // Reload to update conversation count, timelines, and follow-up
      } else {
        toast.error('Could not add conversation log.');
      }
    } catch (err: any) {
      console.error('Error adding conversation log:', err);
      toast.error(err.message || 'Sync failed.');
    } finally {
      setSubmittingLog(false);
    }
  };

  // Submit Ticket Edits
  const onSubmitEdit = async (data: EditTicketFormInputs) => {
    if (!ticket) return;
    try {
      setSubmittingEdit(true);
      const res = await crmApi.updateTicket({
        id: ticket.id,
        title: data.title.trim(),
        description: data.description.trim(),
        priority: data.priority,
        status: data.status,
        nextFollowUp: data.nextFollowUp
      });

      if (res.success) {
        toast.success('Ticket records updated!');
        setIsEditModalOpen(false);
        await loadTicketData();
      } else {
        toast.error('Could not save ticket modifications.');
      }
    } catch (err: any) {
      console.error('Error modifying ticket:', err);
      toast.error(err.message || 'Database update error.');
    } finally {
      setSubmittingEdit(false);
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

  if (!ticket) return null;

  return (
    <div className="space-y-6 pb-24">
      {/* Ticket Info Card */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-blue-500 font-mono bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded leading-none">
              {ticket.id}
            </span>
            <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
              ticket.priority === 'High'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                : ticket.priority === 'Medium'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {ticket.priority} Priority
            </span>
            <span className="px-2 py-0.5 text-[9px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded">
              {ticket.status}
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {ticket.title}
          </h2>
          <div 
            onClick={() => navigateTo('clientDetail', { clientId: ticket.clientId })}
            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
          >
            <span>Client: {clientName || ticket.clientId}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Detailed Description */}
        <p className="text-xs text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100/40 dark:border-slate-800/40 leading-relaxed font-medium">
          {ticket.description}
        </p>

        {/* Times & Dates Metadata */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 text-[11px] text-slate-400 font-semibold">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Opened: {new Date(ticket.createdDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Updated: {new Date(ticket.lastUpdated).toLocaleDateString()}</span>
          </div>
          {ticket.nextFollowUp && (
            <div className="flex items-center gap-1 col-span-2 text-blue-600 dark:text-blue-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Next Follow Up: <span className="font-mono">{ticket.nextFollowUp}</span></span>
            </div>
          )}
        </div>

        {/* Interactive Action Bar */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50 dark:border-slate-800/60">
          {/* Add Log button */}
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="flex flex-col items-center justify-center p-2.5 bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/30 dark:hover:bg-blue-950/55 text-blue-600 dark:text-blue-400 rounded-2xl font-bold text-[10px] gap-1 transition-all border border-blue-100/35"
            style={{ minHeight: '44px' }}
            id="ticket-add-conversation-button"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>Add Log</span>
          </button>

          {/* Edit Details button */}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex flex-col items-center justify-center p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-[10px] gap-1 transition-all border border-slate-100 dark:border-slate-800"
            style={{ minHeight: '44px' }}
            id="ticket-edit-details-button"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Ticket</span>
          </button>

          {/* Close Ticket button */}
          <button
            onClick={handleCloseTicket}
            disabled={ticket.status === 'Closed'}
            className="flex flex-col items-center justify-center p-2.5 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl font-bold text-[10px] gap-1 transition-all disabled:opacity-40 disabled:scale-100 border border-rose-100/35 active:scale-95 cursor-pointer"
            style={{ minHeight: '44px' }}
            id="ticket-close-button"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Close Ticket</span>
          </button>
        </div>
      </div>

      {/* Conversation Timeline */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4" />
          <span>Conversation History ({conversations.length})</span>
        </h3>

        {conversations.length === 0 ? (
          <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-100 dark:border-slate-800 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">No conversation notes</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
              Click "Add Log" to log calls, customer inquiries, meeting briefings, or WhatsApp chats.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
            {conversations.map((conv, idx) => (
              <div key={conv.id} className="flex gap-3 pl-1.5 group">
                {/* Timeline node */}
                <div className="w-3.5 h-3.5 bg-blue-500 rounded-full border-4 border-white dark:border-slate-900 shadow-sm relative z-10 mt-1.5 shrink-0" />
                
                {/* Content card */}
                <div className="flex-1 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-1.5 flex-wrap gap-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 font-mono">
                      Log {conv.id}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold font-mono">
                      {new Date(conv.dateTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed break-words whitespace-pre-wrap">
                    {conv.conversationNote}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-50 dark:border-slate-850/60 text-[10px]">
                    <div className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                      <User className="w-3 h-3" />
                      <span>{conv.createdBy} ({conv.userEmail.split('@')[0]})</span>
                    </div>

                    {conv.nextFollowUp && (
                      <div className="bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-slate-500 dark:text-slate-400 font-bold rounded flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
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

      {/* Add Conversation Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <MessageSquarePlus className="w-4.5 h-4.5 text-blue-500" />
                <span>Log Conversation Note</span>
              </h3>
              <button
                onClick={() => {
                  setIsLogModalOpen(false);
                  logForm.reset();
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={logForm.handleSubmit(onSubmitLog)} className="space-y-4">
              {/* Note Content */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Conversation Note *</label>
                <textarea
                  rows={4}
                  placeholder="Summarize details, request scope, and key discussion results..."
                  {...logForm.register('conversationNote', { required: 'Conversation Note is required' })}
                  className={`w-full p-3.5 bg-slate-50 dark:bg-slate-950 border ${
                    logForm.formState.errors.conversationNote ? 'border-rose-500' : 'border-slate-100 dark:border-slate-800'
                  } rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-medium transition-all`}
                />
                {logForm.formState.errors.conversationNote && (
                  <p className="text-[10px] text-rose-500 font-bold">{logForm.formState.errors.conversationNote.message}</p>
                )}
              </div>

              {/* Next Follow Up */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Update Follow Up Date</label>
                <input
                  type="date"
                  {...logForm.register('nextFollowUp')}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 font-mono"
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  Sets the next action calendar date for this client, updating both the ticket and client records.
                </p>
              </div>

              {/* Buttons */}
              <button
                type="submit"
                disabled={submittingLog}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow hover:shadow-blue-500/10 transition-all active:scale-95 disabled:scale-100 disabled:opacity-50 cursor-pointer border border-blue-500/10"
                style={{ minHeight: '44px' }}
                id="modal-add-conversation-submit-button"
              >
                {submittingLog ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  <span>Save Log &amp; Update Schedule</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Edit3 className="w-4.5 h-4.5 text-blue-500" />
                <span>Modify Support Ticket</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
              {/* Ticket Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Ticket Title *</label>
                <input
                  type="text"
                  {...editForm.register('title', { required: 'Ticket Title is required' })}
                  className={`w-full p-3.5 bg-slate-50 dark:bg-slate-950 border ${
                    editForm.formState.errors.title ? 'border-rose-500' : 'border-slate-100 dark:border-slate-800'
                  } rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-semibold transition-all`}
                />
                {editForm.formState.errors.title && (
                  <p className="text-[10px] text-rose-500 font-bold">{editForm.formState.errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Problem Description *</label>
                <textarea
                  rows={3}
                  {...editForm.register('description', { required: 'Description is required' })}
                  className={`w-full p-3.5 bg-slate-50 dark:bg-slate-950 border ${
                    editForm.formState.errors.description ? 'border-rose-500' : 'border-slate-100 dark:border-slate-800'
                  } rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 font-medium transition-all`}
                />
                {editForm.formState.errors.description && (
                  <p className="text-[10px] text-rose-500 font-bold">{editForm.formState.errors.description.message}</p>
                )}
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Priority</label>
                  <select
                    {...editForm.register('priority')}
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
                    {...editForm.register('status')}
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
                  {...editForm.register('nextFollowUp')}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 font-mono"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submittingEdit}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow hover:shadow-blue-500/10 transition-all active:scale-95 disabled:scale-100 disabled:opacity-50 cursor-pointer border border-blue-500/10 mt-2"
                style={{ minHeight: '44px' }}
                id="modal-edit-ticket-submit-button"
              >
                {submittingEdit ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  <span>Save Ticket Modifications</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default TicketPage;
