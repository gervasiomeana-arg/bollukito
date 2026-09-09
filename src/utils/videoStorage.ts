/**
 * Robust IndexedDB storage for Bollukito's walking video.
 * Persists the video Blob locally in the user's browser disk so that
 * server restarts, container scale-downs, and session resets NEVER delete it.
 */

const DB_NAME = 'BollukitoDB';
const DB_VERSION = 2;
const STORE_NAME = 'media';
const VIDEO_KEY = 'walking_bulldog_video_v3_clean';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this browser'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveVideoPermanently(blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, VIDEO_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to store video in IndexedDB'));
    });
  } catch (err) {
    console.error('Error saving video to IndexedDB:', err);
    throw err;
  }
}

export async function getPermanentVideo(): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(VIDEO_KEY);

      req.onsuccess = () => {
        const result = req.result as Blob | undefined;
        resolve(result || null);
      };
      req.onerror = () => reject(req.error || new Error('Failed to read video from IndexedDB'));
    });
  } catch (err) {
    console.warn('Could not read video from IndexedDB:', err);
    return null;
  }
}

export async function deletePermanentVideo(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(VIDEO_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not delete video from IndexedDB:', err);
  }
}
