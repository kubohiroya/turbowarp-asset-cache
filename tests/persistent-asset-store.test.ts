import {IDBFactory} from 'fake-indexeddb';
import {describe, expect, it, vi} from 'vitest';

import {
  acquirePersistentAssetStore,
  createPersistentAssetStore,
  PERSISTENT_ASSET_DATABASE_NAME,
  PERSISTENT_ASSET_STORE_KEY,
  type PersistentAssetRecord
} from '../src/persistent-asset-store.js';

function record(name: string, generation?: number): PersistentAssetRecord {
  return {
    name,
    url: `https://example.com/${name}.png`,
    mimeType: 'image/png',
    data: new Uint8Array([1, 2, 3]).buffer,
    cachedAt: 1,
    ...(generation === undefined ? {} : {generation})
  };
}

describe('persistent asset store', () => {
  it('hands every copy of the package in a page the same store', async () => {
    const page: Record<PropertyKey, unknown> = {indexedDB: new IDBFactory()};
    const first = acquirePersistentAssetStore(page);
    vi.resetModules();
    // A second module instance stands in for another bundle that carries its own copy.
    const anotherCopy = (await import(
      /* @vite-ignore */ `../src/persistent-asset-store.js?copy=${Date.now()}`
    )) as typeof import('../src/persistent-asset-store.js');
    expect(anotherCopy.acquirePersistentAssetStore).not.toBe(acquirePersistentAssetStore);
    expect(anotherCopy.acquirePersistentAssetStore(page)).toBe(first);
    expect(page[PERSISTENT_ASSET_STORE_KEY]).toBe(first);
  });

  it('refuses a registry entry it cannot share', () => {
    const page: Record<PropertyKey, unknown> = {[PERSISTENT_ASSET_STORE_KEY]: {formatVersion: 2}};
    expect(() => acquirePersistentAssetStore(page)).toThrow('cannot share');
  });

  it('issues generations no other writer in the page has used', () => {
    const store = acquirePersistentAssetStore({indexedDB: new IDBFactory()});
    const issued = new Set([store.nextGeneration(), store.nextGeneration(), store.nextGeneration()]);
    expect(issued.size).toBe(3);
  });

  it('reads, writes, deletes and clears through one connection', async () => {
    const factory = new IDBFactory();
    const open = vi.spyOn(factory, 'open');
    const store = createPersistentAssetStore(() => factory);
    await store.put(record('a'));
    await store.put(record('b'));
    await expect(store.get('a')).resolves.toMatchObject({name: 'a'});
    await store.delete('a');
    expect(store.committed('a')).toBeNull();
    await expect(store.get('a')).resolves.toBeNull();
    store.commit('b', record('b'));
    await store.clear();
    expect(store.committed('b')).toBeUndefined();
    await expect(store.get('b')).resolves.toBeNull();
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(PERSISTENT_ASSET_DATABASE_NAME, 1);
  });

  it('restores the previous record only while its own write is still current', async () => {
    const store = createPersistentAssetStore(() => new IDBFactory());
    await store.put(record('a', 1));
    await store.restoreIfGeneration('a', 2, null);
    await expect(store.get('a')).resolves.toMatchObject({generation: 1});
    await store.put(record('a', 2));
    await store.restoreIfGeneration('a', 2, record('a', 1));
    await expect(store.get('a')).resolves.toMatchObject({generation: 1});
    await store.restoreIfGeneration('a', 1, null);
    await expect(store.get('a')).resolves.toBeNull();
  });

  it('reopens after closing, and after another page upgrades the database', async () => {
    const factory = new IDBFactory();
    const open = vi.spyOn(factory, 'open');
    const store = createPersistentAssetStore(() => factory);
    await store.put(record('a'));
    store.close();
    await expect(store.get('a')).resolves.toMatchObject({name: 'a'});
    expect(open).toHaveBeenCalledTimes(2);
    await new Promise<void>((resolve, reject) => {
      const upgrade = factory.open(PERSISTENT_ASSET_DATABASE_NAME, 2);
      upgrade.onsuccess = () => {
        upgrade.result.close();
        resolve();
      };
      upgrade.onerror = () => reject(upgrade.error);
    });
    // This copy still asks for version 1, so the upgraded database refuses it rather than
    // the old connection blocking the upgrade.
    await expect(store.get('a')).rejects.toBeDefined();
    expect(open).toHaveBeenCalledTimes(4);
  });

  it('reports a page without IndexedDB and tries again later', async () => {
    let factory: IDBFactory | undefined;
    const store = createPersistentAssetStore(() => factory);
    await expect(store.get('a')).rejects.toThrow('IndexedDB is unavailable');
    factory = new IDBFactory();
    await expect(store.get('a')).resolves.toBeNull();
  });
});
