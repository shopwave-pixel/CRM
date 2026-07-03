/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { offlineDb, SyncQueueItem, SyncLogItem } from '../services/offlineDb';
import { crmApi } from '../services/api';

export interface SyncStats {
  internetStatus: 'Online' | 'Offline';
  lastSyncTime: string; // YYYY-MM-DD HH:MM:SS or "Never"
  nextAutoSync: string; // duration or countdown text
  pendingQueueSize: number;
  failedQueueSize: number;
  successCount: number;
  failedCount: number;
  syncDuration: string; // e.g., "1.2s"
  averageSyncTime: string; // e.g., "0.8s"
}

interface OfflineContextType {
  isOffline: boolean;
  isSyncing: boolean;
  stats: SyncStats;
  queue: SyncQueueItem[];
  logs: SyncLogItem[];
  conflictItem: { queueItem: SyncQueueItem; local: any; server: any } | null;
  resolveConflict: (resolution: 'local' | 'server' | 'merge') => Promise<void>;
  triggerSync: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearQueue: () => Promise<void>;
  exportLogs: () => void;
  loadLogsAndQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [logs, setLogs] = useState<SyncLogItem[]>([]);
  const [conflictItem, setConflictItem] = useState<{ queueItem: SyncQueueItem; local: any; server: any } | null>(null);

  // Sync Stats State (Loaded from IndexedDB Cache or defaults)
  const [stats, setStats] = useState<SyncStats>({
    internetStatus: navigator.onLine ? 'Online' : 'Offline',
    lastSyncTime: 'Never',
    nextAutoSync: 'Active on reconnect',
    pendingQueueSize: 0,
    failedQueueSize: 0,
    successCount: 0,
    failedCount: 0,
    syncDuration: '0s',
    averageSyncTime: '0s'
  });

  const syncInProgressRef = useRef<boolean>(false);

  const loadLogsAndQueue = async () => {
    try {
      await offlineDb.init();
      const currentQueue = await offlineDb.getQueue();
      const currentLogs = await offlineDb.getSyncLogs();
      setQueue(currentQueue);
      setLogs(currentLogs);

      // Load persistent stats
      const cachedStats = await offlineDb.getCache<Partial<SyncStats>>('sync_stats');
      const pendingSize = currentQueue.filter(q => q.status === 'Pending').length;
      const failedSize = currentQueue.filter(q => q.status === 'Failed').length;

      setStats(prev => ({
        ...prev,
        ...cachedStats,
        internetStatus: navigator.onLine ? 'Online' : 'Offline',
        pendingQueueSize: pendingSize,
        failedQueueSize: failedSize
      }));
    } catch (e) {
      console.error('Failed to load sync assets', e);
    }
  };

  // Update stats in state and local cache
  const updateStats = async (updates: Partial<SyncStats>) => {
    setStats(prev => {
      const next = { ...prev, ...updates };
      offlineDb.setCache('sync_stats', {
        lastSyncTime: next.lastSyncTime,
        successCount: next.successCount,
        failedCount: next.failedCount,
        syncDuration: next.syncDuration,
        averageSyncTime: next.averageSyncTime
      }).catch(() => {});
      return next;
    });
  };

  // Listen to connectivity events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      updateStats({ internetStatus: 'Online' });
      toast.success('Internet Connected 🟢 Reconnecting system...');
      // Auto-trigger sync when returning online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOffline(true);
      updateStats({ internetStatus: 'Offline' });
      toast.error('Internet Disconnected 🔴 Offline Mode Enabled.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadLogsAndQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Synchronize a single action item
  const syncItem = async (item: SyncQueueItem): Promise<{ success: boolean; conflict?: boolean; serverRecord?: any; error?: string }> => {
    const startTime = Date.now();
    try {
      switch (item.action) {
        case 'addClient': {
          // If the client ID is temp, omit it so the server generates a fresh sequential ID,
          // or pass it along so server registers it
          const payload = { ...item.payload };
          const isTempId = payload.id && payload.id.includes('TEMP');
          if (isTempId) {
            delete payload.id;
          }
          const res = await crmApi.addClient(payload);
          
          if (res.success && res.client) {
            // Remap any references of TEMP ID in other entities (Tickets, Conversations)
            if (isTempId && item.payload.id) {
              await remapTempIdInLocalDb(item.payload.id, res.client.id);
            }
            // Update local DB with final server record
            await offlineDb.save('clients', res.client);
            return { success: true };
          }
          return { success: false, error: 'Add client returned failed response' };
        }

        case 'updateClient': {
          // Conflict Detection check: fetch server record to verify update collision
          const clients = await crmApi.getClients().catch(() => []);
          const serverClient = clients.find(c => c.id === item.payload.id);
          
          if (serverClient) {
            const localTime = new Date(item.payload.updatedAt || 0).getTime();
            const serverTime = new Date(serverClient.updatedAt || 0).getTime();
            
            // If the server record is newer and has substantial differences, trigger conflict!
            if (serverTime > localTime && serverClient.status !== item.payload.status) {
              return { success: false, conflict: true, serverRecord: serverClient };
            }
          }

          const res = await crmApi.updateClient(item.payload);
          if (res.success) {
            // Reload clients to refresh local cache
            return { success: true };
          }
          return { success: false, error: 'Update client failed' };
        }

        case 'deleteClient': {
          const res = await crmApi.deleteClient(item.payload.id);
          if (res.success) {
            await offlineDb.delete('clients', item.payload.id);
            return { success: true };
          }
          return { success: false, error: 'Delete client failed' };
        }

        case 'addTicket': {
          const payload = { ...item.payload };
          const isTempClientId = payload.clientId && payload.clientId.includes('TEMP');
          const isTempId = payload.id && payload.id.includes('TEMP');
          if (isTempId) {
            delete payload.id;
          }

          const res = await crmApi.addTicket(payload);
          if (res.success && res.ticket) {
            if (isTempId && item.payload.id) {
              await remapTempIdInLocalDb(item.payload.id, res.ticket.id);
            }
            await offlineDb.save('tickets', res.ticket);
            return { success: true };
          }
          return { success: false, error: 'Add ticket failed' };
        }

        case 'updateTicket': {
          const res = await crmApi.updateTicket(item.payload);
          if (res.success) return { success: true };
          return { success: false, error: 'Update ticket failed' };
        }

        case 'addConversation': {
          const payload = { ...item.payload };
          const isTempId = payload.id && payload.id.includes('TEMP');
          if (isTempId) {
            delete payload.id;
          }

          const res = await crmApi.addConversation(payload);
          if (res.success && res.conversation) {
            await offlineDb.save('conversations', res.conversation);
            if (isTempId && item.payload.id) {
              await offlineDb.delete('conversations', item.payload.id);
            }
            return { success: true };
          }
          return { success: false, error: 'Add conversation failed' };
        }

        case 'updateUser': {
          const res = await crmApi.addUser(item.payload);
          if (res.success) return { success: true };
          return { success: false, error: 'Update user profile failed' };
        }

        default:
          return { success: false, error: `Unknown action: ${item.action}` };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Network request failed' };
    }
  };

  // Helper to remap IDs for nested relationships when created offline
  const remapTempIdInLocalDb = async (tempId: string, finalId: string) => {
    // Remap tickets
    const tickets = await offlineDb.getAll<any>('tickets');
    for (const ticket of tickets) {
      let changed = false;
      if (ticket.clientId === tempId) {
        ticket.clientId = finalId;
        changed = true;
      }
      if (ticket.id === tempId) {
        await offlineDb.delete('tickets', tempId);
        ticket.id = finalId;
        changed = true;
      }
      if (changed) {
        await offlineDb.save('tickets', ticket);
      }
    }

    // Remap conversations
    const conversations = await offlineDb.getAll<any>('conversations');
    for (const conv of conversations) {
      let changed = false;
      if (conv.ticketId === tempId) {
        conv.ticketId = finalId;
        changed = true;
      }
      if (conv.id === tempId) {
        await offlineDb.delete('conversations', tempId);
        conv.id = finalId;
        changed = true;
      }
      if (changed) {
        await offlineDb.save('conversations', conv);
      }
    }
  };

  // Process the queue chronologically
  const triggerSync = async () => {
    if (isOffline) {
      toast.error('Working offline. Cannot sync until connected.');
      return;
    }
    if (syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    setIsSyncing(true);
    
    const toastId = toast.loading('🔄 Syncing offline changes...');
    const startTime = Date.now();
    let currentQueue = await offlineDb.getQueue();
    let localSuccessCount = stats.successCount;
    let localFailedCount = stats.failedCount;
    let totalDuration = 0;

    // Filter to only items needing processing
    const itemsToProcess = currentQueue.filter(item => item.status === 'Pending' || item.status === 'Failed');

    if (itemsToProcess.length === 0) {
      setIsSyncing(false);
      syncInProgressRef.current = false;
      toast.dismiss(toastId);
      // Still refresh local lists from server
      await refreshLocalDataCaches();
      return;
    }

    let allSuccessful = true;

    for (const item of itemsToProcess) {
      item.status = 'Processing';
      await offlineDb.updateQueueItem(item);
      
      const itemStartTime = Date.now();
      const res = await syncItem(item);
      const itemDuration = Date.now() - itemStartTime;
      totalDuration += itemDuration;

      if (res.success) {
        localSuccessCount++;
        // Delete from queue
        await offlineDb.delete('sync_queue', item.id);
        
        // Log to IndexedDB Sync Logs
        await offlineDb.addSyncLog(
          item.action,
          item.payload.name || item.payload.title || item.payload.id || 'N/A',
          'Success',
          itemDuration,
          'Synced successfully'
        );
      } else if (res.conflict) {
        // Halt sync and raise conflict modal
        setConflictItem({
          queueItem: item,
          local: item.payload,
          server: res.serverRecord
        });
        allSuccessful = false;
        break; // break the queue processing until resolved
      } else {
        localFailedCount++;
        allSuccessful = false;
        item.status = 'Failed';
        item.attempts = (item.attempts || 0) + 1;
        item.error = res.error || 'Unknown error';
        await offlineDb.updateQueueItem(item);

        await offlineDb.addSyncLog(
          item.action,
          item.payload.name || item.payload.title || item.payload.id || 'N/A',
          'Failed',
          itemDuration,
          res.error || 'API failed'
        );
      }
    }

    const durationSecs = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    
    // Refresh stats
    const nowStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString();
    
    await updateStats({
      lastSyncTime: nowStr,
      successCount: localSuccessCount,
      failedCount: localFailedCount,
      syncDuration: durationSecs,
      averageSyncTime: itemsToProcess.length > 0 ? ((totalDuration / itemsToProcess.length) / 1000).toFixed(2) + 's' : '0s'
    });

    await loadLogsAndQueue();
    setIsSyncing(false);
    syncInProgressRef.current = false;
    toast.dismiss(toastId);

    if (allSuccessful) {
      toast.success('✅ All pending changes synchronized successfully!');
      // Refresh local cache with latest pristine server data
      await refreshLocalDataCaches();
    } else if (!conflictItem) {
      toast.error('⚠ Some changes failed to sync. Review Sync Monitor in Developer Panel.');
    }
  };

  // Resolve conflict
  const resolveConflict = async (resolution: 'local' | 'server' | 'merge') => {
    if (!conflictItem) return;
    const { queueItem, local, server } = conflictItem;
    
    toast.loading('Resolving conflict...', { id: 'conflict_res' });

    try {
      if (resolution === 'local') {
        // Override server with local: update action in queue to bypass conflict check and force update
        queueItem.status = 'Pending';
        // Give it a slightly updated payload if needed, and let it sync on next turn
        await offlineDb.updateQueueItem(queueItem);
        toast.success('Conflict resolved: Keeping local version. Retrying sync...', { id: 'conflict_res' });
      } else if (resolution === 'server') {
        // Discard local change, accept server version
        await offlineDb.delete('sync_queue', queueItem.id);
        if (queueItem.action === 'updateClient') {
          await offlineDb.save('clients', server);
        }
        toast.success('Conflict resolved: Keeping server version.', { id: 'conflict_res' });
      } else {
        // Merge changes
        const merged = { ...server, ...local, updatedAt: new Date().toISOString() };
        queueItem.status = 'Pending';
        queueItem.payload = merged;
        await offlineDb.updateQueueItem(queueItem);
        toast.success('Conflict resolved: Merged versions. Retrying sync...', { id: 'conflict_res' });
      }

      setConflictItem(null);
      // Wait a moment then trigger sync to process the updated item
      setTimeout(() => {
        triggerSync();
      }, 800);
    } catch (e: any) {
      toast.error('Failed to resolve conflict: ' + e.message, { id: 'conflict_res' });
    }
  };

  // Refresh local data cache from server
  const refreshLocalDataCaches = async () => {
    try {
      const clients = await crmApi.getClients();
      await offlineDb.saveAll('clients', clients);

      const tickets = await crmApi.getTickets();
      await offlineDb.saveAll('tickets', tickets);

      const conversations = await crmApi.getConversations();
      await offlineDb.saveAll('conversations', conversations);
    } catch (e) {
      console.warn('Silent local cache refresh skipped (offline or server error)', e);
    }
  };

  // Owner Commands
  const retryFailed = async () => {
    const currentQueue = await offlineDb.getQueue();
    for (const item of currentQueue) {
      if (item.status === 'Failed') {
        item.status = 'Pending';
        await offlineDb.updateQueueItem(item);
      }
    }
    toast.success('Retrying all failed sync queue items.');
    triggerSync();
  };

  const clearQueue = async () => {
    await offlineDb.clearStore('sync_queue');
    toast.success('Sync queue cleared.');
    loadLogsAndQueue();
  };

  const exportLogs = () => {
    try {
      const logsText = logs.map(l => `[${l.date} ${l.time}] ACTION: ${l.action} | CLIENT: ${l.client} | STATUS: ${l.status} | DURATION: ${l.duration}ms | RESULT: ${l.result}`).join('\n');
      const blob = new Blob([logsText || 'No sync logs recorded.'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-sync-monitor-logs-${new Date().toISOString().split('T')[0]}.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Offline Sync logs exported successfully!');
    } catch (err: any) {
      toast.error('Failed to export sync logs: ' + err.message);
    }
  };

  return (
    <OfflineContext.Provider value={{
      isOffline,
      isSyncing,
      stats,
      queue,
      logs,
      conflictItem,
      resolveConflict,
      triggerSync,
      retryFailed,
      clearQueue,
      exportLogs,
      loadLogsAndQueue
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
