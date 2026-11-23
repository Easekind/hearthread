import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { z } from "zod";
import { files } from "./files";
import { catalog, update } from "./catalog";
import { saveFile } from "./transfer";
import { defaults, type Catalog } from "../model";
import edition from "../library/edition.json";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const paper = z.enum(["light", "paper", "dark"]);
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
const font = z.enum(["serif", "sans", "custom"]);
const schema = z.object({
  version: z.literal(1),
  books: z.array(book),
  folders: z.array(text).min(1),
  prefs: z.object({
    theme: paper,
    paper: paper,
    size: numeric.min(16).max(30),
    leading: numeric.min(1.5).max(2.4),
    chinese: font,
    latin: font,
    system: z.boolean(),
    view: z.enum(["grid", "list"]),
    sort: z.enum(["recent", "added", "title"]),
    customFont: digest.optional(),
    tint: text.regex(/^#[0-9a-f]{6}$/i).optional(),
  }),
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
      "catalog.json": strToU8(JSON.stringify({ version: 1, ...snapshot })),
    };
  for (const key of keys(snapshot)) {
    const object = await files.url(key);
    try {
      const res = await fetch(object.url);
      if (!res.ok) throw new Error("无法读取备份文件");
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
  if (!entries["catalog.json"]) throw new Error("找不到书库清单");
  const snapshot = schema.parse(JSON.parse(strFromU8(entries["catalog.json"])));
  for (const key of keys(snapshot)) {
    const bytes = entries["objects/" + key];
    if (!bytes || (await files.put(new Blob([new Uint8Array(bytes)]))) !== key)
      throw new Error("备份文件校验失败");
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
