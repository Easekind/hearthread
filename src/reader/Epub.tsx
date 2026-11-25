import { useEffect, useRef } from "react";
import { readingFontFamily } from "./typography";
import { openExternal } from "./links";
import { files } from "../storage/files";
import {
  openEpub,
  flattenToc,
  type EpubView,
  type Relocation,
} from "./foliate";
import type { EngineProps } from "./engine";
export default function Epub(props: EngineProps) {
  const documents = useRef(new Set<Document>()),
    fontBytes = useRef<ArrayBuffer | undefined>(undefined);
  const host = useRef<HTMLDivElement>(null),
    view = useRef<EpubView | null>(null),
    latest = useRef(props);
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
  function registerFont(doc: Document) {
    if (!fontBytes.current) return;
    const face = new FontFace("UserReading", fontBytes.current);
    doc.fonts.add(face);
    void face.load().catch(() => doc.fonts.delete(face));
  }
  useEffect(() => {
    let live = true;
    fontBytes.current = undefined;
    const key = props.prefs.customFont;
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
  }, [props.prefs.customFont]);
  useEffect(() => {
    style();
  }, [props.prefs]);
  useEffect(() => {
    let live = true;
    let publication: Awaited<ReturnType<typeof openEpub>> | undefined;
    const controller = new AbortController();
    const node = document.createElement("foliate-view") as EpubView;
    const el = host.current!;
    el.append(node);
    view.current = node;
    async function start() {
      const response = await fetch(props.source, { signal: controller.signal });
      if (!response.ok) throw new Error("读取 EPUB 失败");
      const book = await openEpub(
        new File([await response.blob()], props.book.filename),
      );
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
      node.addEventListener("load", (e) => {
        const doc: Document = (e as CustomEvent).detail.doc;
        for (const old of documents.current)
          if (!old.defaultView?.frameElement?.isConnected)
            documents.current.delete(old);
        documents.current.add(doc);
        registerFont(doc);
        let startX = 0,
          startY = 0,
          swiped = false;
        doc.addEventListener(
          "touchstart",
          (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            swiped = false;
          },
          { passive: true },
        );
        doc.addEventListener(
          "touchend",
          (e) => {
            const dx = e.changedTouches[0].clientX - startX;
            if (
              Math.abs(dx) > 48 &&
              Math.abs(dx) >
                Math.abs(e.changedTouches[0].clientY - startY) * 1.5
            ) {
              swiped = true;
              void (dx < 0 ? node.next() : node.prev());
            }
          },
          { passive: true },
        );
        doc.addEventListener("click", (e) => {
          if (
            !swiped &&
            doc.getSelection()?.isCollapsed &&
            !(e.target as Element).closest("a,button")
          )
            latest.current.toggle();
          swiped = false;
        });
        doc.addEventListener("keydown", (e) => {
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
      node.addEventListener("relocate", (e) => {
        if (!live) return;
        const p = (e as CustomEvent<Relocation>).detail,
          index = p.section?.current ?? 0;
        latest.current.position({
          location: p.cfi,
          chapter: p.tocItem?.label ?? "第 " + (index + 1) + " 章",
          progress: Math.round((p.fraction || 0) * 100),
          index,
        });
      });
      await node.open(book);
      if (!live) {
        node.close();
        return;
      }
      node.renderer.setAttribute("max-inline-size", "680px");
      node.renderer.setAttribute("max-column-count", "1");
      style();
      await node.init({
        lastLocation: props.book.location,
        showTextStart: true,
      });
      if (!live) return;
      const sections = book.sections.map((_, i) => ({
        target: i,
        label: "第 " + (i + 1) + " 章",
      }));
      const toc = flattenToc(book.toc ?? []).map((t) => ({
        target: t.href,
        label: t.label,
      }));
      latest.current.ready(
        {
          turn: (d) => void (d < 0 ? node.prev() : node.next()),
          go: (t) => void node.goTo(t),
          async search(query, signal) {
            const hits = [];
            for await (const group of node.search({ query })) {
              if (signal.aborted) break;
              if (typeof group !== "string")
                for (const hit of group.subitems ?? []) {
                  hits.push({
                    label:
                      hit.excerpt.pre + hit.excerpt.match + hit.excerpt.post,
                    target: hit.cfi,
                  });
                }
              if (hits.length >= 150) break;
            }
            return hits.slice(0, 150);
          },
        },
        toc.length ? toc : sections,
        sections.length,
      );
    }
    start().catch((e) => {
      if (live) latest.current.fail(e);
    });
    return () => {
      live = false;
      controller.abort();
      if (node.renderer) node.close();
      publication?.destroy?.();
      node.remove();
      documents.current.clear();
      view.current = null;
    };
  }, [props.source]);
  return <div className="epub-surface" ref={host} />;
}
