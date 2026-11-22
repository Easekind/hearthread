import type { Book, Preferences } from "../model";
export interface Destination {
  label: string;
  target: string | number;
}
export interface Position {
  location: string;
  chapter: string;
  progress: number;
  index: number;
}
export interface ReaderEngine {
  capture?(): Position;
  turn(direction: number): void;
  go(target: string | number): void;
  search(query: string, signal: AbortSignal): Promise<Destination[]>;
}
export interface EngineProps {
  book: Book;
  prefs: Preferences;
  source: string;
  wide: boolean;
  ready(api: ReaderEngine, contents: Destination[], pages: number): void;
  position(p: Position): void;
  toggle(): void;
  fail(e: unknown): void;
}
