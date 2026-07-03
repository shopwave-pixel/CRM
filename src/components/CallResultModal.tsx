/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Phone, Clock, FileText, Calendar, X, AlertCircle } from 'lucide-react';
import { Client, Ticket } from '../types';
import { crmApi } from '../services/api';
import toast from 'react-hot-toast';
import { getBangladeshDateString } from '../utils';

interface CallResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  currentUser: { name?: string; email?: string } | null;
  onSaved?: () => void;
}

export const CallResultModal: React.FC<CallResultModalProps> = ({
  isOpen,
  onClose,
  client,
  currentUser,
  onSaved
}) => {
  const [status, setStatus] = useState<string>('Connected');
  const [duration, setDuration] = useState<string>('2 mins');
  const [note, setNote] = useState<string>('');
  const [nextFollowUp, setNextFollowUp] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Auto-set next follow up if status is Call Back Later
  useEffect(() => {
    if (status === 'Call Back Later') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      setNextFollowUp(`${year}-${month}-${day}`);
    }
  }, [status]);

  if (!isOpen || !client) return null;

  const handleQuickDuration = (dur: string) => {
    setDuration(dur);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 1. Get or create a ticket for this client
      const tickets = await crmApi.getTickets();
      const clientTickets = tickets.filter(t => t.clientId === client.id && t.status !== 'Closed');
      
      let targetTicketId = '';

      if (clientTickets.length > 0) {
        // Use the most recent open ticket
        targetTicketId = clientTickets[0].id;
      } else {
        // Create a new general ticket for call logging
        const ticketRes = await crmApi.addTicket({
          clientId: client.id,
          title: 'General Phone Interaction Log',
          description: 'Auto-created ticket to track calls and general discussions.',
          priority: 'Medium',
          status: 'Open'
        });
        if (ticketRes.success) {
          targetTicketId = ticketRes.ticket.id;
        } else {
          throw new Error('Failed to create call tracking ticket.');
        }
      }

      // 2. Format Follow-up Date (if any)
      let formattedFollowUp = '';
      if (nextFollowUp) {
        const parts = nextFollowUp.split('-'); // YYYY-MM-DD
        if (parts.length === 3) {
          formattedFollowUp = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      // 3. Construct standard parseable Call Log note
      const callLogNote = `[Call Log] Status: ${status} | Duration: ${duration} | Summary: ${note || 'No specific notes recorded.'}`;

      // 4. Create Conversation Entry
      const convRes = await crmApi.addConversation({
        ticketId: targetTicketId,
        conversationNote: callLogNote,
        nextFollowUp: formattedFollowUp,
        createdBy: currentUser?.name || 'Agent',
        userEmail: currentUser?.email || ''
      });

      if (convRes.success) {
        // Update client next follow up if specified
        if (formattedFollowUp) {
          await crmApi.updateClient({
            id: client.id,
            nextFollowUp: formattedFollowUp
          });
        }
        
        toast.success('📞 Call log saved successfully!');
        if (onSaved) onSaved();
        onClose();
      } else {
        toast.error('❌ Failed to log conversation details.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`❌ Error logging call: ${err.message || 'Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions = [
    { label: 'Connected', color: 'bg-emerald-500 text-white', inactiveColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100/30' },
    { label: 'No Answer', color: 'bg-slate-500 text-white', inactiveColor: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-350' },
    { label: 'Busy', color: 'bg-amber-500 text-white', inactiveColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100/30' },
    { label: 'Switched Off', color: 'bg-rose-500 text-white', inactiveColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-100/30' },
    { label: 'Call Back Later', color: 'bg-blue-500 text-white', inactiveColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-100/30' },
    { label: 'Wrong Number', color: 'bg-orange-500 text-white', inactiveColor: 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 border-orange-100/30' }
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 relative overflow-y-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100 dark:border-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-500 shrink-0">
              <Phone className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Call Log Tracker
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
                Client: {client.name} ({client.id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Call Status Options */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
              Call Result / Status:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setStatus(opt.label)}
                  className={`py-3 px-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer border ${
                    status === opt.label 
                      ? `${opt.color} shadow-sm font-extrabold scale-[1.01]` 
                      : `${opt.inactiveColor} hover:scale-[1.01] hover:bg-opacity-80`
                  }`}
                  id={`status-opt-${opt.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Call Duration */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block flex justify-between">
              <span>Call Duration:</span>
              <span className="font-mono text-blue-500">{duration}</span>
            </label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 2 mins, 45 seconds"
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold focus:outline-none dark:text-white"
              required
              id="call-duration-input"
            />
            <div className="flex gap-1.5 pt-0.5 overflow-x-auto pb-1">
              {['30s', '1m', '2m', '5m', '10m', 'No Answer'].map(dur => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => handleQuickDuration(dur === 'No Answer' ? '0s' : dur)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-bold cursor-pointer shrink-0 transition-colors"
                >
                  {dur}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Note */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
              Call Conversation Note / Summary:
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Provide a brief summary of what was discussed, objections, or next actions..."
              rows={3}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold leading-relaxed focus:outline-none dark:text-white resize-none"
              id="call-note-input"
            />
          </div>

          {/* Next Follow Up */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Schedule Next Follow-up: (Optional)</span>
            </label>
            <input
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold focus:outline-none dark:text-white"
              id="call-next-follow-up-input"
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-xs transition-colors cursor-pointer text-center"
              style={{ minHeight: '44px' }}
              id="call-log-cancel-btn"
            >
              Discard Call Log
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded-2xl font-black text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              style={{ minHeight: '44px' }}
              id="call-log-save-btn"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  <span>Save Call Log</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
