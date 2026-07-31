type LocalFileHandle = {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(options?: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(options?: { mode: "readwrite" }): Promise<PermissionState>;
};

type PickerWindow = Window & {
  showOpenFilePicker?: (options: unknown) => Promise<LocalFileHandle[]>;
};

const DATABASE_NAME = "outreach-console-files";
const STORE_NAME = "handles";
const SOURCE_KEY = "application-source";

export function supportsLinkedFiles(): boolean {
  return typeof (window as PickerWindow).showOpenFilePicker === "function";
}

export async function chooseLinkedSource(): Promise<LocalFileHandle> {
  const picker = (window as PickerWindow).showOpenFilePicker;
  if (!picker) throw new Error("Linked files require Chrome or Edge. Use compatibility upload instead.");
  const [handle] = await picker({
    multiple: false,
    types: [{ description: "Application data", accept: { "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
  });
  if (!handle) throw new Error("No source file selected.");
  return handle;
}

export async function readLinkedSource(handle: LocalFileHandle): Promise<File> {
  return handle.getFile();
}

export async function writeLinkedCsv(handle: LocalFileHandle, csv: string): Promise<File> {
  const permission = await ensureWritePermission(handle);
  if (!permission) throw new Error("Write permission was not granted for the linked CSV.");
  const writable = await handle.createWritable();
  await writable.write(csv);
  await writable.close();
  return handle.getFile();
}

export async function rememberLinkedSource(handle: LocalFileHandle): Promise<void> {
  const database = await openHandleDatabase();
  await requestResult(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(handle, SOURCE_KEY));
  database.close();
}

export async function restoreLinkedSource(): Promise<LocalFileHandle | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await openHandleDatabase();
  const value = await requestResult(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(SOURCE_KEY));
  database.close();
  return (value as LocalFileHandle | undefined) ?? null;
}

export async function forgetLinkedSource(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openHandleDatabase();
  await requestResult(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(SOURCE_KEY));
  database.close();
}

async function ensureWritePermission(handle: LocalFileHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if (await handle.queryPermission({ mode: "readwrite" }) === "granted") return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open linked-file storage."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Linked-file storage failed."));
  });
}

export type { LocalFileHandle };
