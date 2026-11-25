import type { Locale } from "./i18n";

export type Format = "EPUB" | "PDF" | "MD";
export const themeOptions = ["light", "paper", "dark", "system"] as const;
export type Theme = (typeof themeOptions)[number];
export interface Book {
  id: string;
  title: string;
  en: string;
  author: string;
  type: Format;
  folder: string;
  style: string;
  progress: number;
  chapter: string;
  sectionIndex?: number;
  size: string;
  pinned: boolean;
  readAt: number;
  added: number;
  filename: string;
  object?: string;
  cover?: string;
  location?: string;
  deleted?: boolean;
}
export interface Preferences {
  locale: Locale;
  theme: Theme;
  paper: Theme;
  pageLayout: "single" | "double";
  size: number;
  leading: number;
  fontCategory: "serif" | "sans";
  fontFamily: string;
  view: "grid" | "list";
  sort: "recent" | "added" | "title";
  customFont?: string;
}
export interface Catalog {
  books: Book[];
  folders: string[];
  prefs: Preferences;
}
export const defaults: Preferences = {
  locale: "en",
  theme: "light",
  paper: "light",
  pageLayout: "single",
  size: 20,
  leading: 1.95,
  fontCategory: "serif",
  fontFamily: "default",
  customFont: undefined,
  view: "grid",
  sort: "recent",
};
export const defaultFolders = ["文学与随笔", "设计与技术", "随手收藏"];
