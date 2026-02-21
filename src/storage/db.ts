/**
 * IndexedDB Storage Layer
 * Stores game results, batches, and strategies
 */

import type { GameResult, RuleSet } from '../engine/types';

const DB_NAME = '2048-simulator';
const DB_VERSION = 2;

export interface Batch {
  id: string;
  strategyIds: string[];
  gameCount: number;
  status: 'pending' | 'running' | 'complete' | 'failed';
  seedMode: 'random' | 'fixed' | 'shared';
  seeds: string[];
  createdAt: string;
  completedAt?: string;
}

export interface Strategy {
  id: string;
  name: string;
  type: string;
  params: Record<string, any>;
  stats: {
    gamesPlayed: number;
    winRate: number;
    avgScore: number;
    avgMoves: number;
    bestScore: number;
    minMovesToWin?: number;
  };
}

class Database {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('games')) {
          const gamesStore = db.createObjectStore('games', { keyPath: 'id' });
          gamesStore.createIndex('batchId', 'batchId', { unique: false });
          gamesStore.createIndex('strategyId', 'strategyId', { unique: false });
          gamesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('batches')) {
          const batchesStore = db.createObjectStore('batches', { keyPath: 'id' });
          batchesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('strategies')) {
          db.createObjectStore('strategies', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('ruleSets')) {
          db.createObjectStore('ruleSets', { keyPath: 'id' });
        }
      };
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Game operations
  async saveGame(game: GameResult): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('games', 'readwrite');
      const request = store.put(game);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveGames(games: GameResult[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('games', 'readwrite');
      let completed = 0;

      games.forEach((game) => {
        const request = store.put(game);
        request.onsuccess = () => {
          completed++;
          if (completed === games.length) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getGame(id: string): Promise<GameResult | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('games');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getGamesByBatch(batchId: string): Promise<GameResult[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('games');
      const index = store.index('batchId');
      const request = index.getAll(batchId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllGames(): Promise<GameResult[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('games');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Batch operations
  async saveBatch(batch: Batch): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('batches', 'readwrite');
      const request = store.put(batch);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBatch(id: string): Promise<Batch | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('batches');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllBatches(): Promise<Batch[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('batches');
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev'); // Most recent first
      const batches: Batch[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          batches.push(cursor.value);
          cursor.continue();
        } else {
          resolve(batches);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Strategy operations
  async saveStrategy(strategy: Strategy): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('strategies', 'readwrite');
      const request = store.put(strategy);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStrategy(id: string): Promise<Strategy | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('strategies');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllStrategies(): Promise<Strategy[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('strategies');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // RuleSet operations
  async saveRuleSet(ruleSet: RuleSet): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('ruleSets', 'readwrite');
      const request = store.put(ruleSet);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRuleSet(id: string): Promise<RuleSet | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('ruleSets');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRuleSets(): Promise<RuleSet[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('ruleSets');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRuleSet(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('ruleSets', 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data
  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const storeNames = ['games', 'batches', 'strategies', 'ruleSets'];
    const promises = storeNames.map((name) => {
      return new Promise<void>((resolve, reject) => {
        const store = this.getStore(name, 'readwrite');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
  }
}

// Singleton instance
export const db = new Database();
