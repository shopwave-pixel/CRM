/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, Ticket, Conversation, UserProfile, CRMStats } from '../types';
import { offlineDb } from './offlineDb';

// Get local Apps Script URL if configured by user in UI
export const getStoredAppsScriptUrl = (): string => {
  return localStorage.getItem('GOOGLE_APPS_SCRIPT_URL') || '';
};

export const setStoredAppsScriptUrl = (url: string) => {
  if (url) {
    localStorage.setItem('GOOGLE_APPS_SCRIPT_URL', url.trim());
  } else {
    localStorage.removeItem('GOOGLE_APPS_SCRIPT_URL');
  }
};

// Helper to determine if we are offline
const isOfflineMode = (): boolean => {
  return !navigator.onLine;
};

// Helper for making API calls with the configured Apps Script URL header
async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const gasUrl = getStoredAppsScriptUrl();
  const headers = new Headers(options.headers || {});
  
  headers.set('Content-Type', 'application/json');
  if (gasUrl) {
    headers.set('x-apps-script-url', gasUrl);
  }

  const token = localStorage.getItem('CRM_SESSION_TOKEN');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(path, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errMsg = `Request failed with status ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    return response.json() as Promise<T>;
  } catch (err: any) {
    console.error(`API request to ${path} failed:`, err);
    // If it's already an Error with a custom user-friendly message, rethrow it
    if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('NetworkError') && !err.message.includes('network')) {
      throw err;
    }
    throw new Error('Network connectivity error. Please check your internet connection.');
  }
}

export const crmApi = {
  // Check authorization
  checkUser: async (): Promise<{ authorized: boolean; user?: UserProfile; message?: string }> => {
    if (isOfflineMode()) {
      const token = localStorage.getItem('CRM_SESSION_TOKEN');
      const cachedProfile = await offlineDb.getCache<UserProfile>('cached_profile');
      if (token && cachedProfile) {
        return { authorized: true, user: cachedProfile };
      }
      return { authorized: false, message: 'This feature requires an internet connection for initial authorization.' };
    }

    try {
      const res = await apiRequest<{ authorized: boolean; user?: UserProfile; message?: string }>('/api/check-user', {
        method: 'POST'
      });
      if (res.authorized && res.user) {
        await offlineDb.setCache('cached_profile', res.user);
      }
      return res;
    } catch (err: any) {
      // Fallback offline authorization if network error occurs unexpectedly
      const token = localStorage.getItem('CRM_SESSION_TOKEN');
      const cachedProfile = await offlineDb.getCache<UserProfile>('cached_profile');
      if (token && cachedProfile) {
        return { authorized: true, user: cachedProfile };
      }
      throw err;
    }
  },

  // Get CRM Dashboard stats
  getStats: async (): Promise<CRMStats> => {
    const fallbackStats = async (): Promise<CRMStats> => {
      const cachedStats = await offlineDb.getCache<CRMStats>('cached_dashboard_stats');
      if (cachedStats) return cachedStats;

      const clients = await offlineDb.getAll<Client>('clients');
      const tickets = await offlineDb.getAll<Ticket>('tickets');
      
      const activeClients = clients.filter(c => !c.isArchived);
      const openTkts = tickets.filter(t => t.status !== 'Closed');
      const closedTkts = tickets.filter(t => t.status === 'Closed');
      
      const todayStr = new Date().toISOString().split('T')[0];
      const todayFollows = activeClients.filter(c => c.nextFollowUp === todayStr).length;
      const overdue = openTkts.filter(t => t.nextFollowUp && t.nextFollowUp < todayStr).length;

      return {
        totalClients: activeClients.length,
        openTickets: openTkts.length,
        todayFollowUps: todayFollows,
        overdueTickets: overdue,
        closedTickets: closedTkts.length
      };
    };

    if (isOfflineMode()) {
      return fallbackStats();
    }

    try {
      const stats = await apiRequest<CRMStats>('/api/stats');
      await offlineDb.setCache('cached_dashboard_stats', stats);
      return stats;
    } catch (err) {
      console.warn('Failed to fetch real-time dashboard stats, falling back to local DB', err);
      return fallbackStats();
    }
  },

  // Clients
  getClients: async (): Promise<Client[]> => {
    if (isOfflineMode()) {
      return offlineDb.getAll<Client>('clients');
    }

    try {
      const clients = await apiRequest<Client[]>('/api/clients');
      const mapped = clients.map((c: any) => ({
        id: c.clientId || c.id,
        name: c.name || '',
        phone: c.phone || '',
        company: c.company || '',
        status: c.status || 'New',
        totalTickets: Number(c.totalTickets || 0),
        nextFollowUp: c.nextFollowUp || '',
        lastContact: c.lastContact || '',
        createdAt: c.createdAt || '',
        updatedAt: c.updatedAt || '',
        district: c.district || '',
        isPinned: c.isPinned === true || String(c.isPinned).toUpperCase() === 'TRUE' || c.isPinned === 'TRUE',
        isArchived: c.isArchived === true || String(c.isArchived).toUpperCase() === 'TRUE' || c.isArchived === 'TRUE',
        followUpHistory: c.followUpHistory || ''
      }));

      // Cache locally
      await offlineDb.saveAll('clients', mapped);
      return mapped;
    } catch (err) {
      // Return cached fallback
      return offlineDb.getAll<Client>('clients');
    }
  },

  addClient: async (client: { name: string; phone: string; company: string; status: string; nextFollowUp?: string; district?: string; isPinned?: boolean; isArchived?: boolean }): Promise<{ success: boolean; client: Client }> => {
    const runOffline = async (): Promise<{ success: boolean; client: Client }> => {
      const tempId = 'CLI-TEMP-' + Date.now();
      const newClient: Client = {
        id: tempId,
        name: client.name,
        phone: client.phone,
        company: client.company,
        status: client.status as any,
        totalTickets: 0,
        nextFollowUp: client.nextFollowUp || '',
        lastContact: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        district: client.district || '',
        isPinned: !!client.isPinned,
        isArchived: !!client.isArchived,
        followUpHistory: ''
      };

      await offlineDb.save('clients', newClient);
      await offlineDb.addToQueue('addClient', newClient);
      return { success: true, client: newClient };
    };

    if (isOfflineMode()) {
      return runOffline();
    }

    try {
      const res = await apiRequest<{ success: boolean; client: any }>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(client)
      });

      const mappedClient: Client = {
        id: res.client.clientId || res.client.id,
        name: res.client.name,
        phone: res.client.phone,
        company: res.client.company,
        status: res.client.status,
        totalTickets: Number(res.client.totalTickets || 0),
        nextFollowUp: res.client.nextFollowUp || '',
        lastContact: res.client.lastContact || '',
        createdAt: res.client.createdAt,
        updatedAt: res.client.updatedAt,
        district: res.client.district || '',
        isPinned: res.client.isPinned === true || String(res.client.isPinned).toUpperCase() === 'TRUE' || res.client.isPinned === 'TRUE',
        isArchived: res.client.isArchived === true || String(res.client.isArchived).toUpperCase() === 'TRUE' || res.client.isArchived === 'TRUE',
        followUpHistory: res.client.followUpHistory || ''
      };

      await offlineDb.save('clients', mappedClient);
      return { success: res.success, client: mappedClient };
    } catch (err) {
      console.warn('addClient online request failed, falling back to offline enqueue:', err);
      return runOffline();
    }
  },

  updateClient: async (client: { id: string; name?: string; phone?: string; company?: string; status?: string; nextFollowUp?: string; district?: string; isPinned?: boolean; isArchived?: boolean; followUpHistory?: string; lastContact?: string }): Promise<{ success: boolean }> => {
    const runOffline = async (): Promise<{ success: boolean }> => {
      const existing = await offlineDb.get<Client>('clients', client.id);
      if (existing) {
        const updated = { ...existing, ...client, updatedAt: new Date().toISOString() } as Client;
        await offlineDb.save('clients', updated);
      }
      await offlineDb.addToQueue('updateClient', client);
      return { success: true };
    };

    if (isOfflineMode()) {
      return runOffline();
    }

    try {
      const res = await apiRequest<{ success: boolean }>('/api/clients/update', {
        method: 'POST',
        body: JSON.stringify(client)
      });

      if (res.success) {
        const existing = await offlineDb.get<Client>('clients', client.id);
        if (existing) {
          await offlineDb.save('clients', { ...existing, ...client, updatedAt: new Date().toISOString() } as Client);
        }
      }
      return res;
    } catch (err) {
      console.warn('updateClient online request failed, falling back to offline enqueue:', err);
      return runOffline();
    }
  },

  deleteClient: async (id: string): Promise<{ success: boolean }> => {
    const runOffline = async (): Promise<{ success: boolean }> => {
      await offlineDb.delete('clients', id);
      await offlineDb.addToQueue('deleteClient', { id });
      return { success: true };
    };

    if (isOfflineMode()) {
      return runOffline();
    }

    try {
      const res = await apiRequest<{ success: boolean }>('/api/clients/delete', {
        method: 'POST',
        body: JSON.stringify({ id })
      });

      if (res.success) {
        await offlineDb.delete('clients', id);
      }
      return res;
    } catch (err) {
      console.warn('deleteClient online request failed, falling back to offline enqueue:', err);
      return runOffline();
    }
  },

  // Tickets
  getTickets: async (): Promise<Ticket[]> => {
    if (isOfflineMode()) {
      return offlineDb.getAll<Ticket>('tickets');
    }

    try {
      const tickets = await apiRequest<Ticket[]>('/api/tickets');
      const mapped = tickets.map((t: any) => ({
        id: t.ticketId || t.id,
        clientId: t.clientId,
        title: t.title || '',
        description: t.description || '',
        priority: t.priority || 'Medium',
        status: t.status || 'Open',
        createdDate: t.createdDate || t.createdAt || '',
        lastUpdated: t.lastUpdated || t.updatedAt || '',
        nextFollowUp: t.nextFollowUp || '',
        totalConversations: Number(t.totalConversations || 0)
      }));

      await offlineDb.saveAll('tickets', mapped);
      return mapped;
    } catch (err) {
      return offlineDb.getAll<Ticket>('tickets');
    }
  },

  addTicket: async (ticket: { clientId: string; title: string; description: string; priority: string; status: string; nextFollowUp?: string }): Promise<{ success: boolean; ticket: Ticket }> => {
    const runOffline = async (): Promise<{ success: boolean; ticket: Ticket }> => {
      const tempId = 'TKT-TEMP-' + Date.now();
      const newTicket: Ticket = {
        id: tempId,
        clientId: ticket.clientId,
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority as any,
        status: ticket.status as any,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        nextFollowUp: ticket.nextFollowUp || '',
        totalConversations: 0
      };

      await offlineDb.save('tickets', newTicket);
      await offlineDb.addToQueue('addTicket', newTicket);
      return { success: true, ticket: newTicket };
    };

    if (isOfflineMode()) {
      return runOffline();
    }

    try {
      const res = await apiRequest<{ success: boolean; ticket: any }>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(ticket)
      });

      const mappedTicket: Ticket = {
        id: res.ticket.ticketId || res.ticket.id,
        clientId: res.ticket.clientId,
        title: res.ticket.title,
        description: res.ticket.description,
        priority: res.ticket.priority,
        status: res.ticket.status,
        createdDate: res.ticket.createdDate,
        lastUpdated: res.ticket.lastUpdated,
        nextFollowUp: res.ticket.nextFollowUp || '',
        totalConversations: Number(res.ticket.totalConversations || 0)
      };

      await offlineDb.save('tickets', mappedTicket);
      return { success: res.success, ticket: mappedTicket };
    } catch (err) {
      console.warn('addTicket online request failed, falling back to offline enqueue:', err);
      return runOffline();
    }
  },

  updateTicket: async (ticket: { id: string; title?: string; description?: string; priority?: string; status?: string; nextFollowUp?: string }): Promise<{ success: boolean }> => {
    const runOffline = async (): Promise<{ success: boolean }> => {
      const existing = await offlineDb.get<Ticket>('tickets', ticket.id);
      if (existing) {
        const updated = { ...existing, ...ticket, lastUpdated: new Date().toISOString() } as Ticket;
        await offlineDb.save('tickets', updated);
      }
      await offlineDb.addToQueue('updateTicket', ticket);
      return { success: true };
    };

    if (isOfflineMode()) {
      return runOffline();
    }

    try {
      const res = await apiRequest<{ success: boolean }>('/api/tickets/update', {
        method: 'POST',
        body: JSON.stringify(ticket)
      });

      if (res.success) {
        const existing = await offlineDb.get<Ticket>('tickets', ticket.id);
        if (existing) {
          await offlineDb.save('tickets', { ...existing, ...ticket, lastUpdated: new Date().toISOString() } as Ticket);
        }
      }
      return res;
    } catch (err) {
      console.warn('updateTicket online request failed, falling back to offline enqueue:', err);
      return runOffline();
    }
  },

  // Conversations
  getConversations: async (): Promise<Conversation[]> => {
    if (isOfflineMode()) {
      return offlineDb.getAll<Conversation>('conversations');
    }

    try {
      const conversations = await apiRequest<Conversation[]>('/api/conversations');
      const mapped = conversations.map((c: any) => ({
        id: c.conversationId || c.id,
        ticketId: c.ticketId,
        dateTime: c.dateTime || c.createdAt || '',
        conversationNote: c.conversationNote || '',
        nextFollowUp: c.nextFollowUp || '',
        createdBy: c.createdBy || '',
        userEmail: c.userEmail || ''
      }));

      await offlineDb.saveAll('conversations', mapped);
      return mapped;
    } catch (err) {
      return offlineDb.getAll<Conversation>('conversations');
    }
  },

  addConversation: async (conv: { ticketId: string; conversationNote: string; nextFollowUp: string; createdBy: string; userEmail: string }): Promise<{ success: boolean; conversation: Conversation }> => {
    const runOffline = async (): Promise<{ success: boolean; conversation: Conversation }> => {
      const tempId = 'CONV-TEMP-' + Date.now();
      const newConv: Conversation = {
        id: tempId,
        ticketId: conv.ticketId,
        dateTime: new Date().toISOString().replace('T', ' ').substr(0, 19),
        conversationNote: conv.conversationNote,
        nextFollowUp: conv.nextFollowUp,
        createdBy: conv.createdBy,
        userEmail: conv.userEmail
      };

      await offlineDb.save('conversations', newConv);
      await offlineDb.addToQueue('addConversation', newConv);
      return { success: true, conversation: newConv };
    };

    if (isOfflineMode()) {
      return runOffline();
    }

    try {
      const res = await apiRequest<{ success: boolean; conversation: any }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify(conv)
      });

      const mappedConv: Conversation = {
        id: res.conversation.conversationId || res.conversation.id,
        ticketId: res.conversation.ticketId,
        dateTime: res.conversation.dateTime,
        conversationNote: res.conversation.conversationNote,
        nextFollowUp: res.conversation.nextFollowUp,
        createdBy: res.conversation.createdBy,
        userEmail: res.conversation.userEmail
      };

      await offlineDb.save('conversations', mappedConv);
      return { success: res.success, conversation: mappedConv };
    } catch (err) {
      console.warn('addConversation online request failed, falling back to offline enqueue:', err);
      return runOffline();
    }
  },

  // Users
  getUsers: async (): Promise<UserProfile[]> => {
    if (isOfflineMode()) {
      throw new Error('This feature requires an internet connection.');
    }
    return apiRequest<UserProfile[]>('/api/users');
  },

  addUser: async (user: Partial<UserProfile>): Promise<{ success: boolean; added?: boolean; updated?: boolean }> => {
    if (isOfflineMode()) {
      throw new Error('This feature requires an internet connection.');
    }
    return apiRequest<{ success: boolean; added?: boolean; updated?: boolean }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(user)
    });
  },

  deleteUser: async (loginId: string): Promise<{ success: boolean }> => {
    if (isOfflineMode()) {
      throw new Error('This feature requires an internet connection.');
    }
    return apiRequest<{ success: boolean }>('/api/users/delete', {
      method: 'POST',
      body: JSON.stringify({ loginId })
    });
  },

  // Activity Logs
  getActivityLogs: async (): Promise<any[]> => {
    if (isOfflineMode()) {
      return [];
    }
    return apiRequest<any[]>('/api/activity-logs');
  },

  // Backup & Restore
  backupDatabase: async (): Promise<any> => {
    if (isOfflineMode()) {
      throw new Error('This feature requires an internet connection.');
    }
    return apiRequest<any>('/api/backup');
  },

  restoreDatabase: async (data: any): Promise<{ success: boolean; message: string }> => {
    if (isOfflineMode()) {
      throw new Error('This feature requires an internet connection.');
    }
    return apiRequest<{ success: boolean; message: string }>('/api/restore', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Extended System Status
  getExtendedSystemStatus: async (): Promise<any> => {
    if (isOfflineMode()) {
      return {
        sheetsConnected: false,
        appsScriptConnected: false,
        dbSize: 'Unknown',
        latency: 'Offline'
      };
    }
    try {
      return await apiRequest<any>('/api/system/extended-status');
    } catch (err) {
      console.warn('Failed to fetch extended system status:', err);
      return {
        sheetsConnected: false,
        appsScriptConnected: false,
        dbSize: 'Unknown',
        latency: 'Offline/Error'
      };
    }
  }
};
