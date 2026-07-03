/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { encryption } from './encryption';

const DB_NAME = 'enterprise_crm_offline_db';
const DB_VERSION = 1;

export interface SyncQueueItem {
  id: string; // unique item id
  timestamp: string; // ISO date
  action: 'addClient' | 'updateClient' | 'deleteClient' | 'addTicket' | 'updateTicket' | 'addConversation' | 'updateUser';
  payload: any; // encrypted payload
  status: 'Pending' | 'Failed' | 'Processing';
  error?: string;
  attempts: number;
}

export interface SyncLogItem {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  action: string;
  client: string;
  status: 'Success' | 'Failed';
  duration: number; // in ms
  result: string;
}

class OfflineDb {
  private db: IDBDatabase | null = null;
  private useMemoryFallback = false;
  private memoryDb: Record<string, Map<string, any>> = {
    clients: new Map(),
    tickets: new Map(),
    conversations: new Map(),
    sync_queue: new Map(),
    cache: new Map(),
    sync_logs: new Map(),
  };

  private getLocalStorageKey(storeName: string, id: string): string {
    return `mem_db_${storeName}_${id}`;
  }

  private tryLoadFromLocalStorage() {
    try {
      const keys = ['clients', 'tickets', 'conversations', 'sync_queue', 'cache', 'sync_logs'];
      for (const storeName of keys) {
        const storedKeysStr = localStorage.getItem(`mem_db_keys_${storeName}`);
        if (storedKeysStr) {
          const storedKeys = JSON.parse(storedKeysStr);
          for (const id of storedKeys) {
            const val = localStorage.getItem(this.getLocalStorageKey(storeName, id));
            if (val) {
              if (storeName === 'sync_logs') {
                try {
                  this.memoryDb[storeName].set(id, JSON.parse(val));
                } catch {
                  this.memoryDb[storeName].set(id, { id, payload: val });
                }
              } else {
                this.memoryDb[storeName].set(id, { id, payload: val, key: id });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage access is blocked or unavailable:', e);
    }
  }

  private trySaveToLocalStorage(storeName: string, id: string, val: string) {
    try {
      localStorage.setItem(this.getLocalStorageKey(storeName, id), val);
      const keys = Array.from(this.memoryDb[storeName].keys());
      localStorage.setItem(`mem_db_keys_${storeName}`, JSON.stringify(keys));
    } catch (e) {
      // Ignored
    }
  }

  private tryDeleteFromLocalStorage(storeName: string, id: string) {
    try {
      localStorage.removeItem(this.getLocalStorageKey(storeName, id));
      const keys = Array.from(this.memoryDb[storeName].keys());
      localStorage.setItem(`mem_db_keys_${storeName}`, JSON.stringify(keys));
    } catch (e) {
      // Ignored
    }
  }

  private tryClearLocalStorage(storeName: string) {
    try {
      const storedKeysStr = localStorage.getItem(`mem_db_keys_${storeName}`);
      if (storedKeysStr) {
        const storedKeys = JSON.parse(storedKeysStr);
        for (const id of storedKeys) {
          localStorage.removeItem(this.getLocalStorageKey(storeName, id));
        }
      }
      localStorage.removeItem(`mem_db_keys_${storeName}`);
    } catch (e) {
      // Ignored
    }
  }

  init(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db || this.useMemoryFallback) return resolve();

      try {
        if (typeof window === 'undefined' || !window.indexedDB) {
          console.warn('indexedDB is not supported. Falling back to in-memory database.');
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          return resolve();
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          
          // Create object stores
          if (!db.objectStoreNames.contains('clients')) {
            db.createObjectStore('clients', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('tickets')) {
            db.createObjectStore('tickets', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('conversations')) {
            db.createObjectStore('conversations', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('sync_queue')) {
            db.createObjectStore('sync_queue', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('cache')) {
            db.createObjectStore('cache', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('sync_logs')) {
            db.createObjectStore('sync_logs', { keyPath: 'id' });
          }
        };

        request.onsuccess = (event: any) => {
          this.db = event.target.result;
          resolve();
        };

        request.onerror = (event: any) => {
          console.warn('Failed to open IndexedDB. Falling back to in-memory database:', event.target.error?.message);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          resolve();
        };
      } catch (e: any) {
        console.warn('Error opening IndexedDB. Falling back to in-memory database:', e?.message || e);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        resolve();
      }
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Generic Operations with Encryption
  async save<T extends { id: string }>(storeName: string, data: T): Promise<void> {
    await this.init();
    if (this.useMemoryFallback) {
      const encryptedPayload = encryption.encryptObject(data);
      this.memoryDb[storeName].set(data.id, { id: data.id, payload: encryptedPayload, updatedAt: Date.now() });
      this.trySaveToLocalStorage(storeName, data.id, encryptedPayload);
      return;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore(storeName, 'readwrite');
        const encryptedPayload = encryption.encryptObject(data);
        const request = store.put({ id: data.id, payload: encryptedPayload, updatedAt: Date.now() });

        request.onsuccess = () => resolve();
        request.onerror = (e: any) => {
          console.warn(`IndexedDB save error on ${storeName}, falling back to memory:`, e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          this.memoryDb[storeName].set(data.id, { id: data.id, payload: encryptedPayload, updatedAt: Date.now() });
          this.trySaveToLocalStorage(storeName, data.id, encryptedPayload);
          resolve();
        };
      } catch (err) {
        console.warn(`IndexedDB save exception on ${storeName}, falling back to memory:`, err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        const encryptedPayload = encryption.encryptObject(data);
        this.memoryDb[storeName].set(data.id, { id: data.id, payload: encryptedPayload, updatedAt: Date.now() });
        this.trySaveToLocalStorage(storeName, data.id, encryptedPayload);
        resolve();
      }
    });
  }

  async saveAll<T extends { id: string }>(storeName: string, dataList: T[]): Promise<void> {
    await this.init();
    if (dataList.length === 0) return;
    if (this.useMemoryFallback) {
      for (const data of dataList) {
        const encryptedPayload = encryption.encryptObject(data);
        this.memoryDb[storeName].set(data.id, { id: data.id, payload: encryptedPayload, updatedAt: Date.now() });
        this.trySaveToLocalStorage(storeName, data.id, encryptedPayload);
      }
      return;
    }
    return new Promise((resolve) => {
      try {
        if (!this.db) {
          throw new Error('DB not initialized');
        }
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (e: any) => {
          console.warn(`IndexedDB saveAll transaction error on ${storeName}, falling back to memory:`, e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          for (const data of dataList) {
            const encryptedPayload = encryption.encryptObject(data);
            this.memoryDb[storeName].set(data.id, { id: data.id, payload: encryptedPayload, updatedAt: Date.now() });
            this.trySaveToLocalStorage(storeName, data.id, encryptedPayload);
          }
          resolve();
        };

        for (const data of dataList) {
          const encryptedPayload = encryption.encryptObject(data);
          store.put({ id: data.id, payload: encryptedPayload, updatedAt: Date.now() });
        }
      } catch (err) {
        console.warn(`IndexedDB saveAll exception on ${storeName}, falling back to memory:`, err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        for (const data of dataList) {
          const encryptedPayload = encryption.encryptObject(data);
          this.memoryDb[storeName].set(data.id, { id: data.id, payload: encryptedPayload, updatedAt: Date.now() });
          this.trySaveToLocalStorage(storeName, data.id, encryptedPayload);
        }
        resolve();
      }
    });
  }

  async get<T>(storeName: string, id: string): Promise<T | null> {
    await this.init();
    if (this.useMemoryFallback) {
      const record = this.memoryDb[storeName].get(id);
      if (!record) return null;
      return encryption.decryptObject<T>(record.payload);
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore(storeName, 'readonly');
        const request = store.get(id);

        request.onsuccess = (event: any) => {
          const record = event.target.result;
          if (!record) return resolve(null);
          const decrypted = encryption.decryptObject<T>(record.payload);
          resolve(decrypted);
        };
        request.onerror = (e: any) => {
          console.warn(`IndexedDB get error on ${storeName}, falling back to memory:`, e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          const record = this.memoryDb[storeName].get(id);
          if (!record) return resolve(null);
          resolve(encryption.decryptObject<T>(record.payload));
        };
      } catch (err) {
        console.warn(`IndexedDB get exception on ${storeName}, falling back to memory:`, err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        const record = this.memoryDb[storeName].get(id);
        if (!record) return resolve(null);
        resolve(encryption.decryptObject<T>(record.payload));
      }
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    await this.init();
    if (this.useMemoryFallback) {
      const results: T[] = [];
      const records = Array.from(this.memoryDb[storeName].values());
      for (const rec of records) {
        const decrypted = encryption.decryptObject<T>(rec.payload);
        if (decrypted) {
          results.push(decrypted);
        }
      }
      return results;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore(storeName, 'readonly');
        const request = store.getAll();

        request.onsuccess = (event: any) => {
          const records = event.target.result || [];
          const results: T[] = [];
          for (const rec of records) {
            const decrypted = encryption.decryptObject<T>(rec.payload);
            if (decrypted) {
              results.push(decrypted);
            }
          }
          resolve(results);
        };
        request.onerror = (e: any) => {
          console.warn(`IndexedDB getAll error on ${storeName}, falling back to memory:`, e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          const results: T[] = [];
          const records = Array.from(this.memoryDb[storeName].values());
          for (const rec of records) {
            const decrypted = encryption.decryptObject<T>(rec.payload);
            if (decrypted) {
              results.push(decrypted);
            }
          }
          resolve(results);
        };
      } catch (err) {
        console.warn(`IndexedDB getAll exception on ${storeName}, falling back to memory:`, err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        const results: T[] = [];
        const records = Array.from(this.memoryDb[storeName].values());
        for (const rec of records) {
          const decrypted = encryption.decryptObject<T>(rec.payload);
          if (decrypted) {
            results.push(decrypted);
          }
        }
        resolve(results);
      }
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    await this.init();
    if (this.useMemoryFallback) {
      this.memoryDb[storeName].delete(id);
      this.tryDeleteFromLocalStorage(storeName, id);
      return;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore(storeName, 'readwrite');
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (e: any) => {
          console.warn(`IndexedDB delete error on ${storeName}, falling back to memory:`, e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          this.memoryDb[storeName].delete(id);
          this.tryDeleteFromLocalStorage(storeName, id);
          resolve();
        };
      } catch (err) {
        console.warn(`IndexedDB delete exception on ${storeName}, falling back to memory:`, err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        this.memoryDb[storeName].delete(id);
        this.tryDeleteFromLocalStorage(storeName, id);
        resolve();
      }
    });
  }

  async clearStore(storeName: string): Promise<void> {
    await this.init();
    if (this.useMemoryFallback) {
      this.memoryDb[storeName].clear();
      this.tryClearLocalStorage(storeName);
      return;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore(storeName, 'readwrite');
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (e: any) => {
          console.warn(`IndexedDB clearStore error on ${storeName}, falling back to memory:`, e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          this.memoryDb[storeName].clear();
          this.tryClearLocalStorage(storeName);
          resolve();
        };
      } catch (err) {
        console.warn(`IndexedDB clearStore exception on ${storeName}, falling back to memory:`, err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        this.memoryDb[storeName].clear();
        this.tryClearLocalStorage(storeName);
        resolve();
      }
    });
  }

  // Cache Store Operations (Settings, Dashboard Stats, etc.)
  async getCache<T>(key: string): Promise<T | null> {
    await this.init();
    if (this.useMemoryFallback) {
      const record = this.memoryDb['cache'].get(key);
      if (!record) return null;
      return encryption.decryptObject<T>(record.payload);
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore('cache', 'readonly');
        const request = store.get(key);
        request.onsuccess = (event: any) => {
          const record = event.target.result;
          if (!record) return resolve(null);
          const decrypted = encryption.decryptObject<T>(record.payload);
          resolve(decrypted);
        };
        request.onerror = () => {
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          const record = this.memoryDb['cache'].get(key);
          if (!record) return resolve(null);
          resolve(encryption.decryptObject<T>(record.payload));
        };
      } catch {
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        const record = this.memoryDb['cache'].get(key);
        if (!record) return resolve(null);
        resolve(encryption.decryptObject<T>(record.payload));
      }
    });
  }

  async setCache<T>(key: string, data: T): Promise<void> {
    await this.init();
    if (this.useMemoryFallback) {
      const encryptedPayload = encryption.encryptObject(data);
      this.memoryDb['cache'].set(key, { key, payload: encryptedPayload, updatedAt: Date.now() });
      this.trySaveToLocalStorage('cache', key, encryptedPayload);
      return;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore('cache', 'readwrite');
        const encryptedPayload = encryption.encryptObject(data);
        const request = store.put({ key, payload: encryptedPayload, updatedAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => {
          console.warn('IndexedDB setCache error, falling back to memory:', e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          this.memoryDb['cache'].set(key, { key, payload: encryptedPayload, updatedAt: Date.now() });
          this.trySaveToLocalStorage('cache', key, encryptedPayload);
          resolve();
        };
      } catch (err) {
        console.warn('IndexedDB setCache exception, falling back to memory:', err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        const encryptedPayload = encryption.encryptObject(data);
        this.memoryDb['cache'].set(key, { key, payload: encryptedPayload, updatedAt: Date.now() });
        this.trySaveToLocalStorage('cache', key, encryptedPayload);
        resolve();
      }
    });
  }

  // Sync Queue Operations
  async getQueue(): Promise<SyncQueueItem[]> {
    await this.init();
    if (this.useMemoryFallback) {
      const results: SyncQueueItem[] = [];
      const records = Array.from(this.memoryDb['sync_queue'].values());
      for (const r of records) {
        const decryptedPayload = encryption.decryptObject<any>(r.payload);
        results.push({
          id: r.id,
          timestamp: r.timestamp,
          action: r.action,
          payload: decryptedPayload,
          status: r.status,
          error: r.error,
          attempts: r.attempts || 0
        });
      }
      results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return results;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore('sync_queue', 'readonly');
        const request = store.getAll();
        request.onsuccess = (event: any) => {
          const records = event.target.result || [];
          const results: SyncQueueItem[] = [];
          for (const r of records) {
            const decryptedPayload = encryption.decryptObject<any>(r.payload);
            results.push({
              id: r.id,
              timestamp: r.timestamp,
              action: r.action,
              payload: decryptedPayload,
              status: r.status,
              error: r.error,
              attempts: r.attempts || 0
            });
          }
          results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          resolve(results);
        };
        request.onerror = (e: any) => {
          console.warn('IndexedDB getQueue error, falling back to memory:', e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          const results: SyncQueueItem[] = [];
          const records = Array.from(this.memoryDb['sync_queue'].values());
          for (const r of records) {
            const decryptedPayload = encryption.decryptObject<any>(r.payload);
            results.push({
              id: r.id,
              timestamp: r.timestamp,
              action: r.action,
              payload: decryptedPayload,
              status: r.status,
              error: r.error,
              attempts: r.attempts || 0
            });
          }
          results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          resolve(results);
        };
      } catch (err) {
        console.warn('IndexedDB getQueue exception, falling back to memory:', err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        const results: SyncQueueItem[] = [];
        const records = Array.from(this.memoryDb['sync_queue'].values());
        for (const r of records) {
          const decryptedPayload = encryption.decryptObject<any>(r.payload);
          results.push({
            id: r.id,
            timestamp: r.timestamp,
            action: r.action,
            payload: decryptedPayload,
            status: r.status,
            error: r.error,
            attempts: r.attempts || 0
          });
        }
        results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        resolve(results);
      }
    });
  }

  async addToQueue(action: SyncQueueItem['action'], payload: any): Promise<void> {
    await this.init();
    const id = 'Q-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const encryptedPayload = encryption.encryptObject(payload);
    const item = {
      id,
      timestamp: new Date().toISOString(),
      action,
      payload: encryptedPayload,
      status: 'Pending' as const,
      attempts: 0
    };
    if (this.useMemoryFallback) {
      this.memoryDb['sync_queue'].set(id, item);
      this.trySaveToLocalStorage('sync_queue', id, encryptedPayload);
      return;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore('sync_queue', 'readwrite');
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => {
          console.warn('IndexedDB addToQueue error, falling back to memory:', e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          this.memoryDb['sync_queue'].set(id, item);
          this.trySaveToLocalStorage('sync_queue', id, encryptedPayload);
          resolve();
        };
      } catch (err) {
        console.warn('IndexedDB addToQueue exception, falling back to memory:', err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        this.memoryDb['sync_queue'].set(id, item);
        this.trySaveToLocalStorage('sync_queue', id, encryptedPayload);
        resolve();
      }
    });
  }

  async updateQueueItem(item: SyncQueueItem): Promise<void> {
    await this.init();
    const encryptedPayload = encryption.encryptObject(item.payload);
    const dbItem = {
      id: item.id,
      timestamp: item.timestamp,
      action: item.action,
      payload: encryptedPayload,
      status: item.status,
      error: item.error,
      attempts: item.attempts
    };
    if (this.useMemoryFallback) {
      this.memoryDb['sync_queue'].set(item.id, dbItem);
      this.trySaveToLocalStorage('sync_queue', item.id, encryptedPayload);
      return;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore('sync_queue', 'readwrite');
        const request = store.put(dbItem);
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => {
          console.warn('IndexedDB updateQueueItem error, falling back to memory:', e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          this.memoryDb['sync_queue'].set(item.id, dbItem);
          this.trySaveToLocalStorage('sync_queue', item.id, encryptedPayload);
          resolve();
        };
      } catch (err) {
        console.warn('IndexedDB updateQueueItem exception, falling back to memory:', err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        this.memoryDb['sync_queue'].set(item.id, dbItem);
        this.trySaveToLocalStorage('sync_queue', item.id, encryptedPayload);
        resolve();
      }
    });
  }

  // Sync Logs Operations
  async getSyncLogs(): Promise<SyncLogItem[]> {
    await this.init();
    if (this.useMemoryFallback) {
      const records = Array.from(this.memoryDb['sync_logs'].values()) as any[];
      records.sort((a: any, b: any) => {
        const timeA = new Date(`${a.date}T${a.time}`).getTime();
        const timeB = new Date(`${b.date}T${b.time}`).getTime();
        return timeB - timeA;
      });
      return records;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore('sync_logs', 'readonly');
        const request = store.getAll();
        request.onsuccess = (event: any) => {
          const records = event.target.result || [];
          records.sort((a: any, b: any) => {
            const timeA = new Date(`${a.date}T${a.time}`).getTime();
            const timeB = new Date(`${b.date}T${b.time}`).getTime();
            return timeB - timeA;
          });
          resolve(records);
        };
        request.onerror = (e: any) => {
          console.warn('IndexedDB getSyncLogs error, falling back to memory:', e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          const records = Array.from(this.memoryDb['sync_logs'].values()) as any[];
          records.sort((a: any, b: any) => {
            const timeA = new Date(`${a.date}T${a.time}`).getTime();
            const timeB = new Date(`${b.date}T${b.time}`).getTime();
            return timeB - timeA;
          });
          resolve(records);
        };
      } catch (err) {
        console.warn('IndexedDB getSyncLogs exception, falling back to memory:', err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        const records = Array.from(this.memoryDb['sync_logs'].values()) as any[];
        records.sort((a: any, b: any) => {
          const timeA = new Date(`${a.date}T${a.time}`).getTime();
          const timeB = new Date(`${b.date}T${b.time}`).getTime();
          return timeB - timeA;
        });
        resolve(records);
      }
    });
  }

  async addSyncLog(action: string, client: string, status: 'Success' | 'Failed', duration: number, result: string): Promise<void> {
    await this.init();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    const id = 'SL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const log: SyncLogItem = {
      id,
      date: dateStr,
      time: timeStr,
      action,
      client,
      status,
      duration,
      result
    };
    if (this.useMemoryFallback) {
      this.memoryDb['sync_logs'].set(id, log);
      this.trySaveToLocalStorage('sync_logs', id, JSON.stringify(log));
      return;
    }
    return new Promise((resolve) => {
      try {
        const store = this.getStore('sync_logs', 'readwrite');
        const request = store.put(log);
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => {
          console.warn('IndexedDB addSyncLog error, falling back to memory:', e.target.error);
          this.useMemoryFallback = true;
          this.tryLoadFromLocalStorage();
          this.memoryDb['sync_logs'].set(id, log);
          this.trySaveToLocalStorage('sync_logs', id, JSON.stringify(log));
          resolve();
        };
      } catch (err) {
        console.warn('IndexedDB addSyncLog exception, falling back to memory:', err);
        this.useMemoryFallback = true;
        this.tryLoadFromLocalStorage();
        this.memoryDb['sync_logs'].set(id, log);
        this.trySaveToLocalStorage('sync_logs', id, JSON.stringify(log));
        resolve();
      }
    });
  }
}

export const offlineDb = new OfflineDb();
