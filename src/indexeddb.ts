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

export function openIndexedDB(options: OpenIndexedDBOptions): Promise<IDBDatabase> {
  const {factory, errors, signal} = options;
  if (!factory || typeof factory.open !== 'function') return Promise.reject(errors.unavailable());
  if (signal?.aborted) return Promise.reject(abortErrorFor(options, signal.reason));
  let request: IDBOpenDBRequest;
  try {
    request = factory.open(options.name, options.version);
  } catch (error) {
    return Promise.reject(errors.openThrew(error));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => rejectOnce(abortErrorFor(options, signal?.reason));
    const finish = () => {
      settled = true;
      signal?.removeEventListener('abort', abort);
    };
    const rejectOnce = (error: Error) => {
      if (settled) return;
      finish();
      reject(error);
    };
    signal?.addEventListener('abort', abort, {once: true});
    request.onupgradeneeded = () => {
      options.upgrade(request.result, request.transaction!);
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      const arrivalError = options.rejectArrival?.() ?? null;
      if (arrivalError) {
        database.close();
        rejectOnce(arrivalError);
        return;
      }
      finish();
      if (options.closeOnVersionChange !== false) {
        database.onversionchange = () => {
          database.close();
          options.onClosedByVersionChange?.(database);
        };
      }
      resolve(database);
    };
    request.onerror = () => rejectOnce(errors.requestFailed(request.error));
    request.onblocked = () => rejectOnce(errors.blocked());
  });
}

function abortErrorFor(options: OpenIndexedDBOptions, reason: unknown): Error {
  if (!options.abortError) throw new TypeError('openIndexedDB needs abortError with a signal.');
  return options.abortError(reason);
}

/** Resolve with a request's result. */
export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

/** Resolve when a transaction commits; reject when it fails or aborts. */
export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}
