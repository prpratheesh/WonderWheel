/**
 * Minimal promise-based IndexedDB wrapper.
 * Falls back to an in-memory store when IndexedDB is unavailable
 * (e.g. some private-browsing modes) so the app still works.
 */

export type StoreName = 'wheels' | 'images' | 'kv';

const DB_NAME = 'classspin';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory: Record<StoreName, Map<IDBValidKey, unknown>> = {
  wheels: new Map(),
  images: new Map(),
  kv: new Map(),
};

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('wheels')) db.createObjectStore('wheels', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  if (!db) throw new Error('no-idb');
  const tx = db.transaction(store, mode);
  const result = await wrap(fn(tx.objectStore(store)));
  if (mode === 'readwrite') {
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  return result;
}

const keyOf = (store: StoreName, value: unknown, key?: IDBValidKey): IDBValidKey =>
  key ?? (store === 'kv' ? '' : ((value as { id: string }).id as IDBValidKey));

export const idb = {
  async get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    try {
      return (await withStore(store, 'readonly', (s) => s.get(key))) as T | undefined;
    } catch {
      return memory[store].get(key) as T | undefined;
    }
  },
  async getAll<T>(store: StoreName): Promise<T[]> {
    try {
      return (await withStore(store, 'readonly', (s) => s.getAll())) as T[];
    } catch {
      return [...memory[store].values()] as T[];
    }
  },
  async keys(store: StoreName): Promise<IDBValidKey[]> {
    try {
      return await withStore(store, 'readonly', (s) => s.getAllKeys());
    } catch {
      return [...memory[store].keys()];
    }
  },
  async put(store: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
    try {
      await withStore(store, 'readwrite', (s) => (store === 'kv' ? s.put(value, key) : s.put(value)));
    } catch {
      memory[store].set(keyOf(store, value, key), value);
    }
  },
  async delete(store: StoreName, key: IDBValidKey): Promise<void> {
    try {
      await withStore(store, 'readwrite', (s) => s.delete(key));
    } catch {
      memory[store].delete(key);
    }
  },
  async clear(store: StoreName): Promise<void> {
    try {
      await withStore(store, 'readwrite', (s) => s.clear());
    } catch {
      memory[store].clear();
    }
  },
};

/** Ask the browser to keep our data even under storage pressure. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not critical */
  }
}

