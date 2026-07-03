/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useNav } from '../context/NavContext';
import { useAuth } from '../context/AuthContext';
import { crmApi, getStoredAppsScriptUrl } from '../services/api';
import { offlineDb } from '../services/offlineDb';
import { CRMStats, Client, Ticket, Conversation } from '../types';
import { CardSkeleton, StatsSkeleton } from '../components/Skeleton';
import { 
  Users, 
  FileText, 
  CalendarClock, 
  AlertCircle, 
  CheckCircle2, 
  UserPlus, 
  Search as SearchIcon, 
  Clock, 
  Phone, 
  MessageSquare,
  Sparkles,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  UserCheck,
  Star,
  StarOff,
  MapPin,
  Calendar,
  MessageCircle,
  ArrowUpDown,
  Check,
  CalendarDays,
  Building2,
  Plus,
  Archive
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getBangladeshDateString, inputDateToBD, parseBDDate, formatBDPhoneForDisplay, handlePhoneCall, handleWhatsAppMessage } from '../utils';
import { ClientQuickActions, LongPressActionsModal, LongPressable } from '../components/ClientQuickActions';

const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!text) return null;
  if (!highlight.trim()) return <span>{text}</span>;
  
  const parts = text.split(new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-amber-100 dark:bg-amber-950/70 text-slate-900 dark:text-amber-100 font-extrabold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

export const Dashboard: React.FC = () => {
  const { 
    navigateTo, 
    dashboardSearchQuery, 
    setDashboardSearchQuery, 
    dashboardSearchFilter, 
    setDashboardSearchFilter,
    setSearchPrefilledPhone 
  } = useNav();
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<CRMStats | null>(null);
  
  // Real-time debounced search state
  const [searchInput, setSearchInput] = useState<string>(dashboardSearchQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Sync search input and load history on mount
  useEffect(() => {
    const loadSearches = async () => {
      try {
        const saved = await offlineDb.getCache<string[]>('crm_dashboard_recent_searches');
        if (saved) {
          setRecentSearches(saved);
        }
      } catch (e) {
        setRecentSearches([]);
      }
    };
    loadSearches();
  }, []);

  // Debounce effect to write to global search and save history
  useEffect(() => {
    const timer = setTimeout(() => {
      setDashboardSearchQuery(searchInput);
      if (searchInput.trim().length >= 3) {
        const trimmed = searchInput.trim();
        setRecentSearches(prev => {
          const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
          const updated = [trimmed, ...filtered].slice(0, 10);
          offlineDb.setCache('crm_dashboard_recent_searches', updated).catch(() => {});
          return updated;
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setDashboardSearchQuery]);

  const clearSearchHistory = () => {
    offlineDb.setCache('crm_dashboard_recent_searches', []).catch(() => {});
    setRecentSearches([]);
    toast.success('Search history cleared.');
  };
  
  // Long press state
  const [longPressType, setLongPressType] = useState<'name' | 'phone' | null>(null);
  const [longPressClient, setLongPressClient] = useState<Client | null>(null);

  // Raw records
  const [clients, setClients] = useState<Client[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  const [followUps, setFollowUps] = useState<Client[]>([]);
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [recentClientsCount, setRecentClientsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Widget States
  const [followUpSort, setFollowUpSort] = useState<'nearest' | 'name' | 'priority'>('nearest');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null); // ticket ID
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [quickNoteTicketId, setQuickNoteTicketId] = useState<string | null>(null); // ticket ID
  const [quickNoteText, setQuickNoteText] = useState<string>('');
  const [submittingQuickNote, setSubmittingQuickNote] = useState<boolean>(false);

  const loadDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const [statsRes, clientsRes, convsRes, ticketsRes] = await Promise.all([
        crmApi.getStats(),
        crmApi.getClients(),
        crmApi.getConversations(),
        crmApi.getTickets()
      ]);

      setStats(statsRes);
      setClients(clientsRes);
      setConversations(convsRes);
      setTickets(ticketsRes);
      
      const pendingCount = ticketsRes.filter(t => t.status === 'Pending').length;
      setPendingTicketsCount(pendingCount);

      const todayDateBD = getBangladeshDateString(new Date());
      
      const todayFollowUps = clientsRes.filter(c => {
        if (!c.nextFollowUp) return false;
        const normFollowUp = c.nextFollowUp.includes('-') ? inputDateToBD(c.nextFollowUp) : c.nextFollowUp;
        return normFollowUp === todayDateBD;
      });
      setFollowUps(todayFollowUps);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentCount = clientsRes.filter(c => {
        const activeDate = parseBDDate(c.updatedAt || c.createdAt) || new Date(c.updatedAt || c.createdAt);
        return activeDate >= sevenDaysAgo;
      }).length;
      setRecentClientsCount(recentCount);

    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      toast.error('Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const handleUpdate = () => {
      loadDashboardData(true);
    };
    window.addEventListener('clients-updated', handleUpdate);
    return () => {
      window.removeEventListener('clients-updated', handleUpdate);
    };
  }, [getStoredAppsScriptUrl()]);

  // Periodic Auto-Refresh (Every 60 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getCleanPhone = (phoneStr: string) => {
    return phoneStr.replace(/[\s\-\(\)\+]/g, '');
  };

  const handleTogglePin = async (clientId: string, currentPinStatus: boolean) => {
    try {
      const res = await crmApi.updateClient({
        id: clientId,
        isPinned: !currentPinStatus
      });
      if (res.success) {
        toast.success(!currentPinStatus ? 'Client pinned!' : 'Client unpinned.');
        await loadDashboardData(true);
      } else {
        toast.error('Failed to update pin status.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error toggling pin status.');
    }
  };

  const handleMarkTicketComplete = async (ticketId: string) => {
    try {
      const res = await crmApi.updateTicket({
        id: ticketId,
        status: 'Closed'
      });
      if (res.success) {
        toast.success(`Ticket ${ticketId} completed!`);
        await loadDashboardData(true);
      } else {
        toast.error('Failed to update ticket status.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error completing ticket.');
    }
  };

  const handleRescheduleSave = async (ticketId: string, clientId: string, newDate: string) => {
    if (!newDate) {
      toast.error('Please select a valid date.');
      return;
    }
    try {
      const formattedDate = inputDateToBD(newDate);
      const updateTicketPromise = crmApi.updateTicket({
        id: ticketId,
        nextFollowUp: formattedDate
      });
      const updateClientPromise = crmApi.updateClient({
        id: clientId,
        nextFollowUp: formattedDate
      });
      await Promise.all([updateTicketPromise, updateClientPromise]);
      toast.success('Follow-up rescheduled!');
      setReschedulingId(null);
      setRescheduleDate('');
      await loadDashboardData(true);
    } catch (err) {
      console.error(err);
      toast.error('Failed to reschedule follow-up.');
    }
  };

  const handleAddQuickNote = async (ticketId: string) => {
    if (!quickNoteText.trim()) {
      toast.error('Conversation note note cannot be empty.');
      return;
    }
    try {
      setSubmittingQuickNote(true);
      const res = await crmApi.addConversation({
        ticketId,
        conversationNote: quickNoteText.trim(),
        nextFollowUp: getBangladeshDateString(new Date()),
        createdBy: profile?.name || user?.displayName || 'CRM Agent',
        userEmail: user?.email || 'unknown@example.com'
      });
      if (res.success) {
        toast.success('Conversation note saved!');
        setQuickNoteText('');
        setQuickNoteTicketId(null);
        await loadDashboardData(true);
      } else {
        toast.error('Could not add note.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error adding conversation note.');
    } finally {
      setSubmittingQuickNote(false);
    }
  };

  const handleAddConversationForClient = (clientId: string) => {
    const clientTickets = tickets.filter(t => t.clientId === clientId);
    if (clientTickets.length === 0) {
      toast.error('No tickets found for this client. Opening client profile to add ticket first.');
      navigateTo('clientDetail', { clientId });
      return;
    }
    const latestTicket = [...clientTickets].sort((a, b) => new Date(b.lastUpdated || b.createdDate).getTime() - new Date(a.lastUpdated || a.createdDate).getTime())[0];
    setQuickNoteTicketId(latestTicket.id);
    setQuickNoteText('');
  };

  const activeClients = clients.filter(c => !c.isArchived);

  // 1. Pinned Clients
  const pinnedClients = activeClients.filter(c => c.isPinned);

  const getLatestConversationNote = (clientId: string) => {
    const clientTickets = tickets.filter(t => t.clientId === clientId);
    const clientTicketIds = clientTickets.map(t => t.id);
    const clientConvs = conversations.filter(c => clientTicketIds.includes(c.ticketId));
    if (clientConvs.length === 0) return 'No conversation notes yet';
    const sorted = [...clientConvs].sort((a, b) => {
      const dateA = parseBDDate(a.dateTime) || new Date(a.dateTime);
      const dateB = parseBDDate(b.dateTime) || new Date(b.dateTime);
      return dateB.getTime() - dateA.getTime();
    });
    return sorted[0].conversationNote;
  };

  const matchingClients = activeClients.filter(c => {
    const q = dashboardSearchQuery.toLowerCase().trim();
    if (!q) {
      // Filter when query is empty, based on the filter chip
      switch (dashboardSearchFilter) {
        case 'All':
          return false; // Don't show results when search is empty and filter is 'All'
        case 'Clients':
          return false;
        case 'Tickets':
          return false;
        case "Today's Follow-ups": {
          const todayDateBD = getBangladeshDateString(new Date());
          return c.nextFollowUp && c.nextFollowUp.split(' ')[0] === todayDateBD;
        }
        case 'Open Tickets': {
          const clientTickets = tickets.filter(t => t.clientId === c.id);
          return clientTickets.some(t => t.status !== 'Closed');
        }
        case 'Pinned Clients':
          return c.isPinned;
        case 'Recent Clients': {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const activeDate = parseBDDate(c.updatedAt || c.createdAt) || new Date(c.updatedAt || c.createdAt);
          return activeDate >= sevenDaysAgo;
        }
        default:
          return false;
      }
    }

    // Matching logic for query
    const nameMatch = c.name.toLowerCase().includes(q);
    const companyMatch = c.company ? c.company.toLowerCase().includes(q) : false;
    const districtMatch = c.district ? c.district.toLowerCase().includes(q) : false;
    const statusMatch = c.status ? c.status.toLowerCase().includes(q) : false;
    const idMatch = c.id.toLowerCase().includes(q);

    const cleanQPhone = q.replace(/[^0-9]/g, '');
    let phoneMatch = false;
    if (c.phone) {
      const cleanCPhone = c.phone.replace(/[^0-9]/g, '');
      if (cleanQPhone && cleanCPhone.includes(cleanQPhone)) {
        phoneMatch = true;
      }
      if (cleanQPhone.length === 4 && cleanCPhone.endsWith(cleanQPhone)) {
        phoneMatch = true;
      }
    }

    const clientTickets = tickets.filter(t => t.clientId === c.id);
    const ticketIdMatch = clientTickets.some(t => t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q));

    const matchesQuery = nameMatch || companyMatch || districtMatch || statusMatch || idMatch || phoneMatch || ticketIdMatch;

    if (!matchesQuery) return false;

    // Additionally apply filter chip restriction
    switch (dashboardSearchFilter) {
      case 'All':
        return true;
      case 'Clients':
        return true;
      case 'Tickets':
        return ticketIdMatch;
      case "Today's Follow-ups": {
        const todayDateBD = getBangladeshDateString(new Date());
        return c.nextFollowUp && c.nextFollowUp.split(' ')[0] === todayDateBD;
      }
      case 'Open Tickets':
        return clientTickets.some(t => t.status !== 'Closed');
      case 'Pinned Clients':
        return c.isPinned;
      case 'Recent Clients': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const activeDate = parseBDDate(c.updatedAt || c.createdAt) || new Date(c.updatedAt || c.createdAt);
        return activeDate >= sevenDaysAgo;
      }
      default:
        return true;
    }
  });

  // 2. Upcoming Follow Ups (Next 7 days + Overdue)
  const getRemainingDaysAndColor = (followUpStr: string) => {
    if (!followUpStr) return { days: 999, color: 'Upcoming', label: 'None', badgeClass: 'bg-slate-50 dark:bg-slate-800 text-slate-500' };
    const parsedDate = parseBDDate(followUpStr);
    if (!parsedDate) return { days: 999, color: 'Upcoming', label: 'Upcoming', badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(parsedDate);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { days: diffDays, color: 'Overdue', label: 'Overdue 🔴', badgeClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-100/20 font-bold' };
    } else if (diffDays === 0) {
      return { days: diffDays, color: 'Today', label: 'Today 🟠', badgeClass: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 border border-orange-100/20 font-bold' };
    } else if (diffDays === 1) {
      return { days: diffDays, color: 'Tomorrow', label: 'Tomorrow 🟡', badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-100/20 font-bold' };
    } else {
      return { days: diffDays, color: 'Upcoming', label: `${diffDays} days left 🟢`, badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-100/20 font-bold' };
    }
  };

  const upcomingFollowUpsRaw = tickets
    .filter(t => t.status !== 'Closed')
    .map(t => {
      const client = activeClients.find(c => c.id === t.clientId);
      const followUpDate = t.nextFollowUp || client?.nextFollowUp;
      const schedule = getRemainingDaysAndColor(followUpDate || '');
      return {
        ticket: t,
        client,
        followUpDate,
        ...schedule
      };
    })
    .filter(item => item.client && item.followUpDate && (item.days <= 7));

  const sortedFollowUps = [...upcomingFollowUpsRaw].sort((a, b) => {
    if (followUpSort === 'nearest') {
      return a.days - b.days;
    }
    if (followUpSort === 'name') {
      return (a.client?.name || '').localeCompare(b.client?.name || '');
    }
    if (followUpSort === 'priority') {
      const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const pA = priorityWeight[a.ticket.priority] || 0;
      const pB = priorityWeight[b.ticket.priority] || 0;
      return pB - pA;
    }
    return 0;
  });

  // 3. Recently Updated Clients
  const recentlyUpdatedClients = [...activeClients]
    .map(client => {
      const clientTickets = tickets.filter(t => t.clientId === client.id);
      const ticketIds = clientTickets.map(t => t.id);
      const clientConvs = conversations.filter(c => ticketIds.includes(c.ticketId));
      const latestConv = clientConvs.sort((a, b) => {
        const dateA = parseBDDate(a.dateTime) || new Date(a.dateTime);
        const dateB = parseBDDate(b.dateTime) || new Date(b.dateTime);
        return dateB.getTime() - dateA.getTime();
      })[0];

      return {
        client,
        lastConversation: latestConv ? latestConv.conversationNote : 'No conversation notes yet',
        ticketCount: clientTickets.length,
        updatedAt: client.updatedAt || client.createdAt
      };
    })
    .sort((a, b) => {
      const dateA = parseBDDate(a.updatedAt) || new Date(a.updatedAt);
      const dateB = parseBDDate(b.updatedAt) || new Date(b.updatedAt);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 10);

  // 4. Recently Added Clients
  const recentlyAddedClients = [...activeClients]
    .sort((a, b) => {
      const dateA = parseBDDate(a.createdAt) || new Date(a.createdAt);
      const dateB = parseBDDate(b.createdAt) || new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 10);

  // 5. Recent timeline
  const recentConversationsList = [...conversations]
    .sort((a, b) => {
      const dateA = parseBDDate(a.dateTime) || new Date(a.dateTime);
      const dateB = parseBDDate(b.dateTime) || new Date(b.dateTime);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 3);

  const archivedClientsCount = clients.filter(c => c.isArchived).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <StatsSkeleton />
        <div className="space-y-3">
          <div className="h-5 w-1/3 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Welcome Banner */}
      <div className="flex justify-between items-center bg-blue-600 dark:bg-blue-950/40 text-white dark:text-blue-200 p-4 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
        <div className="space-y-0.5">
          <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-90">Dhaka Standard Time Portal (BST)</p>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-1.5">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <span>CRM Dashboard</span>
          </h2>
        </div>
        <button 
          onClick={() => loadDashboardData(true)}
          disabled={refreshing}
          className="text-xs bg-white/20 dark:bg-slate-800/80 p-2 rounded-xl font-semibold active:scale-95 transition-all flex items-center gap-1.5 hover:bg-white/30 cursor-pointer"
          id="dashboard-refresh-button"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 1. Summary Cards (Stats Cards Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" id="stats-grid">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">Total Clients</span>
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {stats?.totalClients ?? 0}
            </h3>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1">In CRM records</p>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">Open Tickets</span>
            <div className="p-1.5 bg-sky-50 dark:bg-sky-950/40 rounded-xl text-sky-500">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {stats?.openTickets ?? 0}
            </h3>
            <p className="text-[10px] text-sky-600 dark:text-sky-400 font-bold mt-1">Requiring support</p>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">Pending Tickets</span>
            <div className="p-1.5 bg-orange-50 dark:bg-orange-950/40 rounded-xl text-orange-500">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {pendingTicketsCount}
            </h3>
            <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold mt-1">Awaiting info</p>
          </div>
        </div>

        <button
          onClick={() => navigateTo('followUps')}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between h-28 text-left hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700/80 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-start w-full">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">Today Follow Up</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-500">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {followUps.length}
            </h3>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-0.5">
              <span>Scheduled today</span>
              <ChevronRight className="w-3 h-3" />
            </p>
          </div>
        </button>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">Overdue Follow Ups</span>
            <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-500">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {stats?.overdueTickets ?? 0}
            </h3>
            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-1">Past action date</p>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between h-28 hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">Active (7d)</span>
            <div className="p-1.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-500">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {recentClientsCount}
            </h3>
            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-1">Added/Updated recently</p>
          </div>
        </div>

        <button
          onClick={() => navigateTo('archivedClients')}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between h-28 text-left hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700/80 transition-all cursor-pointer"
          id="dashboard-archived-clients-card"
        >
          <div className="flex justify-between items-start w-full">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">Archived Clients</span>
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500">
              <Archive className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {archivedClientsCount}
            </h3>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-1 flex items-center gap-0.5">
              <span>View Archived</span>
              <ChevronRight className="w-3 h-3" />
            </p>
          </div>
        </button>
      </div>

      {/* 2. 🔍 Quick Search Panel */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900 space-y-3 shadow-xs">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <SearchIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Quick Search Name, Phone, ID, Ticket..."
            className="w-full pl-10 pr-16 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 dark:text-white dark:placeholder-slate-500 text-xs font-bold transition-all"
            id="crm-quick-search-bar"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setDashboardSearchQuery(''); }}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-black cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search Filters Quick Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
          {["All", "Clients", "Tickets", "Today's Follow-ups", "Open Tickets", "Pinned Clients", "Recent Clients"].map((filter) => {
            const isActive = dashboardSearchFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setDashboardSearchFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap active:scale-95 transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850"
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            <span className="text-slate-400 font-bold uppercase tracking-wider shrink-0">Recent:</span>
            <div className="flex flex-wrap gap-1 items-center max-h-16 overflow-y-auto">
              {recentSearches.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setSearchInput(s)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350 px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
              <button
                onClick={clearSearchHistory}
                className="text-rose-500 hover:text-rose-600 font-black px-1.5 py-0.5 shrink-0 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Results Display Section */}
      {(searchInput.trim() || dashboardSearchFilter !== 'All') && (
        <div className="space-y-3.5 pt-1">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Search Results ({matchingClients.length})
            </h4>
          </div>

          {matchingClients.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-100 dark:border-slate-800 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                No matching client found.
              </p>
              <button
                onClick={() => {
                  const cleanQuery = searchInput.trim();
                  if (cleanQuery.replace(/[^0-9]/g, '').length >= 4) {
                    setSearchPrefilledPhone(cleanQuery);
                  }
                  navigateTo('addClient');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer mx-auto"
                style={{ minHeight: '44px' }}
              >
                <Plus className="w-4 h-4" />
                <span>Add New Client</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {matchingClients.map(c => {
                const totalTickets = tickets.filter(t => t.clientId === c.id).length;
                const latestConversation = getLatestConversationNote(c.id);
                const previewConv = latestConversation.length > 80 
                  ? latestConversation.substring(0, 80) + '...' 
                  : latestConversation;

                return (
                  <div
                    key={c.id}
                    onClick={() => navigateTo('clientDetail', { clientId: c.id })}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-xs hover:border-slate-200 dark:hover:border-slate-700 transition-all space-y-3 cursor-pointer active:scale-99"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-sm font-black text-slate-800 dark:text-white leading-tight">
                            <HighlightText text={c.name} highlight={searchInput} />
                          </h5>
                          <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
                            c.status === 'Customer'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : c.status === 'Interested'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                              : c.status === 'Lost'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            <HighlightText text={c.status} highlight={searchInput} />
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-extrabold font-mono">
                          Client ID: <HighlightText text={c.id} highlight={searchInput} />
                        </span>
                      </div>
                      
                      {c.isPinned && (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-1">
                      {c.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono">
                            <HighlightText text={formatBDPhoneForDisplay(c.phone)} highlight={searchInput} />
                          </span>
                        </div>
                      )}
                      {c.company && (
                        <div className="flex items-center gap-1 truncate">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            <HighlightText text={c.company} highlight={searchInput} />
                          </span>
                        </div>
                      )}
                      {c.district && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            <HighlightText text={c.district} highlight={searchInput} />
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{totalTickets} {totalTickets === 1 ? 'ticket' : 'tickets'}</span>
                      </div>
                      {c.nextFollowUp && (
                        <div className="flex items-center gap-1 col-span-2">
                          <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-mono text-slate-600 dark:text-slate-300">
                            Next Follow-up: {c.nextFollowUp}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-extrabold text-[9px] uppercase tracking-wider block text-slate-400 dark:text-slate-500 mb-0.5">Last Log Preview</span>
                      <p className="line-clamp-2 leading-relaxed">
                        <HighlightText text={previewConv} highlight={searchInput} />
                      </p>
                    </div>

                    <div 
                      className="flex gap-1.5 flex-wrap pt-2 border-t border-slate-50 dark:border-slate-850"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => navigateTo('clientDetail', { clientId: c.id })}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                        style={{ minHeight: '36px' }}
                      >
                        <span>👤 Open Client</span>
                      </button>
                      
                      {c.phone && (
                        <>
                          <button
                            onClick={() => handlePhoneCall(c.phone)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                            style={{ minHeight: '36px' }}
                          >
                            <span>📞 Call</span>
                          </button>
                          
                          <button
                            onClick={() => handleWhatsAppMessage(c.phone)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/45 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                            style={{ minHeight: '36px' }}
                          >
                            <span>💬 WhatsApp</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => navigateTo('clientDetail', { clientId: c.id })}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                        style={{ minHeight: '36px' }}
                      >
                        <span>➕ Add Ticket</span>
                      </button>

                      <button
                        onClick={() => handleAddConversationForClient(c.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                        style={{ minHeight: '36px' }}
                      >
                        <span>➕ Add Conversation</span>
                      </button>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(c.name);
                          toast.success('Client name copied!');
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                        style={{ minHeight: '36px' }}
                      >
                        <span>📋 Copy Name</span>
                      </button>

                      {c.phone && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.phone);
                            toast.success('Phone number copied!');
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                          style={{ minHeight: '36px' }}
                        >
                          <span>📱 Copy Phone</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. ⭐ Pinned Clients Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          <span>⭐ Pinned Clients ({pinnedClients.length})</span>
        </h3>

        {pinnedClients.length === 0 ? (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-100 dark:border-slate-800/80 text-center text-slate-400 text-xs">
            No pinned clients yet. Open any client's profile and tap the ⭐ star icon to pin them here for rapid access.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pinnedClients.map(client => (
              <div 
                key={client.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm hover:border-slate-200 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <LongPressable
                        onLongPress={() => { setLongPressClient(client); setLongPressType('name'); }}
                      >
                        <span className="text-[9px] font-extrabold text-blue-500 font-mono bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded leading-none cursor-pointer">
                          {client.id}
                        </span>
                      </LongPressable>
                      <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
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
                    
                    <LongPressable
                      onLongPress={() => { setLongPressClient(client); setLongPressType('name'); }}
                      onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                    >
                      <h4 className="text-sm font-black text-slate-800 dark:text-white hover:text-blue-500 cursor-pointer transition-colors">
                        {client.name}
                      </h4>
                    </LongPressable>

                    <p className="text-[11px] text-slate-450 font-medium">
                      {client.company || 'Individual client'}
                    </p>

                    <LongPressable
                      onLongPress={() => { setLongPressClient(client); setLongPressType('phone'); }}
                      onClick={() => handlePhoneCall(client.phone)}
                    >
                      <p className="text-[10px] text-slate-450 font-medium hover:text-blue-500">
                        Phone: <span className="font-mono">{formatBDPhoneForDisplay(client.phone)}</span>
                      </p>
                    </LongPressable>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePin(client.id, true)}
                      className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-500 hover:text-amber-600 cursor-pointer transition-colors"
                      title="Unpin Client"
                    >
                      <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                    </button>
                    <ClientQuickActions client={client} />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/40 flex items-center justify-between gap-2">
                  {client.district && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{client.district}</span>
                    </span>
                  )}
                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => handlePhoneCall(client.phone)}
                      className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                      title="Call client"
                      style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleWhatsAppMessage(client.phone)}
                      className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                      title="WhatsApp client"
                      style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                      style={{ minHeight: '44px' }}
                    >
                      Open Profile
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Upcoming Follow-up Widget */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
              <CalendarClock className="w-4.5 h-4.5 text-emerald-500" />
              <span>Upcoming Follow-ups (7 Days)</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">Action items requiring attention</p>
          </div>

          {/* Sorting Controls */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 p-1 rounded-xl self-start sm:self-auto">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase px-1.5">Sort:</span>
            <button
              onClick={() => setFollowUpSort('nearest')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                followUpSort === 'nearest'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Nearest
            </button>
            <button
              onClick={() => setFollowUpSort('name')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                followUpSort === 'name'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Client Name
            </button>
            <button
              onClick={() => setFollowUpSort('priority')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                followUpSort === 'priority'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Priority
            </button>
          </div>
        </div>

        {sortedFollowUps.length === 0 ? (
          <div className="p-8 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl text-center text-slate-400 text-xs">
            🟢 No upcoming follow-ups scheduled for the next 7 days. Excellent work!
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFollowUps.map(({ ticket, client: linkedClient, followUpDate, label, badgeClass }) => {
              if (!linkedClient) return null;
              const isRescheduling = reschedulingId === ticket.id;

              return (
                <div 
                  key={ticket.id}
                  className="p-4 bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/60 rounded-2xl hover:border-slate-200 dark:hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${badgeClass}`}>
                          {label}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
                          ticket.priority === 'High'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                            : ticket.priority === 'Medium'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-105 dark:bg-slate-800 text-slate-600'
                        }`}>
                          {ticket.priority} Priority
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 font-bold">Ticket: {ticket.id}</span>
                      </div>

                      <LongPressable
                        onLongPress={() => { setLongPressClient(linkedClient); setLongPressType('name'); }}
                        onClick={() => navigateTo('clientDetail', { clientId: linkedClient.id })}
                      >
                        <h4 className="text-sm font-black text-slate-800 dark:text-white hover:text-blue-500 cursor-pointer mt-1 transition-colors">
                          {linkedClient.name}
                        </h4>
                      </LongPressable>

                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-350">{ticket.title}</p>
                      
                      <LongPressable
                        onLongPress={() => { setLongPressClient(linkedClient); setLongPressType('phone'); }}
                        onClick={() => handlePhoneCall(linkedClient.phone)}
                      >
                        <p className="text-[10px] text-slate-400 font-medium hover:text-blue-500 cursor-pointer">
                          Phone: <span className="font-mono">{formatBDPhoneForDisplay(linkedClient.phone)}</span>
                        </p>
                      </LongPressable>

                      <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>Scheduled: <span className="font-bold font-mono text-slate-600 dark:text-slate-300">{followUpDate}</span></span>
                      </p>
                    </div>

                    <div className="flex gap-1 items-center shrink-0">
                      <button
                        onClick={() => handleMarkTicketComplete(ticket.id)}
                        className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Mark Complete"
                        style={{ minHeight: '44px' }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Complete</span>
                      </button>
                      <ClientQuickActions client={linkedClient} />
                    </div>
                  </div>

                  {/* Rescheduling Input Inline */}
                  {isRescheduling ? (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl space-y-2">
                      <span className="text-[10px] font-black text-slate-500 block uppercase">Reschedule Follow-up</span>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className="flex-1 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs rounded-xl dark:text-white"
                        />
                        <button
                          onClick={() => handleRescheduleSave(ticket.id, linkedClient.id, rescheduleDate)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setReschedulingId(null)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Quick Action Button Bar */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-850 flex flex-wrap gap-1.5 items-center justify-between">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handlePhoneCall(linkedClient.phone)}
                        className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-650 dark:text-slate-300 hover:bg-slate-50 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                        style={{ minHeight: '44px' }}
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Call</span>
                      </button>
                      <button
                        onClick={() => handleWhatsAppMessage(linkedClient.phone)}
                        className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-650 dark:text-slate-300 hover:bg-slate-50 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                        style={{ minHeight: '44px' }}
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                        <span>WhatsApp</span>
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => navigateTo('clientDetail', { clientId: linkedClient.id })}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                        style={{ minHeight: '44px' }}
                      >
                        Client
                      </button>
                      <button
                        onClick={() => navigateTo('ticketDetail', { ticketId: ticket.id })}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                        style={{ minHeight: '44px' }}
                      >
                        Ticket
                      </button>
                      <button
                        onClick={() => {
                          setReschedulingId(ticket.id);
                          setRescheduleDate(new Date().toISOString().split('T')[0]);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                        style={{ minHeight: '44px' }}
                      >
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        <span>Reschedule</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Recently Updated Clients Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-orange-500" />
          <span>Recently Updated Clients (Top 10)</span>
        </h3>

        <div className="space-y-2.5">
          {recentlyUpdatedClients.map(({ client, lastConversation, ticketCount, updatedAt }) => {
            const isNoteActive = quickNoteTicketId !== null && tickets.find(t => t.id === quickNoteTicketId)?.clientId === client.id;

            return (
              <div 
                key={client.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl shadow-sm flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <LongPressable
                        onLongPress={() => { setLongPressClient(client); setLongPressType('name'); }}
                        onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                      >
                        <h4 className="text-sm font-black text-slate-800 dark:text-white hover:text-blue-500 cursor-pointer transition-colors">
                          {client.name}
                        </h4>
                      </LongPressable>
                      <span className="text-[10px] font-extrabold text-slate-400 font-mono">({client.id})</span>
                      {client.isPinned && <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />}
                    </div>

                    <p className="text-[10px] text-slate-450 font-medium">
                      Last Updated: <span className="font-mono text-slate-650 dark:text-slate-300">{updatedAt}</span>
                    </p>

                    <LongPressable
                      onLongPress={() => { setLongPressClient(client); setLongPressType('phone'); }}
                      onClick={() => handlePhoneCall(client.phone)}
                    >
                      <p className="text-[10px] text-slate-450 font-medium hover:text-blue-500 cursor-pointer">
                        Phone: <span className="font-mono">{formatBDPhoneForDisplay(client.phone)}</span>
                      </p>
                    </LongPressable>

                    <p className="text-[10px] font-bold text-slate-500">
                      Active Tickets: <span className="text-blue-500 font-mono font-black bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">{ticketCount}</span>
                    </p>
                  </div>

                  <ClientQuickActions client={client} />
                </div>

                <div className="my-2.5 p-3 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-50 dark:border-slate-850 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-0.5">Last Conversation Note</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold line-clamp-2 italic leading-relaxed">
                    "{lastConversation}"
                  </p>
                </div>

                {/* Quick Add Note UI Inline */}
                {isNoteActive && quickNoteTicketId && (
                  <div className="mb-3 p-3 bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100/20 rounded-2xl space-y-2">
                    <span className="text-[10px] font-black text-blue-500 uppercase block">Quick Add Note (Ticket {quickNoteTicketId})</span>
                    <textarea
                      value={quickNoteText}
                      onChange={(e) => setQuickNoteText(e.target.value)}
                      placeholder="Type conversation note note..."
                      className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      rows={2}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleAddQuickNote(quickNoteTicketId)}
                        disabled={submittingQuickNote}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold cursor-pointer transition-all disabled:opacity-50"
                      >
                        {submittingQuickNote ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setQuickNoteTicketId(null)}
                        className="px-3 py-1.5 bg-slate-150 dark:bg-slate-850 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2.5 border-t border-slate-50 dark:border-slate-800/40 flex flex-wrap gap-1.5 items-center justify-between">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handlePhoneCall(client.phone)}
                      className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
                      title="Call client"
                      style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleWhatsAppMessage(client.phone)}
                      className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                      title="WhatsApp client"
                      style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                      style={{ minHeight: '44px' }}
                    >
                      Open Client
                    </button>
                    <button
                      onClick={() => handleAddConversationForClient(client.id)}
                      className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-450 rounded-xl text-[10px] font-extrabold cursor-pointer hover:bg-blue-100 transition-colors"
                      style={{ minHeight: '44px' }}
                    >
                      Add Conversation
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Recently Added Clients Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <UserPlus className="w-4.5 h-4.5 text-blue-500" />
          <span>Recently Added Clients (Top 10)</span>
        </h3>

        <div className="space-y-2.5">
          {recentlyAddedClients.map(client => {
            return (
              <div 
                key={client.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl shadow-sm flex flex-col justify-between"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <LongPressable
                        onLongPress={() => { setLongPressClient(client); setLongPressType('name'); }}
                        onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                      >
                        <h4 className="text-sm font-black text-slate-800 dark:text-white hover:text-blue-500 cursor-pointer transition-colors">
                          {client.name}
                        </h4>
                      </LongPressable>
                      <span className="text-[10px] font-extrabold text-slate-400 font-mono">({client.id})</span>
                      {client.isPinned && <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
                        client.status === 'Customer'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                          : client.status === 'Interested'
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                          : client.status === 'Lost'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                          : 'bg-slate-105 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {client.status}
                      </span>
                      {client.district && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-slate-500">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{client.district}</span>
                        </span>
                      )}
                    </div>
                    
                    <p className="text-[10px] text-slate-450 font-semibold pt-1">
                      Date Added: <span className="font-mono text-slate-600 dark:text-slate-300">{client.createdAt}</span>
                    </p>

                    <LongPressable
                      onLongPress={() => { setLongPressClient(client); setLongPressType('phone'); }}
                      onClick={() => handlePhoneCall(client.phone)}
                    >
                      <p className="text-[10px] text-slate-450 font-medium hover:text-blue-500 cursor-pointer">
                        Phone: <span className="font-mono">{formatBDPhoneForDisplay(client.phone)}</span>
                      </p>
                    </LongPressable>
                  </div>

                  <ClientQuickActions client={client} />
                </div>

                <div className="pt-2.5 mt-3 border-t border-slate-50 dark:border-slate-800/40 flex items-center justify-between gap-1.5">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handlePhoneCall(client.phone)}
                      className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
                      title="Call client"
                      style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleWhatsAppMessage(client.phone)}
                      className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                      title="WhatsApp client"
                      style={{ minHeight: '44px', minWidth: '44px' }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => navigateTo('clientDetail', { clientId: client.id })}
                    className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                    style={{ minHeight: '44px' }}
                  >
                    View Profile
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Recent Conversation Activity Timeline */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <span>Recent Activity Timeline</span>
        </h3>
        
        {recentConversationsList.length === 0 ? (
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-100 dark:border-slate-800 text-center space-y-1">
            <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">No conversations yet</h4>
            <p className="text-[10px] text-slate-400">Add logs in support ticket timelines to generate activities.</p>
          </div>
        ) : (
          <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
            {recentConversationsList.map((conv) => (
              <div 
                key={conv.id} 
                onClick={() => navigateTo('ticketDetail', { ticketId: conv.ticketId })}
                className="flex gap-3 pl-1.5 group cursor-pointer active:scale-99 transition-transform"
              >
                <div className="w-3.5 h-3.5 bg-blue-500 rounded-full border-4 border-white dark:border-slate-900 shadow-sm relative z-10 mt-1.5 group-hover:scale-110 transition-transform" />
                <div className="flex-1 p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm hover:border-slate-200 dark:hover:border-slate-700">
                  <div className="flex justify-between items-center mb-1 flex-wrap gap-y-1">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Ticket {conv.ticketId}
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold font-mono">
                      {conv.dateTime}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold line-clamp-2 leading-relaxed">
                    "{conv.conversationNote}"
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      by {conv.createdBy}
                    </span>
                    {conv.nextFollowUp && (
                      <span className="text-[9px] bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-slate-500 dark:text-slate-400 rounded font-semibold flex items-center gap-0.5 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        <span>F/U: {conv.nextFollowUp}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. Quick Actions (Buttons) */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => navigateTo('addClient')}
            className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all active:scale-95 cursor-pointer"
            id="quick-add-client-button"
          >
            <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 p-2 rounded-xl mb-1.5">
              <UserPlus className="w-4.5 h-4.5" />
            </div>
            <span className="text-[11px] font-bold tracking-tight">Add Client</span>
          </button>

          <button
            onClick={() => navigateTo('search')}
            className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all active:scale-95 cursor-pointer"
            id="quick-search-button"
          >
            <div className="bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 p-2 rounded-xl mb-1.5">
              <SearchIcon className="w-4.5 h-4.5" />
            </div>
            <span className="text-[11px] font-bold tracking-tight">Search CRM</span>
          </button>

          <button
            onClick={() => navigateTo('followUps')}
            className="flex flex-col items-center justify-center p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all active:scale-95 cursor-pointer"
            id="quick-followups-button"
          >
            <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl mb-1.5">
              <Clock className="w-4.5 h-4.5" />
            </div>
            <span className="text-[11px] font-bold tracking-tight">Follow Ups</span>
          </button>
        </div>
      </div>

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

export default Dashboard;
