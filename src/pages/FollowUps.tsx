/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNav } from '../context/NavContext';
import { crmApi } from '../services/api';
import { Client } from '../types';
import { ListSkeleton } from '../components/Skeleton';
import { 
  Phone, 
  MessageCircle, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Clock,
  Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBDPhoneForDisplay, handlePhoneCall, handleWhatsAppMessage, parseBDDate, getBangladeshDateString } from '../utils';
import { ClientQuickActions, LongPressActionsModal, LongPressable } from '../components/ClientQuickActions';

export const FollowUps: React.FC = () => {
  const { navigateTo } = useNav();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'overdue' | 'upcoming'>('today');

  // Long press modal state
  const [longPressType, setLongPressType] = useState<'name' | 'phone' | null>(null);
  const [longPressClient, setLongPressClient] = useState<Client | null>(null);

  useEffect(() => {
    const fetchFollowUps = async () => {
      try {
        setLoading(true);
        const res = await crmApi.getClients();
        setClients(res);
      } catch (err: any) {
        console.error('Error fetching follow ups:', err);
        toast.error('Failed to load follow-up schedules.');
      } finally {
        setLoading(false);
      }
    };
    fetchFollowUps();
  }, []);

  const todayBD = getBangladeshDateString(new Date()); // e.g. "30/06/2026"
  const todayParsed = parseBDDate(todayBD);
  const todayTime = todayParsed ? todayParsed.getTime() : new Date().setHours(0, 0, 0, 0);

  const activeClients = clients.filter(c => !c.isArchived);

  // Filter clients into categories
  const todayFollowUps = activeClients.filter(c => {
    if (!c.nextFollowUp) return false;
    const clientDatePart = c.nextFollowUp.split(' ')[0]; // DD/MM/YYYY
    return clientDatePart === todayBD;
  });

  const overdueFollowUps = activeClients.filter(c => {
    if (!c.nextFollowUp || c.status === 'Lost') return false;
    const clientDatePart = c.nextFollowUp.split(' ')[0];
    if (clientDatePart === todayBD) return false;
    const parsed = parseBDDate(clientDatePart);
    return parsed && parsed.getTime() < todayTime;
  });

  const upcomingFollowUps = activeClients.filter(c => {
    if (!c.nextFollowUp) return false;
    const clientDatePart = c.nextFollowUp.split(' ')[0];
    if (clientDatePart === todayBD) return false;
    const parsed = parseBDDate(clientDatePart);
    return parsed && parsed.getTime() > todayTime;
  });

  const getFilteredList = () => {
    switch (activeTab) {
      case 'overdue': return overdueFollowUps;
      case 'upcoming': return upcomingFollowUps;
      default: return todayFollowUps;
    }
  };

  const currentList = getFilteredList();

  const handleCall = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation(); // prevent card tap navigation
    handlePhoneCall(phone);
  };

  const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    handleWhatsAppMessage(phone);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Dynamic Segmented Control Tabs */}
      <div className="flex bg-slate-150 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-100 dark:border-slate-800/80">
        <button
          onClick={() => setActiveTab('overdue')}
          className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
            activeTab === 'overdue'
              ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
          id="tab-overdue"
        >
          Overdue
          {overdueFollowUps.length > 0 && (
            <span className="ml-1 px-1.5 py-0.25 bg-rose-500 text-white font-black text-[9px] rounded-full">
              {overdueFollowUps.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('today')}
          className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
            activeTab === 'today'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
          id="tab-today"
        >
          Today
          {todayFollowUps.length > 0 && (
            <span className="ml-1 px-1.5 py-0.25 bg-blue-600 text-white font-black text-[9px] rounded-full">
              {todayFollowUps.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
            activeTab === 'upcoming'
              ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
          id="tab-upcoming"
        >
          Upcoming
        </button>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-3">
          {currentList.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-100 dark:border-slate-800 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {activeTab === 'overdue' ? 'No overdue items' : activeTab === 'today' ? 'All caught up today!' : 'No upcoming follow-ups'}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                {activeTab === 'overdue' 
                  ? 'Great job keeping up with your schedule!' 
                  : activeTab === 'today' 
                  ? 'No contacts need immediate follow-up. Add clients or create new follow-up tasks to fill your queue.' 
                  : 'Schedules will appear here when follow-up dates are set in client cards.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentList.map(client => (
                <div
                  key={client.id}
                  onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer flex flex-col gap-3.5 active:scale-[0.99]"
                >
                  {/* Top line with name & status */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <LongPressable
                          onLongPress={() => { setLongPressClient(client); setLongPressType('name'); }}
                          onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                        >
                          <span className="text-sm font-extrabold text-slate-800 dark:text-white leading-none hover:text-blue-500 cursor-pointer">
                            {client.name}
                          </span>
                        </LongPressable>
                        <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
                          client.status === 'Customer'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : client.status === 'Interested'
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                            : 'bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400'
                        }`}>
                          {client.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-slate-300" />
                        <span>{client.company || 'Individual Freelancer'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <LongPressable
                        onLongPress={() => { setLongPressClient(client); setLongPressType('name'); }}
                      >
                        <span className="text-[10px] text-slate-400 font-extrabold font-mono leading-none pt-0.5 cursor-pointer">
                          {client.id}
                        </span>
                      </LongPressable>
                      <ClientQuickActions client={client} />
                    </div>
                  </div>

                  {/* Middle Line containing Contact details & dates */}
                  <div className="flex items-center justify-between text-xs border-t border-b border-slate-50 dark:border-slate-800/50 py-2.5">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>Scheduled:</span>
                      <span className={`font-mono ${activeTab === 'overdue' ? 'text-rose-500 font-bold' : ''}`}>
                        {client.nextFollowUp}
                      </span>
                    </div>

                    <LongPressable
                      onLongPress={() => { setLongPressClient(client); setLongPressType('phone'); }}
                      onClick={() => handlePhoneCall(client.phone)}
                    >
                      <div className="text-[10px] text-slate-400 font-medium hover:text-blue-500 cursor-pointer">
                        Phone: <span className="font-mono">{formatBDPhoneForDisplay(client.phone)}</span>
                      </div>
                    </LongPressable>
                  </div>

                  {/* Action Buttons Container */}
                  <div className="flex gap-2">
                    {/* Call Button */}
                    <button
                      onClick={(e) => handleCall(e, client.phone)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors border border-emerald-100/30 cursor-pointer"
                      style={{ minHeight: '44px' }}
                      id={`call-btn-${client.id}`}
                    >
                      <Phone className="w-4 h-4" />
                      <span>Call Client</span>
                    </button>

                    {/* WhatsApp Button */}
                    <button
                      onClick={(e) => handleWhatsApp(e, client.phone)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors border border-blue-100/30 cursor-pointer"
                      style={{ minHeight: '44px' }}
                      id={`wa-btn-${client.id}`}
                    >
                      <MessageCircle className="w-4 h-4 text-blue-500" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <LongPressActionsModal
        type={longPressType}
        client={longPressClient}
        onClose={() => {
          setLongPressType(null);
          setLongPressClient(null);
        }}
      />
    </div>
  );
};
export default FollowUps;
