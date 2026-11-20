import { isTauri } from "@tauri-apps/api/core";
import { files } from "./files";
import { original, update } from "./catalog";
import type { Book, Format } from "../model";
function localizedText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const labels = value as Record<string, unknown>;
  return (
    [
      labels[navigator.language],
      labels.zh,
      labels.en,
      ...Object.values(labels),
    ].find((v): v is string => typeof v === "string") ?? ""
  );
}
export function format(name: string): Format | undefined {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "epub") return "EPUB";
  if (ext === "pdf") return "PDF";
  if (ext === "md" || ext === "markdown") return "MD";
}
export async function importBooks(pending: File[], folder: string) {
  const entries: Book[] = [];
  for (const file of pending) {
    const type = format(file.name);
    if (!type || !file.size) throw new Error("无法导入空文件或不支持的格式");
    let title = file.name.replace(/\.[^.]+$/, ""),
      author = "",
      cover: string | undefined;
    if (type === "EPUB") {
      const { openEpub } = await import("../reader/foliate");
      const book = await openEpub(file);
      try {
        title = localizedText(book.metadata.title) || title;
        author = [book.metadata.author ?? []]
          .flat()
          .map((a) => (typeof a === "string" ? a : localizedText(a.name)))
          .filter(Boolean)
          .join("、");
        const image = await book.getCover?.();
        if (
          image &&
          ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
            image.type,
          )
        )
          cover = await files.put(image);
      } finally {
        book.destroy?.();
      }
    } else if (type === "PDF") {
      const signature = await file.slice(0, 1024).text();
      if (!signature.includes("%PDF-"))
        throw new Error(file.name + " 缺少 PDF 文件头");
    }
    const key = await files.put(file);
    entries.push({
      id: key,
      object: key,
      cover,
      filename: file.name,
      title,
      en: file.name,
      author,
      type,
      style: "imported",
      folder,
      readAt: 0,
      added: Date.now(),
      progress: 0,
      chapter: "尚未开始",
      size:
        file.size >= 1048576
          ? (file.size / 1048576).toFixed(1) + " MB"
          : Math.ceil(file.size / 1024) + " KB",
      pinned: false,
    });
  }
  let added = 0;
  await update((s) => {
    const books = new Map(s.books.map((b) => [b.id, b]));
    for (const entry of entries) {
      const old = books.get(entry.id);
      if (old && !old.deleted) continue;
      books.set(entry.id, { ...old, ...entry });
      added++;
    }
    return { books: [...books.values()] };
  });
  return added;
}
export async function saveFile(name: string, blob: Blob) {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: name.replace(/[/\\:]/g, "_") });
    if (!path) return false;
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return true;
}
export async function exportBooks(books: Book[]) {
  if (books.length === 1)
    return saveFile(books[0].filename, await original(books[0]));
  const { zipSync } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  for (const b of books)
    entries[b.id + "/" + b.filename.replace(/[/\\]/g, "_")] = new Uint8Array(
      await (await original(b)).arrayBuffer(),
    );
  return saveFile(
    "hearthread-books.zip",
    new Blob([new Uint8Array(zipSync(entries, { level: 0 }))]),
  );
}
