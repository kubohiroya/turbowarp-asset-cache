/**
 * The single owner of the `tw-asset-cache` IndexedDB database in a page.
 *
 * Every copy of this package that runs in the page — the standalone extension, and each extension
 * bundle that composes the Asset Manager from `./composition` — shares one store through a
 * `Symbol.for` registry on the global object. The store holds the one database connection, the
 * records the page committed, and the write generations, so one copy never answers from a record
 * another copy already replaced or deleted, and generations never collide between copies.
 */

import {openIndexedDB, requestResult} from './indexeddb.js';

export interface PersistentAssetRecord {
  name: string;
  url: string;
  mimeType: string;
  data: ArrayBuffer;
  cachedAt: number;
  generation?: number;
}

export interface PersistentAssetStore {
  readonly formatVersion: 1;
  /** The committed record, `null` when the page deleted it, or `undefined` when the page has not seen it. */
  committed(name: string): PersistentAssetRecord | null | undefined;
  /** Remember what the page committed for a name. */
  commit(name: string, record: PersistentAssetRecord | null): void;
  /** A write generation no other writer in this page has used. */
  nextGeneration(): number;
  get(name: string): Promise<PersistentAssetRecord | null>;
  put(record: PersistentAssetRecord): Promise<void>;
  delete(name: string): Promise<void>;
  clear(): Promise<void>;
  /** Put back `previous` only when the stored record still carries `generation`. */
  restoreIfGeneration(
    name: string,
    generation: number,
    previous: PersistentAssetRecord | null
  ): Promise<void>;
  /** Close the connection. The next operation opens a new one. */
  close(): void;
}

export const PERSISTENT_ASSET_STORE_KEY = Symbol.for('@kubohiroya/turbowarp-asset-cache/persistent-store');
export const PERSISTENT_ASSET_DATABASE_NAME = 'tw-asset-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'assets';

type IndexedDBSource = () => IDBFactory | undefined;

/** Create a store. Callers in a page use {@link acquirePersistentAssetStore} instead. */
export function createPersistentAssetStore(
  indexedDBSource: IndexedDBSource = () => globalThis.indexedDB
): PersistentAssetStore {
  const committedRecords = new Map<string, PersistentAssetRecord | null>();
  let generation = 0;
  let connection: Promise<IDBDatabase> | null = null;
  let openedDatabase: IDBDatabase | null = null;

  function open(): Promise<IDBDatabase> {
    connection ??= openIndexedDB({
      factory: indexedDBSource(),
      name: PERSISTENT_ASSET_DATABASE_NAME,
      version: DATABASE_VERSION,
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, {keyPath: 'name'});
        }
      },
      // Another page upgrading the database must not wait on this one; the next operation reopens.
      onClosedByVersionChange: (database) => {
        if (openedDatabase === database) {
          openedDatabase = null;
          connection = null;
        }
      },
      errors: {
        unavailable: () => new Error('IndexedDB is unavailable, so the asset cache cannot be used.'),
        openThrew: (cause) => new Error('The asset cache database could not be opened.', {cause}),
        requestFailed: (cause) => new Error('The asset cache database could not be opened.', {cause}),
        blocked: () => new Error('The asset cache database is blocked by another page.')
      }
    }).then((database) => {
      openedDatabase = database;
      return database;
    });
    const pending = connection;
    pending.catch(() => {
      if (connection === pending) connection = null;
    });
    return pending;
  }

  async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
    const database = await open();
    return requestResult(action(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME)));
  }

  return Object.freeze({
    formatVersion: 1 as const,
    committed(name: string) {
      return committedRecords.has(name) ? committedRecords.get(name) ?? null : undefined;
    },
    commit(name: string, record: PersistentAssetRecord | null) {
      committedRecords.set(name, record);
    },
    nextGeneration() {
      generation += 1;
      return generation;
    },
    async get(name: string) {
      return (await run<PersistentAssetRecord | undefined>('readonly', (store) => store.get(name))) ?? null;
    },
    async put(record: PersistentAssetRecord) {
      await run('readwrite', (store) => store.put(record));
    },
    async delete(name: string) {
      await run('readwrite', (store) => store.delete(name));
      committedRecords.set(name, null);
    },
    async clear() {
      await run('readwrite', (store) => store.clear());
      committedRecords.clear();
    },
    async restoreIfGeneration(name: string, writtenGeneration: number, previous: PersistentAssetRecord | null) {
      const database = await open();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const current = request.result as PersistentAssetRecord | undefined;
          if (current?.generation !== writtenGeneration) return;
          if (previous) store.put(previous);
          else store.delete(name);
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    },
    close() {
      const pending = connection;
      connection = null;
      openedDatabase = null;
      void pending?.then((database) => database.close(), () => undefined);
    }
  });
}

function isPersistentAssetStore(value: unknown): value is PersistentAssetStore {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.formatVersion === 1 &&
    ['committed', 'commit', 'nextGeneration', 'get', 'put', 'delete', 'clear', 'restoreIfGeneration', 'close']
      .every((method) => typeof candidate[method] === 'function');
}

/**
 * The page's one store. The first copy of this package to ask creates it; every later copy, from
 * this version or another, receives the same one.
 */
export function acquirePersistentAssetStore(
  globalObject: Record<PropertyKey, unknown> = globalThis as unknown as Record<PropertyKey, unknown>
): PersistentAssetStore {
  const existing = globalObject[PERSISTENT_ASSET_STORE_KEY];
  if (existing !== undefined) {
    if (!isPersistentAssetStore(existing)) {
      throw new Error('The page already holds an asset cache store this version cannot share.');
    }
    return existing;
  }
  const store = createPersistentAssetStore(() => globalObject.indexedDB as IDBFactory | undefined);
  Object.defineProperty(globalObject, PERSISTENT_ASSET_STORE_KEY, {
    value: store,
    configurable: false,
    enumerable: false,
    writable: false
  });
  return store;
}
