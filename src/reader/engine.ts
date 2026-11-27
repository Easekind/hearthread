import type { Book, Preferences } from "../model";
export interface Destination {
  label: string;
  target: string | number;
}
export interface SearchHit {
  groupId: string;
  group: string;
  excerpt: { pre: string; match: string; post: string };
  section: number;
  target: string | number;
  anchor(doc: Document): Range | null;
}
export interface Position {
  location: string;
  chapter: string;
  progress: number;
  index: number;
}
export interface ReaderEngine {
  turn(direction: number): void;
  go(target: string | number, hit?: SearchHit): void;
  clearHighlight(): void;
  search(query: string, signal: AbortSignal): Promise<SearchHit[]>;
}
export interface EngineProps {
  book: Book;
  prefs: Preferences;
  source: string;
  wide: boolean;
  ready(api: ReaderEngine, contents: Destination[]): void;
  pages(range: number[]): void;
  position(p: Position): void;
  toggle(): void;
  fail(e: unknown): void;
}
