/**
 * The single owner of the `tw-asset-cache` IndexedDB database in a page.
 *
 * Every copy of this package that runs in the page — the standalone extension, and each extension
 * bundle that composes the Asset Manager from `./composition` — shares one store through a
 * `Symbol.for` registry on the global object. The store holds the one database connection, the
 * records the page committed, and the write generations, so one copy never answers from a record
 * another copy already replaced or deleted, and generations never collide between copies.
 */
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
    restoreIfGeneration(name: string, generation: number, previous: PersistentAssetRecord | null): Promise<void>;
    /** Close the connection. The next operation opens a new one. */
    close(): void;
}
export declare const PERSISTENT_ASSET_STORE_KEY: unique symbol;
export declare const PERSISTENT_ASSET_DATABASE_NAME = "tw-asset-cache";
type IndexedDBSource = () => IDBFactory | undefined;
/** Create a store. Callers in a page use {@link acquirePersistentAssetStore} instead. */
export declare function createPersistentAssetStore(indexedDBSource?: IndexedDBSource): PersistentAssetStore;
/**
 * The page's one store. The first copy of this package to ask creates it; every later copy, from
 * this version or another, receives the same one.
 */
export declare function acquirePersistentAssetStore(globalObject?: Record<PropertyKey, unknown>): PersistentAssetStore;
export {};
