/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNav } from '../context/NavContext';
import { crmApi } from '../services/api';
import { Client, Ticket } from '../types';
import { Search as SearchIcon, Users, FileText, ChevronRight, Phone, Building2, Calendar, AlertCircle, Star } from 'lucide-react';
import { ListSkeleton } from '../components/Skeleton';
import toast from 'react-hot-toast';
import { cleanPhoneForSearch, formatBDPhoneForDisplay, handlePhoneCall } from '../utils';
import { ClientQuickActions, LongPressActionsModal, LongPressable } from '../components/ClientQuickActions';

export const Search: React.FC = () => {
  const { navigateTo } = useNav();
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // Long press modal state
  const [longPressType, setLongPressType] = useState<'name' | 'phone' | null>(null);
  const [longPressClient, setLongPressClient] = useState<Client | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [clientsRes, ticketsRes] = await Promise.all([
          crmApi.getClients(),
          crmApi.getTickets()
        ]);
        setClients(clientsRes);
        setTickets(ticketsRes);
      } catch (err: any) {
        console.error('Error fetching search records:', err);
        toast.error('Failed to pre-load CRM records.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeClients = clients.filter(c => !c.isArchived);

  // Filter clients and tickets based on search query
  const cleanQuery = query.toLowerCase().trim();
  const queryPhoneClean = cleanPhoneForSearch(query);
  
  const filteredClients = cleanQuery 
    ? activeClients.filter(c => {
        const nameMatch = c.name.toLowerCase().includes(cleanQuery);
        const companyMatch = c.company.toLowerCase().includes(cleanQuery);
        const idMatch = c.id.toLowerCase().includes(cleanQuery);
        
        // Phone match - ignores +880, 880, spaces, hyphens
        let phoneMatch = false;
        if (c.phone) {
          const clientPhoneClean = cleanPhoneForSearch(c.phone);
          if (queryPhoneClean && clientPhoneClean.includes(queryPhoneClean)) {
            phoneMatch = true;
          }
        }
        
        return nameMatch || companyMatch || idMatch || phoneMatch;
      })
    : activeClients;

  // Sort Pinned clients first
  const sortedFilteredClients = [...filteredClients].sort((a, b) => {
    const aPinned = a.isPinned ? 1 : 0;
    const bPinned = b.isPinned ? 1 : 0;
    return bPinned - aPinned;
  });

  const filteredTickets = cleanQuery 
    ? tickets.filter(t => {
        const idMatch = t.id.toLowerCase().includes(cleanQuery);
        const titleMatch = t.title.toLowerCase().includes(cleanQuery);
        const descMatch = t.description.toLowerCase().includes(cleanQuery);
        const clientIdMatch = t.clientId.toLowerCase().includes(cleanQuery);
        
        // Check if ticket's associated client matches search
        let clientMatch = false;
        const associatedClient = activeClients.find(c => c.id === t.clientId);
        if (associatedClient) {
          if (associatedClient.name.toLowerCase().includes(cleanQuery)) {
            clientMatch = true;
          }
          if (associatedClient.phone) {
            const clientPhoneClean = cleanPhoneForSearch(associatedClient.phone);
            if (queryPhoneClean && clientPhoneClean.includes(queryPhoneClean)) {
              clientMatch = true;
            }
          }
        }
        
        return idMatch || titleMatch || descMatch || clientIdMatch || clientMatch;
      })
    : [];

  const totalResults = (cleanQuery ? filteredClients.length + filteredTickets.length : filteredClients.length);

  return (
    <div className="space-y-6 pb-24">
      {/* Search Input Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Name, Phone, Company, Ticket ID..."
          className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white dark:placeholder-slate-500 text-sm font-medium transition-all"
          id="crm-search-bar"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Section: Matching Tickets (only shown if searching) */}
          {cleanQuery && filteredTickets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>Matching Tickets ({filteredTickets.length})</span>
              </h3>
              
              <div className="space-y-2">
                {filteredTickets.map(ticket => {
                  const associatedClient = clients.find(c => c.id === ticket.clientId);
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => navigateTo('ticketDetail', { ticketId: ticket.id })}
                      className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm hover:border-slate-200 dark:hover:border-slate-700/80 transition-all flex justify-between items-start cursor-pointer active:scale-99"
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-blue-500 font-mono bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                            {ticket.id}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
                            ticket.priority === 'High' 
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' 
                              : ticket.priority === 'Medium'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {ticket.priority}
                          </span>
                          <span className="px-1.5 py-0.5 text-[8px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded">
                            {ticket.status}
                          </span>
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-800 dark:text-white leading-tight mt-1">{ticket.title}</h4>
                        {associatedClient && (
                          <p className="text-[10px] text-slate-400 font-medium">Client: {associatedClient.name}</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 mt-1 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Clients */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{cleanQuery ? `Matching Clients (${filteredClients.length})` : `All Clients (${clients.length})`}</span>
            </h3>

            {filteredClients.length === 0 ? (
              <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-100 dark:border-slate-800 text-center space-y-2">
                <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No results found</h4>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">No client records match "{query}". Double-check spelling or try searching by phone number.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sortedFilteredClients.map(client => (
                  <div
                    key={client.id}
                    onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm hover:border-slate-200 dark:hover:border-slate-700/80 transition-all flex justify-between items-center cursor-pointer active:scale-99"
                  >
                    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <LongPressable
                          onLongPress={() => { setLongPressClient(client); setLongPressType('name'); }}
                          onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                        >
                          <h4 className="text-sm font-extrabold text-slate-800 dark:text-white leading-tight hover:text-blue-500 cursor-pointer">{client.name}</h4>
                        </LongPressable>
                        {client.isPinned && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                        )}
                        <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
                          client.status === 'Customer'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : client.status === 'Interested'
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                            : client.status === 'Lost'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                            : 'bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400'
                        }`}>
                          {client.status}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 font-medium">
                        {client.company && (
                          <div className="flex items-center gap-0.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-350" />
                            <span>{client.company}</span>
                          </div>
                        )}
                        {client.phone && (
                          <LongPressable
                            onLongPress={() => { setLongPressClient(client); setLongPressType('phone'); }}
                            onClick={() => handlePhoneCall(client.phone)}
                          >
                            <div className="flex items-center gap-0.5 hover:text-blue-500 cursor-pointer">
                              <Phone className="w-3.5 h-3.5 text-slate-350" />
                              <span className="font-mono">{formatBDPhoneForDisplay(client.phone)}</span>
                            </div>
                          </LongPressable>
                        )}
                        {client.nextFollowUp && (
                          <div className="flex items-center gap-0.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-350" />
                            <span>Next: {client.nextFollowUp}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-end">
                        <LongPressable
                          onLongPress={() => { setLongPressClient(client); setLongPressType('name'); }}
                        >
                          <span className="text-[10px] text-slate-400 font-extrabold font-mono hover:text-blue-500 cursor-pointer">{client.id}</span>
                        </LongPressable>
                        {client.totalTickets > 0 && (
                          <span className="text-[9px] bg-slate-50 dark:bg-slate-800/80 px-1.5 py-0.5 text-slate-500 dark:text-slate-400 font-bold rounded-full mt-1">
                            {client.totalTickets} {client.totalTickets === 1 ? 'ticket' : 'tickets'}
                          </span>
                        )}
                      </div>
                      <ClientQuickActions client={client} />
                      <button 
                        onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                        className="p-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
export default Search;
