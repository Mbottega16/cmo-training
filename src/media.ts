/**
 * Voice memos and film loaded from the device, kept in this browser's IndexedDB.
 * Nothing here leaves the device; real uploads need the backend's file storage.
 */
const DB_NAME = 'cmo-training-media';
const STORE = 'media';

export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser cannot store media.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open media storage.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('Media storage failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('Media storage was aborted (it may be full).'));
    });
  } finally {
    db.close();
  }
}

export function putMedia(key: string, blob: Blob): Promise<IDBValidKey> {
  return withStore('readwrite', s => s.put(blob, key));
}

export async function getMedia(key: string): Promise<Blob | undefined> {
  const value = await withStore<unknown>('readonly', s => s.get(key));
  return value instanceof Blob ? value : undefined;
}

export function deleteMedia(key: string): Promise<undefined> {
  return withStore('readwrite', s => s.delete(key));
}

export async function clearMedia(): Promise<void> {
  try {
    await withStore('readwrite', s => s.clear());
  } catch {
    // nothing stored, or storage unavailable
  }
}
