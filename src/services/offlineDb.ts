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

  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve();

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
        reject(new Error('Failed to open IndexedDB: ' + event.target.error?.message));
      };
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
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readwrite');
        const encryptedPayload = encryption.encryptObject(data);
        const request = store.put({ id: data.id, payload: encryptedPayload, updatedAt: Date.now() });

        request.onsuccess = () => resolve();
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async saveAll<T extends { id: string }>(storeName: string, dataList: T[]): Promise<void> {
    await this.init();
    if (dataList.length === 0) return;
    return new Promise((resolve, reject) => {
      try {
        if (!this.db) return reject(new Error('DB not initialized'));
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (e: any) => reject(e.target.error);

        for (const data of dataList) {
          const encryptedPayload = encryption.encryptObject(data);
          store.put({ id: data.id, payload: encryptedPayload, updatedAt: Date.now() });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  async get<T>(storeName: string, id: string): Promise<T | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readonly');
        const request = store.get(id);

        request.onsuccess = (event: any) => {
          const record = event.target.result;
          if (!record) return resolve(null);
          const decrypted = encryption.decryptObject<T>(record.payload);
          resolve(decrypted);
        };
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    await this.init();
    return new Promise((resolve, reject) => {
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
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readwrite');
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async clearStore(storeName: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readwrite');
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Cache Store Operations (Settings, Dashboard Stats, etc.)
  async getCache<T>(key: string): Promise<T | null> {
    await this.init();
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
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async setCache<T>(key: string, data: T): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('cache', 'readwrite');
        const encryptedPayload = encryption.encryptObject(data);
        const request = store.put({ key, payload: encryptedPayload, updatedAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Sync Queue Operations (No standard encryption for the queue container, but payload is encrypted if needed. We encrypt payload to comply with privacy rules!)
  async getQueue(): Promise<SyncQueueItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
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
          // Sort chronologically
          results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          resolve(results);
        };
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async addToQueue(action: SyncQueueItem['action'], payload: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('sync_queue', 'readwrite');
        const id = 'Q-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const item = {
          id,
          timestamp: new Date().toISOString(),
          action,
          payload: encryption.encryptObject(payload),
          status: 'Pending',
          attempts: 0
        };
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async updateQueueItem(item: SyncQueueItem): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('sync_queue', 'readwrite');
        const dbItem = {
          id: item.id,
          timestamp: item.timestamp,
          action: item.action,
          payload: encryption.encryptObject(item.payload),
          status: item.status,
          error: item.error,
          attempts: item.attempts
        };
        const request = store.put(dbItem);
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Sync Logs Operations
  async getSyncLogs(): Promise<SyncLogItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('sync_logs', 'readonly');
        const request = store.getAll();
        request.onsuccess = (event: any) => {
          const records = event.target.result || [];
          // Sort newest first
          records.sort((a: any, b: any) => {
            const timeA = new Date(`${a.date}T${a.time}`).getTime();
            const timeB = new Date(`${b.date}T${b.time}`).getTime();
            return timeB - timeA;
          });
          resolve(records);
        };
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async addSyncLog(action: string, client: string, status: 'Success' | 'Failed', duration: number, result: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore('sync_logs', 'readwrite');
        const now = new Date();
        
        // Bangladesh Time or Local Time splits
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];
        
        const log: SyncLogItem = {
          id: 'SL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          date: dateStr,
          time: timeStr,
          action,
          client,
          status,
          duration,
          result
        };
        
        const request = store.put(log);
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const offlineDb = new OfflineDb();
