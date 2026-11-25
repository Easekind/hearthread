import { t, type MessageKey } from "../i18n";
import type { Book } from "../model";

const collectionLabels = new Map<string, MessageKey>([
  ["文学与随笔", "collection.literature"],
  ["设计与技术", "collection.design"],
  ["随手收藏", "collection.saved"],
]);

export function collectionName(name: string) {
  const key = collectionLabels.get(name);
  return key ? t(key) : name;
}

export function chapterLabel(book: Book) {
  if (book.type === "PDF" && (!book.object || book.location)) {
    return t("reader.page", { number: book.object ? book.location : 3 });
  }
  if (!book.chapter && book.sectionIndex !== undefined)
    return t("reader.chapter", { number: book.sectionIndex + 1 });
  if (book.object && !book.location && !book.progress) return "";
  return book.chapter;
}
