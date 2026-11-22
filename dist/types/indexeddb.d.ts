/**
 * The one way this package opens and talks to IndexedDB.
 *
 * Every store in the package opens its database through {@link openIndexedDB}, so they all settle
 * an open request once, close a connection that arrives after the caller gave up (a blocked or
 * aborted open), and step aside when another page upgrades the database. Each store keeps its own
 * error codes and messages through {@link IndexedDBOpenErrors}.
 */
export interface IndexedDBOpenErrors {
    /** The page has no IndexedDB factory. */
    unavailable(): Error;
    /** `indexedDB.open` threw. */
    openThrew(cause: unknown): Error;
    /** The open request reported an error. */
    requestFailed(cause: unknown): Error;
    /** Another connection blocks the open. */
    blocked(): Error;
}
export interface OpenIndexedDBOptions {
    readonly factory: IDBFactory | null | undefined;
    readonly name: string;
    readonly version: number;
    /** Create or adjust stores and indexes. Runs inside the version-change transaction. */
    readonly upgrade: (database: IDBDatabase, transaction: IDBTransaction) => void;
    readonly errors: IndexedDBOpenErrors;
    readonly signal?: AbortSignal | undefined;
    /** The error for an aborted signal. Required when `signal` is given. */
    readonly abortError?: ((reason: unknown) => Error) | undefined;
    /**
     * Checked when the connection arrives. An error closes the connection and rejects with it, for
     * a store that was released while the open was pending.
     */
    readonly rejectArrival?: (() => Error | null) | undefined;
    /** Close the connection when another page upgrades the database. Defaults to true. */
    readonly closeOnVersionChange?: boolean | undefined;
    /** Called after a version change closed the connection. */
    readonly onClosedByVersionChange?: ((database: IDBDatabase) => void) | undefined;
}
export declare function openIndexedDB(options: OpenIndexedDBOptions): Promise<IDBDatabase>;
/** Resolve with a request's result. */
export declare function requestResult<T>(request: IDBRequest<T>): Promise<T>;
/** Resolve when a transaction commits; reject when it fails or aborts. */
export declare function transactionComplete(transaction: IDBTransaction): Promise<void>;
