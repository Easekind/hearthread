import { searchPublication, highlightHit } from "./search";
import type { SearchHit } from "./engine";
import { bindSwipe } from "./swipe";
import { wheelPaging } from "./wheel";
import { t } from "../i18n";
import { useEffect, useRef } from "react";
import { readingFontFamily } from "./typography";
import { openExternal } from "./links";
import { files } from "../storage/files";
import {
  openEpub,
  loadView,
  type Publication,
  flattenToc,
  type EpubView,
  type Relocation,
} from "./foliate";
import type { EngineProps } from "./engine";
// The paginator reports a range from one chapter even when a spread shows two.
function visibleEpubAnchor(book: Publication, view: EpubView, href: string) {
  const target = book.resolveHref?.(href);
  const renderer = view.renderer;
  if (!target || renderer.localName !== "foliate-paginator") return;
  const viewport = renderer.shadowRoot
    ?.querySelector('[part="container"]')
    ?.getBoundingClientRect();
  if (!viewport) return;
  for (const { index, doc } of renderer.getContents()) {
    if (index !== target.index) continue;
    const frame = doc.defaultView?.frameElement?.getBoundingClientRect();
    const destination = target.anchor(doc);
    // A link to the whole spine item resolves to 0. Only its first column
    // contains the chapter start, including when a long section is chunked.
    if (destination === 0 && doc.querySelector('[data-foliate-chunk="0"]'))
      continue;
    const element = destination === 0 ? doc.body : destination;
    if (!frame || !element || typeof element === "number") continue;
    const rect = element.getClientRects()[0];
    if (
      !rect ||
      frame.left + rect.right <= viewport.left ||
      frame.left + rect.left >= viewport.right ||
      frame.top + rect.bottom <= viewport.top ||
      frame.top + rect.top >= viewport.bottom
    )
      continue;
    const anchor = doc.createRange();
    anchor.selectNodeContents(element);
    anchor.collapse(true);
    return view.getCFI(index, anchor);
  }
}

export default function BookView(props: EngineProps) {
  const documents = useRef(new Set<Document>()),
    fontBytes = useRef<ArrayBuffer | undefined>(undefined);
  const host = useRef<HTMLDivElement>(null),
    view = useRef<EpubView | null>(null),
    latest = useRef(props);
  const explicitJump = useRef<(() => void) | undefined>(undefined);
  latest.current = props;
  function style() {
    const { prefs } = latest.current,
      room = host.current?.closest(".reader");
    if (!room) return;
    const computed = getComputedStyle(room);
    view.current?.renderer?.setStyles?.(
      "html,body {color:" +
        computed.getPropertyValue("--reader-ink") +
        "!important;background:" +
        computed.getPropertyValue("--reader-paper") +
        "!important} body,p,li,blockquote{font-family:" +
        readingFontFamily(prefs) +
        "!important;font-size:" +
        prefs.size +
        "px!important;line-height:" +
        prefs.leading +
        "!important} img,svg{max-width:100%}",
    );
  }
  function applyLayout() {
    const renderer = view.current?.renderer;
    if (!renderer || !host.current) return;
    const dual = latest.current.prefs.pageLayout === "double";
    // Setting an unchanged attribute also triggers a full renderer layout.
    const set = (name: string, value: string) => {
      if (renderer.getAttribute(name) !== value)
        renderer.setAttribute(name, value);
    };
    if (renderer.localName === "foliate-fxl") {
      set("spread", dual ? "both" : "none");
      if (latest.current.book.type === "PDF")
        set("zoom", latest.current.wide ? "fit-width" : "fit-page");
    } else {
      const width = host.current.clientWidth;
      const columns = dual ? 2 : 1;
      // Vertical publications paginate along the height of the renderer.
      const inlineSize =
        renderer.scrollProp === "scrollTop"
          ? Math.max(1, Math.ceil(renderer.clientHeight / columns))
          : dual
            ? Math.min(680, Math.max(1, width - 1))
            : 680;
      const margin = dual ? Math.min(48, Math.round(width * 0.035)) : 48;
      set("max-inline-size", inlineSize + "px");
      set("max-column-count", String(columns));
      set("margin-left", margin + "px");
      set("margin-right", margin + "px");
    }
  }
  useEffect(() => {
    applyLayout();
    const observer = new ResizeObserver(applyLayout);
    observer.observe(host.current!);
    return () => observer.disconnect();
  }, [props.prefs.pageLayout, props.wide]);
  useEffect(() => {
    // A two-page spread can contain several headings. If the reader chose a
    // particular one, keep it visible when that spread becomes a single page.
    const frame = requestAnimationFrame(() => explicitJump.current?.());
    return () => cancelAnimationFrame(frame);
  }, [props.prefs.pageLayout]);
  function registerFont(doc: Document) {
    if (!fontBytes.current) return;
    const face = new FontFace("UserReading", fontBytes.current);
    doc.fonts.add(face);
    void face.load().catch(() => doc.fonts.delete(face));
  }
  useEffect(() => {
    let live = true;
    fontBytes.current = undefined;
    const key = props.book.type === "PDF" ? undefined : props.prefs.customFont;
    if (key)
      void files
        .url(key)
        .then(async (s) => {
          try {
            const bytes = await (await fetch(s.url)).arrayBuffer();
            if (live) {
              fontBytes.current = bytes;
              for (const doc of documents.current) registerFont(doc);
              style();
            }
          } finally {
            s.release();
          }
        })
        .catch((e) => latest.current.fail(e));
    return () => {
      live = false;
    };
  }, [props.prefs.customFont, props.book.type]);
  useEffect(() => {
    style();
  }, [props.prefs]);
  useEffect(() => {
    let live = true;
    let publication: Publication | undefined;
    const controller = new AbortController();
    const node = document.createElement("foliate-view") as EpubView;
    const el = host.current!;
    el.append(node);
    view.current = node;
    async function start() {
      await loadView();
      const format = props.book.type;
      let book: Publication;
      if (format === "PDF") {
        const { openPdf } = await import("./pdf");
        book = await openPdf(props.source, controller.signal, (error) => {
          if (live) latest.current.fail(error);
        });
      } else {
        const response = await fetch(props.source, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            t(format === "MD" ? "error.markdownRead" : "error.epubRead"),
          );
        if (format === "MD") {
          const { openMarkdown } = await import("./markdown");
          book = openMarkdown(await response.text(), props.book.title);
        } else
          book = await openEpub(
            new File([await response.blob()], props.book.filename),
          );
      }
      if (!live) {
        book.destroy?.();
        return;
      }
      publication = book;
      node.addEventListener("external-link", (e) => {
        e.preventDefault();
        const href = (e as CustomEvent).detail.href;
        if (/^(?:https?:|mailto:)/i.test(href)) void openExternal(href);
      });
      node.addEventListener("link", () => {
        explicitJump.current = undefined;
      });
      let activeHit: SearchHit | undefined;
      let pending = Promise.resolve();
      const turn = (direction: number) => {
        explicitJump.current = undefined;
        // The paginator ignores navigation while a previous turn is settling.
        pending = pending
          .then(async () => {
            if (!live) return;
            if (direction > 0) await node.next();
            else await node.prev();
          })
          .catch((error) => {
            if (live) latest.current.fail(error);
          });
      };
      const wheel = wheelPaging(node, turn, controller.signal);
      bindSwipe(el, node, turn, controller.signal);
      el.addEventListener("wheel", wheel, {
        passive: false,
        signal: controller.signal,
      });
      node.addEventListener("load", (e) => {
        const doc: Document = (e as CustomEvent).detail.doc;
        for (const old of documents.current)
          if (!old.defaultView?.frameElement?.isConnected)
            documents.current.delete(old);
        documents.current.add(doc);
        doc.addEventListener("pdf-text-ready", () => {
          if (live && activeHit) highlightHit(node, activeHit);
        });
        if (format !== "PDF") {
          registerFont(doc);
          const style = doc.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "style",
          );
          style.textContent =
            "::highlight(found-passage){background-color:#f2c56e;color:#302214;text-decoration:underline}";
          doc.head?.append(style);
        }
        bindSwipe(doc.documentElement, node, turn);
        doc.addEventListener("wheel", wheel, { passive: false });
        doc.addEventListener("click", (e) => {
          if (
            doc.getSelection()?.isCollapsed &&
            !(e.target as Element).closest("a,button")
          )
            latest.current.toggle();
        });
        doc.addEventListener("keydown", (e) => {
          if (
            e.key === "Enter" &&
            (e.target as Element).closest?.("a,button,input")
          )
            return;
          if (
            ["ArrowLeft", "ArrowRight", "Escape", "Enter"].includes(e.key) ||
            (e.key === "f" && (e.metaKey || e.ctrlKey))
          ) {
            e.preventDefault();
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: e.key,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
              }),
            );
          }
        });
      });
      const toc = flattenToc(book.toc ?? []).filter((item) => item.href);
      const tocIndex = new Map(toc.map((item, index) => [item, index]));
      let selected = props.book.sectionIndex ?? -1;
      let searchHit: ReturnType<EpubView["resolveCFI"]> | undefined;
      let pageRequest = 0;
      node.addEventListener("relocate", (e) => {
        if (!live) return;
        applyLayout();
        const p = (e as CustomEvent<Relocation>).detail;
        const section = p.section?.current ?? 0;
        if (activeHit) highlightHit(node, activeHit);
        const renderer = node.renderer;
        if (renderer.getPageRange) {
          const request = ++pageRequest;
          latest.current.pages([]);
          void renderer
            .getPageRange(
              fontBytes.current ? latest.current.prefs.customFont : undefined,
              (doc) => {
                doc.documentElement.lang ||= node.language.canonical ?? "";
                if (!node.language.isCJK)
                  doc.documentElement.dir ||= node.language.direction ?? "";
                registerFont(doc);
              },
            )
            .then((range) => {
              if (live && request === pageRequest)
                latest.current.pages(range ?? []);
            })
            .catch(() => {
              if (live && request === pageRequest) latest.current.pages([]);
            });
        } else {
          const visible =
            renderer.columnCount > 1
              ? renderer
                  .getContents()
                  .map(({ index }) => index)
                  .filter(Number.isInteger)
                  .sort((a, b) => a - b)
              : [section];
          latest.current.pages(visible.map((index) => index + 1));
        }
        if (format === "PDF") {
          latest.current.position({
            index: section,
            location: String(section + 1),
            chapter: "",
            progress: Math.round(((section + 1) * 100) / book.sections.length),
          });
          return;
        }
        let index = section;
        let location = p.cfi;
        if (toc.length) {
          const last = p.tocItem ? (tocIndex.get(p.tocItem) ?? -1) : -1;
          let first = last;
          if (p.range) {
            const start = p.range.cloneRange();
            start.collapse(true);
            const item = node.getProgressOf(section, start).tocItem;
            first = item ? (tocIndex.get(item) ?? last) : -1;
            if (searchHit?.index === section) {
              const range = searchHit.anchor(
                start.startContainer.ownerDocument!,
              );
              const hit = range && node.getProgressOf(section, range).tocItem;
              selected = hit ? (tocIndex.get(hit) ?? -1) : -1;
              searchHit = undefined;
            }
          }
          // A page or spread may contain several entries. Keep an explicit
          // destination while it is on screen, then follow the start of the page.
          if (first === -1 && last >= 0) first = 0;
          const anchor =
            format === "EPUB" && toc[selected]
              ? visibleEpubAnchor(book, node, toc[selected].href)
              : undefined;
          if (anchor) location = anchor;
          index =
            anchor || (selected >= 0 && selected >= first && selected <= last)
              ? selected
              : first;
        }
        if (book.textPosition) {
          const range =
            p.range && node.resolveCFI(p.cfi).anchor(book.textPosition.doc);
          location = String(range ? book.textPosition.fractionAt(range) : 0);
        }
        latest.current.position({
          location,
          chapter: toc[index]?.label ?? "",
          progress: Math.round((p.fraction || 0) * 100),
          index,
        });
      });
      if (book.rendition?.layout === "pre-paginated")
        book.rendition.spread =
          latest.current.prefs.pageLayout === "double" ? "both" : "none";
      node.classList.toggle(
        "reflowable",
        book.rendition?.layout !== "pre-paginated",
      );
      await node.open(book);
      if (!live) {
        node.close();
        return;
      }
      node.renderer.setAttribute("no-swipe", "");
      applyLayout();
      style();
      let lastLocation: number | string | undefined = props.book.location;
      if (format === "PDF") {
        const page = Number(lastLocation) || 1;
        lastLocation = Math.max(
          0,
          Math.min(book.sections.length - 1, page - 1),
        );
      } else if (book.textPosition) {
        const anchor = book.textPosition.rangeAt(Number(lastLocation) || 0);
        lastLocation = anchor ? node.getCFI(0, anchor) : undefined;
      } else if (!props.book.location?.startsWith("epubcfi(")) {
        lastLocation = toc[props.book.sectionIndex ?? -1]?.href;
      }
      await node.init({ lastLocation, showTextStart: true });
      if (!live) return;
      const contents = toc.length
        ? toc.map((item) => ({ target: item.href, label: item.label }))
        : format === "MD"
          ? []
          : book.sections.map((_, i) => ({
              target: i,
              label: t(format === "PDF" ? "reader.page" : "reader.chapter", {
                number: i + 1,
              }),
            }));
      latest.current.ready(
        {
          turn,
          clearHighlight() {
            activeHit = undefined;
            highlightHit(node);
          },
          go: (target, hit) => {
            activeHit = hit;
            highlightHit(node, hit);
            const jump = () => {
              selected = toc.findIndex((item) => item.href === target);
              searchHit =
                typeof target === "string" && target.startsWith("epubcfi(")
                  ? node.resolveCFI(target)
                  : undefined;
              void node.goTo(target).then(() => {
                if (live && hit && activeHit === hit)
                  highlightHit(node, hit, true);
              });
            };
            if (format === "MD") explicitJump.current = jump;
            jump();
          },
          search(query, signal) {
            return searchPublication(
              book,
              node,
              query,
              signal,
              props.book.title,
            );
          },
        },
        contents,
      );
    }
    start().catch((e) => {
      if (live) latest.current.fail(e);
    });
    return () => {
      live = false;
      explicitJump.current = undefined;
      controller.abort();
      if (node.renderer) node.close();
      publication?.destroy?.();
      node.remove();
      documents.current.clear();
      view.current = null;
    };
  }, [props.source]);
  return (
    <div
      className={
        "book-surface" + (props.book.type === "PDF" ? " pdf-surface" : "")
      }
      ref={host}
    />
  );
}
