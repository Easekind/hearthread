import { t, locales } from "../i18n";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { z } from "zod";
import { files } from "./files";
import { catalog, update } from "./catalog";
import { saveFile } from "./transfer";
import { defaults, themeOptions, type Catalog } from "../model";
import { isSystemFont, typeLimits } from "../reader/typography";
import edition from "../library/edition.json";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string(),
  numeric = z.number().finite();
const book = z
  .object({
    id: text,
    title: text,
    en: text,
    author: text,
    type: z.enum(["EPUB", "PDF", "MD"]),
    folder: text,
    style: text,
    progress: numeric.min(0).max(100),
    chapter: text,
    sectionIndex: z.number().int().nonnegative().optional(),
    size: text,
    pinned: z.boolean(),
    readAt: numeric,
    added: numeric,
    filename: text,
    object: digest.optional(),
    cover: digest.optional(),
    location: text.optional(),
    deleted: z.boolean().optional(),
  })
  .refine((b) =>
    b.object
      ? b.id === b.object && b.style === "imported"
      : edition.some(
          (sample) =>
            String(sample.id) === b.id &&
            sample.style === b.style &&
            sample.type === b.type,
        ),
  );
const backupVersion = 2;
const schema = z.object({
  version: z.literal(backupVersion),
  books: z.array(book),
  folders: z.array(text).min(1),
  prefs: z
    .object({
      locale: z.enum(locales).default(defaults.locale),
      theme: z.enum(themeOptions),
      paper: z.enum(themeOptions),
      pageLayout: z.enum(["single", "double"]).default(defaults.pageLayout),
      size: numeric.min(typeLimits.size.min).max(typeLimits.size.max),
      leading: numeric.min(typeLimits.leading.min).max(typeLimits.leading.max),
      fontCategory: z.enum(["serif", "sans"]),
      fontFamily: text,
      view: z.enum(["grid", "list"]),
      sort: z.enum(["recent", "added", "title"]),
      customFont: digest.optional(),
    })
    .refine(
      (p) =>
        p.fontFamily === "default" ||
        (p.fontFamily === "custom" && !!p.customFont) ||
        isSystemFont(p.fontCategory, p.fontFamily),
    ),
});
const keys = (s: Catalog) =>
  new Set(
    [...s.books.flatMap((b) => [b.object, b.cover]), s.prefs.customFont].filter(
      (key): key is string => !!key,
    ),
  );
export async function backup() {
  const snapshot = catalog.get(),
    entries: Record<string, Uint8Array> = {
      "catalog.json": strToU8(
        JSON.stringify({ version: backupVersion, ...snapshot }),
      ),
    };
  for (const key of keys(snapshot)) {
    const object = await files.url(key);
    try {
      const res = await fetch(object.url);
      if (!res.ok) throw new Error(t("error.backupRead"));
      entries["objects/" + key] = new Uint8Array(await res.arrayBuffer());
    } finally {
      object.release();
    }
  }
  return saveFile(
    "hearthread-backup.zip",
    new Blob([new Uint8Array(zipSync(entries, { level: 0 }))]),
  );
}
export async function restore(file: File) {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (f) =>
      f.name === "catalog.json" || /^objects\/[a-f0-9]{64}$/.test(f.name),
  });
  if (!entries["catalog.json"]) throw new Error(t("error.manifest"));
  const snapshot = schema.parse(JSON.parse(strFromU8(entries["catalog.json"])));
  for (const key of keys(snapshot)) {
    const bytes = entries["objects/" + key];
    if (!bytes || (await files.put(new Blob([new Uint8Array(bytes)]))) !== key)
      throw new Error(t("error.verify"));
  }
  await update((s) => {
    const merged = new Map(s.books.map((b) => [b.id, b]));
    snapshot.books.forEach((b) => merged.set(b.id, b));
    return {
      books: [...merged.values()],
      folders: [...new Set([...s.folders, ...snapshot.folders])],
      prefs: { ...defaults, ...snapshot.prefs },
    };
  });
}
