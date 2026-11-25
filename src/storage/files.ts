import { t, nativeError } from "../i18n";
import {
  invoke as tauriInvoke,
  type InvokeArgs,
  isTauri,
  convertFileSrc,
} from "@tauri-apps/api/core";
export interface Row {
  key: string;
  value: string;
  version: number;
}
export interface Change {
  key: string;
  value: string;
  expected: number;
}
/** Keys and revisions are portable. Native file paths never enter book records. */
export interface LibraryFiles {
  records(): Promise<Row[]>;
  commit(changes: Change[]): Promise<void>;
  put(blob: Blob): Promise<string>;
  url(key: string): Promise<{ url: string; release(): void }>;
  location(): Promise<string>;
}
async function invoke<T>(
  command: string,
  args?: InvokeArgs,
  options?: Parameters<typeof tauriInvoke>[2],
): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args, options);
  } catch (error) {
    throw nativeError(error);
  }
}
const nativeFiles: LibraryFiles = {
  records: () => invoke("catalog"),
  commit: (changes) => invoke("commit", { changes }),
  async put(blob) {
    const id = await invoke<number>("begin_object", { size: blob.size });
    try {
      const chunk = 2 * 1024 * 1024;
      for (let offset = 0; offset < blob.size; offset += chunk) {
        const bytes = await blob.slice(offset, offset + chunk).arrayBuffer();
        await invoke("append_object", bytes, {
          headers: { "x-upload": String(id), "x-offset": String(offset) },
        });
      }
      return await invoke<string>("finish_object", { id });
    } catch (e) {
      await invoke("cancel_object", { id });
      throw e;
    }
  },
  async url(digest) {
    return {
      url: convertFileSrc(await invoke<string>("object_path", { digest })),
      release() {},
    };
  },
  location: () => invoke("library_path"),
};
let opening: Promise<IDBDatabase> | undefined;
function db() {
  return (opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("hearthread-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("records", { keyPath: "key" });
      request.result.createObjectStore("objects");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  }));
}
function result<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function complete(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(tx.error ?? new Error(t("error.conflict")));
  });
}
const browserFiles: LibraryFiles = {
  async records() {
    return result(
      (await db()).transaction("records").objectStore("records").getAll(),
    );
  },
  async commit(changes) {
    const tx = (await db()).transaction("records", "readwrite"),
      store = tx.objectStore("records"),
      done = complete(tx);
    for (const change of changes) {
      const current = await result<Row | undefined>(store.get(change.key));
      if ((current?.version ?? 0) !== change.expected) {
        tx.abort();
        break;
      }
      store.put({
        key: change.key,
        value: change.value,
        version: change.expected + 1,
      });
    }
    await done;
  },
  async put(blob) {
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      await blob.arrayBuffer(),
    );
    const key = Array.from(new Uint8Array(bytes), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    const tx = (await db()).transaction("objects", "readwrite");
    tx.objectStore("objects").put(blob, key);
    await complete(tx);
    return key;
  },
  async url(key) {
    const blob = await result<Blob | undefined>(
      (await db()).transaction("objects").objectStore("objects").get(key),
    );
    if (!blob) throw new Error(t("error.missingOriginal"));
    const url = URL.createObjectURL(blob);
    return { url, release: () => URL.revokeObjectURL(url) };
  },
  async location() {
    return t("storage.browser");
  },
};
export const files = isTauri() ? nativeFiles : browserFiles;
