import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFPageProxy,
  type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import worker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import pageStyle from "./pdf-page.css?inline";
import { t } from "../i18n";
import type { SearchHit } from "./engine";
import { loadSearch, searchLimit } from "./search";

GlobalWorkerOptions.workerSrc = worker;

function pageFrame(
  page: PDFPageProxy,
  signal: AbortSignal,
  fail: (error: unknown) => void,
) {
  const { width, height } = page.getViewport({ scale: 1 });
  const data = `<!doctype html><meta name="viewport" content="width=${width},height=${height}"><style>${pageStyle}</style><canvas aria-label="${t("reader.page", { number: page.pageNumber })}"></canvas><div class="textLayer"></div>`;
  // The fixed-layout renderer can display a cached and a fresh frame for the
  // same page during a layout change. Each frame owns its drawing tasks.
  const frames = new WeakMap<
    Document,
    { scale: number; cancel(): void; done: Promise<void> }
  >();
  return {
    src: "about:blank",
    data,
    onZoom({ doc, scale }: { doc: Document; scale: number }) {
      if (!doc?.body || signal.aborted) return;
      const previous = frames.get(doc);
      if (previous?.scale === scale) return previous.done;
      previous?.cancel();
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(
        devicePixelRatio || 1,
        2,
        Math.sqrt(12_000_000 / (viewport.width * viewport.height)),
      );
      // PDF.js registers its embedded fonts in the document that opened the
      // worker. Draw there, then move the finished bitmap into the page frame.
      const canvas = document.createElement("canvas");
      const oldCanvas = doc.querySelector("canvas")!;
      canvas.setAttribute("aria-label", oldCanvas.getAttribute("aria-label")!);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = viewport.width + "px";
      canvas.style.height = viewport.height + "px";
      const container = doc.querySelector<HTMLElement>(".textLayer")!;
      container.replaceChildren();
      container.style.setProperty("--total-scale-factor", String(scale));
      const render = page.render({
        canvas,
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      const layer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container,
        viewport,
      });
      let cancelled = false;
      const cancel = () => {
        if (cancelled) return;
        cancelled = true;
        frames.delete(doc);
        render.cancel();
        layer.cancel();
      };
      // A page can stay cached after a turn. Stop drawing as soon as its
      // frame is hidden; revisiting it will request a fresh bitmap.
      const slot = doc.defaultView?.frameElement?.parentElement;
      const visibility = new MutationObserver(() => {
        if (slot?.style.visibility === "hidden") cancel();
      });
      if (slot)
        visibility.observe(slot, {
          attributes: true,
          attributeFilter: ["style"],
        });
      signal.addEventListener("abort", cancel, { once: true });
      doc.defaultView?.addEventListener("pagehide", cancel, { once: true });
      const done = Promise.all([render.promise, layer.render()])
        .then(() => {
          if (!cancelled) {
            layer.textDivs.forEach((span, i) => {
              span.dataset.textItem = String(i);
            });
            oldCanvas.replaceWith(canvas);
            doc.dispatchEvent(new Event("pdf-text-ready"));
          }
        })
        .catch((error) => {
          if (!cancelled) fail(error);
        })
        .finally(() => {
          visibility.disconnect();
          signal.removeEventListener("abort", cancel);
          doc.defaultView?.removeEventListener("pagehide", cancel);
        });
      frames.set(doc, { scale, cancel, done });
      return done;
    },
  };
}

interface TextOffsets {
  startIndex: number;
  startOffset: number;
  endIndex: number;
  endOffset: number;
}

function pdfAnchor({
  startIndex,
  startOffset,
  endIndex,
  endOffset,
}: TextOffsets) {
  return (doc: Document) => {
    const node = (index: number) =>
      doc.querySelector(`[data-text-item="${index}"]`)?.firstChild;
    const first = node(startIndex),
      last = node(endIndex);
    if (!first || !last) return null;
    const range = doc.createRange();
    range.setStart(first, Math.min(startOffset, first.textContent!.length));
    range.setEnd(last, Math.min(endOffset, last.textContent!.length));
    return range;
  };
}

async function outlineChapters(pdf: PDFDocumentProxy) {
  const chapters: { page: number; title: string }[] = [];
  type Outline = NonNullable<
    Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>
  >;
  async function visit(items: Outline) {
    for (const item of items) {
      const dest =
        typeof item.dest === "string"
          ? await pdf.getDestination(item.dest)
          : item.dest;
      if (dest?.[0] != null && item.title) {
        const ref = dest[0];
        const page =
          typeof ref === "number"
            ? ref
            : await pdf.getPageIndex(ref).catch(() => -1);
        if (page >= 0) chapters.push({ page, title: item.title });
      }
      if (item.items.length) await visit(item.items);
    }
  }
  await visit((await pdf.getOutline()) ?? []);
  return chapters.sort((a, b) => a.page - b.page);
}

export async function openPdf(
  url: string,
  signal: AbortSignal,
  fail: (error: unknown) => void,
) {
  signal.throwIfAborted();
  const resource = (folder: string) =>
    new URL("/pdf-resources/" + folder + "/", location.href).href;
  const task = getDocument({
    url,
    useWorkerFetch: false,
    canvasMaxAreaInBytes: 48_000_000,
    cMapUrl: resource("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: resource("standard_fonts"),
    wasmUrl: resource("wasm"),
    iccUrl: resource("iccs"),
    useSystemFonts: true,
  });
  signal.addEventListener(
    "abort",
    () => {
      void task.destroy();
    },
    { once: true },
  );
  const pdf = await task.promise;
  let chapters: ReturnType<typeof outlineChapters> | undefined;
  return {
    metadata: {},
    rendition: { layout: "pre-paginated" },
    sections: Array.from({ length: pdf.numPages }, (_, i) => ({
      id: String(i),
      size: 1,
      pageSpread: i % 2 ? "right" : "left",
      load: async () => pageFrame(await pdf.getPage(i + 1), signal, fail),
    })),
    splitTOCHref: (href: string) => [href],
    getTOCFragment: () => null,
    async search(query: string, abort: AbortSignal) {
      const hits: SearchHit[] = [];
      const [{ search }, outline] = await Promise.all([
        loadSearch(),
        (chapters ??= outlineChapters(pdf).catch(() => [])),
      ]);
      for (
        let section = 0;
        section < pdf.numPages && !abort.aborted;
        section++
      ) {
        const page = await pdf.getPage(section + 1);
        const { items } = await page.getTextContent();
        if (abort.aborted) break;
        const strings = items.flatMap((item) =>
          "str" in item ? [item.str + (item.hasEOL ? " " : "")] : [],
        );
        if (!strings.length) continue;
        const chapter = outline.findLast((entry) => entry.page <= section);
        const group =
          chapter?.title ?? t("reader.page", { number: section + 1 });
        for (const { range, excerpt } of search(strings, query, {
          granularity: "grapheme",
          sensitivity: "base",
        })) {
          hits.push({
            groupId: chapter ? "outline-" + chapter.page : "page-" + section,
            group,
            section,
            target: section,
            excerpt,
            anchor: pdfAnchor(range),
          });
          if (hits.length === searchLimit) return hits;
        }
      }
      return hits;
    },
  };
}
