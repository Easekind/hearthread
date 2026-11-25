import { t, isLocale } from "../i18n";
import { files, type Change } from "./files";
import {
  defaults,
  defaultFolders,
  type Catalog,
  type Book,
  type Format,
  type Preferences,
} from "../model";
import edition from "../library/edition.json";
const versions = new Map<string, number>();
const values = new Map<string, string>();
const listeners = new Set<() => void>();
let snapshot: Catalog = { books: [], folders: defaultFolders, prefs: defaults };
const profile = "profiles/local/";
const seeded: Book[] = edition.map((b, i) => ({
  ...b,
  id: String(b.id),
  type: b.type as Format,
  added: i + 1,
  readAt: b.progress ? 12 - i : 0,
  filename: b.title + "." + b.type.toLowerCase(),
}));
export async function loadCatalog() {
  const rows = await files.records();
  const books = new Map(seeded.map((b) => [b.id, { ...b }]));
  const prefs = { ...defaults };
  let folders = defaultFolders;
  versions.clear();
  values.clear();
  for (const row of rows) {
    versions.set(row.key, row.version);
    values.set(row.key, row.value);
    const value = JSON.parse(row.value);
    if (row.key.startsWith("books/"))
      books.set(value.id, {
        readAt: 0,
        chapter: "",
        progress: 0,
        ...books.get(value.id),
        ...value,
      });
    if (row.key === profile + "settings") {
      for (const [key, setting] of Object.entries(value)) {
        if (
          Object.hasOwn(defaults, key) &&
          (key !== "locale" || isLocale(setting))
        )
          Object.assign(prefs, { [key]: setting });
      }
    }
    if (row.key === "folders") folders = value;
  }
  for (const row of rows) {
    if (!row.key.startsWith(profile + "reading/")) continue;
    const id = row.key.slice((profile + "reading/").length),
      book = books.get(id);
    if (book) Object.assign(book, JSON.parse(row.value));
  }
  snapshot = { books: [...books.values()], prefs, folders };
  listeners.forEach((f) => f());
}
export const catalog = {
  get: () => snapshot,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
let tail = Promise.resolve();
/** Serialize read/modify/write actions; publish only after the transaction commits. */
export function update(edit: (current: Catalog) => Partial<Catalog>) {
  const job = tail.then(async () => {
    const next = { ...snapshot, ...edit(snapshot) },
      changes: Change[] = [];
    function change(key: string, value: unknown) {
      const json = JSON.stringify(value);
      if (values.get(key) !== json)
        changes.push({ key, value: json, expected: versions.get(key) ?? 0 });
    }
    if (next.books !== snapshot.books) {
      const old = new Map(snapshot.books.map((b) => [b.id, b]));
      for (const book of next.books) {
        if (old.get(book.id) === book) continue;
        const { progress, chapter, sectionIndex, location, readAt, ...shared } =
          book;
        change("books/" + book.id, shared);
        change(profile + "reading/" + book.id, {
          progress,
          chapter,
          sectionIndex,
          location,
          readAt,
        });
      }
    }
    if (next.prefs !== snapshot.prefs) change(profile + "settings", next.prefs);
    if (next.folders !== snapshot.folders) change("folders", next.folders);
    if (changes.length) await files.commit(changes);
    changes.forEach((c) => {
      versions.set(c.key, c.expected + 1);
      values.set(c.key, c.value);
    });
    snapshot = next;
    listeners.forEach((f) => f());
  });
  tail = job.catch(() => {});
  return job;
}
export const patchPrefs = (patch: Partial<Preferences>) =>
  update((s) => ({ prefs: { ...s.prefs, ...patch } }));
export const patchBooks = (ids: string[], patch: Partial<Book>) =>
  update((s) => ({
    books: s.books.map((b) => (ids.includes(b.id) ? { ...b, ...patch } : b)),
  }));
export async function bookSource(book: Book) {
  if (book.object) return files.url(book.object);
  if (!seeded.some((b) => b.style === book.style))
    throw new Error(t("error.source"));
  return {
    url: "/samples/" + book.style + "." + book.type.toLowerCase(),
    release() {},
  };
}
export async function original(book: Book) {
  const source = await bookSource(book);
  try {
    const r = await fetch(source.url);
    if (!r.ok) throw new Error(t("error.readOriginal"));
    return await r.blob();
  } finally {
    source.release();
  }
}
