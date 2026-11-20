export type Format = "EPUB" | "PDF" | "MD";
export type Paper = "light" | "paper" | "dark";
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
  theme: Paper;
  paper: Paper;
  size: number;
  leading: number;
  chinese: string;
  latin: string;
  system: boolean;
  reduce: boolean;
  view: "grid" | "list";
  sort: "recent" | "added" | "title";
  customFont?: string;
  tint?: string;
}
export interface Catalog {
  books: Book[];
  folders: string[];
  prefs: Preferences;
}
export const defaults: Preferences = {
  theme: "light",
  paper: "light",
  size: 20,
  leading: 1.95,
  chinese: "serif",
  latin: "serif",
  system: false,
  reduce: false,
  view: "grid",
  sort: "recent",
};
export const defaultFolders = ["文学与随笔", "设计与技术", "随手收藏"];
