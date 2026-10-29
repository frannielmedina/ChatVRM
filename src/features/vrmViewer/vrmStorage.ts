// Custom VRM files are stored in IndexedDB so the streamer tab (and a page
// reload) can load the same model. A blob: URL only lives as long as the tab
// that created it, which is why the model used to reset in other tabs.
const DB_NAME = "chatvrm";
const STORE = "files";
const KEY = "custom-vrm";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomVrm(file: Blob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[vrmStorage] couldn't save VRM", e);
  }
}

/** Returns a fresh blob: URL for the saved model, or null if none is stored. */
export async function loadCustomVrmUrl(): Promise<string | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

// ── Per-character models ──────────────────────────────────────────────────────
// Each character card keeps its own VRM in the same IndexedDB store, under
// "vrm:<cardId>". Cards that use the bundled default model store nothing.
const cardKey = (id: string) => `vrm:${id}`;

async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function saveCardVrm(cardId: string, file: Blob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, cardKey(cardId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[vrmStorage] couldn't save card VRM", e);
  }
}

export async function loadCardVrmBlob(cardId: string): Promise<Blob | null> {
  try {
    return (await idbGet(cardKey(cardId))) ?? null;
  } catch {
    return null;
  }
}

export async function loadCardVrmUrl(cardId: string): Promise<string | null> {
  const blob = await loadCardVrmBlob(cardId);
  return blob ? URL.createObjectURL(blob) : null;
}

/** The pre-character-cards single model, used once to migrate into the first card. */
export async function loadLegacyVrmBlob(): Promise<Blob | null> {
  try {
    return (await idbGet(KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function deleteCardVrm(cardId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(cardKey(cardId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[vrmStorage] couldn't delete card VRM", e);
  }
}
