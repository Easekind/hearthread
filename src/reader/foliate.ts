import type { ReaderEngine } from "./engine";
import { t } from "../i18n";
interface Toc {
  label: string;
  href: string;
  subitems?: Toc[];
}
interface Section {
  id: string;
  linear?: string;
  createDocument?(): Document | Promise<Document>;
}
export interface Publication {
  textPosition?: {
    doc: Document;
    fractionAt(range: Range): number;
    rangeAt(fraction: number): Range | undefined;
  };
  search?: ReaderEngine["search"];
  rendition?: { layout?: string; spread?: string };
  metadata: {
    title?: string;
    author?: string | Array<string | { name: string }>;
  };
  sections: Section[];
  toc?: Toc[];
  getCover?(): Promise<Blob | null>;
  destroy?(): void;
  resolveHref?(
    href: string,
  ): { index: number; anchor(doc: Document): Element | number | null } | null;
  transformTarget?: EventTarget;
}
export interface Relocation {
  fraction: number;
  cfi: string;
  range?: Range;
  section?: { current: number; total: number };
  tocItem?: Toc;
}
export interface EpubView extends HTMLElement {
  language: { canonical?: string; direction?: string; isCJK: boolean };
  open(b: Publication): Promise<void>;
  init(o: {
    lastLocation?: string | number;
    showTextStart: boolean;
  }): Promise<void>;
  close(): void;
  goTo(t: string | number): Promise<void>;
  getCFI(index: number, range?: Range): string;
  resolveCFI(cfi: string): {
    index: number;
    anchor(doc: Document): Range | null;
  };
  getProgressOf(index: number, range: Range): { tocItem?: Toc };
  prev(): Promise<void>;
  next(): Promise<void>;
  renderer: HTMLElement & {
    getPageRange?(
      fontKey?: string,
      prepare?: (doc: Document) => void,
    ): Promise<number[] | undefined>;
    readonly columnCount: number;
    readonly rtl: boolean;
    readonly scrollProp?: "scrollLeft" | "scrollTop";
    getContents(): { index: number; doc: Document }[];
    setStyles?(css: string): void;
    setAttribute(key: string, value: string): void;
  };
  lastLocation?: Relocation;
}
const modulePath = new URL("/foliate/view.js", location.href).href;
export const loadView = () => import(/* @vite-ignore */ modulePath);
export async function openEpub(file: File): Promise<Publication> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] !== 80 || head[1] !== 75) throw new Error(t("error.invalidEpub"));
  const { makeBook } = await loadView();
  const book: Publication = await makeBook(file);
  if (!book.sections?.length || !book.transformTarget)
    throw new Error(t("error.noChapters"));
  book.transformTarget.addEventListener("load", (e) => {
    const detail = (e as CustomEvent).detail;
    if (detail.isScript) detail.allow = false;
  });
  // Keep publication markup passive, including in development WebViews.
  book.transformTarget.addEventListener("data", (e) => {
    const d = (e as CustomEvent).detail;
    if (
      !["application/xhtml+xml", "text/html", "image/svg+xml"].includes(d.type)
    )
      return;
    d.data = Promise.resolve(d.data).then(async (value) => {
      const input = value instanceof Blob ? await value.text() : String(value);
      const doc = new DOMParser().parseFromString(input, d.type);
      for (const node of doc.querySelectorAll(
        "script,iframe,frame,object,embed,form,base,meta[http-equiv],foreignObject,processing-instruction",
      ))
        node.remove();
      for (const el of doc.querySelectorAll("*"))
        // Removing an attribute shifts later entries in the live collection.
        for (let i = el.attributes.length - 1; i >= 0; i--) {
          const attr = el.attributes[i];
          if (
            /^on/i.test(attr.localName) ||
            (["href", "src", "action", "data"].includes(attr.localName) &&
              /^\s*(?:javascript|vbscript):/i.test(attr.value))
          )
            el.removeAttributeNode(attr);
        }
      const head = doc.querySelector("head");
      if (head) {
        const meta = doc.createElementNS(head.namespaceURI, "meta");
        meta.setAttribute("http-equiv", "Content-Security-Policy");
        meta.setAttribute(
          "content",
          "default-src 'none'; script-src 'none'; object-src 'none'; frame-src 'none'; img-src blob: data:; media-src blob: data:; font-src blob: data:; style-src 'unsafe-inline' blob:; form-action 'none'; base-uri 'none'",
        );
        head.prepend(meta);
      }
      return new XMLSerializer().serializeToString(doc);
    });
  });
  return book;
}
export function flattenToc(toc: Toc[]): Toc[] {
  return toc.flatMap((item) => [item, ...flattenToc(item.subitems ?? [])]);
}
