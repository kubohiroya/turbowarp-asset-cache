import {IDBFactory} from 'fake-indexeddb';
import {describe, expect, it, vi} from 'vitest';

import {openIndexedDB, requestResult, transactionComplete, type IndexedDBOpenErrors} from '../src/indexeddb.js';

const errors: IndexedDBOpenErrors = {
  unavailable: () => new Error('unavailable'),
  openThrew: (cause) => new Error('threw', {cause}),
  requestFailed: (cause) => new Error('failed', {cause}),
  blocked: () => new Error('blocked')
};

function createStore(database: IDBDatabase) {
  if (!database.objectStoreNames.contains('items')) database.createObjectStore('items', {keyPath: 'key'});
}

describe('openIndexedDB', () => {
  it('runs the upgrade and resolves with a usable connection', async () => {
    const database = await openIndexedDB({factory: new IDBFactory(), name: 'a', version: 1, upgrade: createStore, errors});
    const transaction = database.transaction('items', 'readwrite');
    transaction.objectStore('items').put({key: 'k', value: 1});
    await transactionComplete(transaction);
    const read = database.transaction('items').objectStore('items').get('k');
    await expect(requestResult(read)).resolves.toEqual({key: 'k', value: 1});
    database.close();
  });

  it('reports a missing factory and a throwing open with the caller\'s errors', async () => {
    await expect(openIndexedDB({factory: undefined, name: 'a', version: 1, upgrade: createStore, errors}))
      .rejects.toThrow('unavailable');
    const factory = new IDBFactory();
    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(openIndexedDB({factory, name: 'a', version: 1, upgrade: createStore, errors}))
      .rejects.toThrow('threw');
  });

  it('closes a connection that arrives after a blocked open was given up', async () => {
    const factory = new IDBFactory();
    const holder = await openIndexedDB({
      factory, name: 'a', version: 1, upgrade: createStore, errors, closeOnVersionChange: false
    });
    await expect(openIndexedDB({factory, name: 'a', version: 2, upgrade: createStore, errors}))
      .rejects.toThrow('blocked');
    // The given-up version 2 request now completes. Had its connection been left open, a later
    // upgrade would be blocked by it.
    holder.close();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const later = await openIndexedDB({factory, name: 'a', version: 3, upgrade: createStore, errors});
    expect(later.version).toBe(3);
    later.close();
  });

  it('steps aside when another page upgrades, and says so', async () => {
    const factory = new IDBFactory();
    const closed = vi.fn();
    const database = await openIndexedDB({
      factory, name: 'a', version: 1, upgrade: createStore, errors, onClosedByVersionChange: closed
    });
    const upgraded = await openIndexedDB({factory, name: 'a', version: 2, upgrade: createStore, errors});
    expect(closed).toHaveBeenCalledWith(database);
    upgraded.close();
  });

  it('rejects an aborted signal and a released store, closing the late connection', async () => {
    const controller = new AbortController();
    controller.abort('stop');
    await expect(openIndexedDB({
      factory: new IDBFactory(), name: 'a', version: 1, upgrade: createStore, errors,
      signal: controller.signal, abortError: (reason) => new Error(`aborted:${String(reason)}`)
    })).rejects.toThrow('aborted:stop');
    await expect(openIndexedDB({
      factory: new IDBFactory(), name: 'a', version: 1, upgrade: createStore, errors,
      rejectArrival: () => new Error('released')
    })).rejects.toThrow('released');
  });
});
