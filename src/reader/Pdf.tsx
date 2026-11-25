import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
  TextLayer,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import worker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { EngineProps, Destination } from "./engine";
GlobalWorkerOptions.workerSrc = worker;
export default function Pdf(props: EngineProps) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    text = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [doc, setDoc] = useState<PDFDocumentProxy>(),
    [page, setPage] = useState(Number(props.book.location) || 1),
    [width, setWidth] = useState(0);
  useEffect(() => {
    let live = true;
    const resource = (folder: string) =>
      new URL("/pdf-resources/" + folder + "/", location.href).href;
    const task = getDocument({
      url: props.source,
      useWorkerFetch: false,
      canvasMaxAreaInBytes: 48_000_000,
      cMapUrl: resource("cmaps"),
      cMapPacked: true,
      standardFontDataUrl: resource("standard_fonts"),
      wasmUrl: resource("wasm"),
      iccUrl: resource("iccs"),
      useSystemFonts: true,
    });
    task.promise
      .then((pdf) => {
        if (!live) return;
        setDoc(pdf);
        const clamp = (n: number) => Math.min(pdf.numPages, Math.max(1, n));
        setPage((p) => clamp(p));
        latest.current.ready(
          {
            turn: (d) => setPage((p) => clamp(p + d)),
            go: (t) => setPage(clamp(Number(t) + 1)),
            async search(q, signal) {
              const hits: Destination[] = [];
              for (
                let i = 1;
                i <= pdf.numPages && !signal.aborted && hits.length < 150;
                i++
              ) {
                const pdfPage = await pdf.getPage(i);
                const content = await pdfPage.getTextContent();
                const body = content.items
                    .map((o) => ("str" in o ? o.str : ""))
                    .join(" "),
                  at = body.toLowerCase().indexOf(q.toLowerCase());
                if (at >= 0)
                  hits.push({
                    label:
                      t("reader.page", { number: i }) +
                      " · " +
                      body.slice(Math.max(0, at - 24), at + 64),
                    target: i - 1,
                  });
              }
              return hits;
            },
          },
          Array.from({ length: pdf.numPages }, (_, i) => ({
            label: t("reader.page", { number: i + 1 }),
            target: i,
          })),
          pdf.numPages,
        );
      })
      .catch((e) => {
        if (live) latest.current.fail(e);
      });
    return () => {
      live = false;
      void task.destroy();
    };
  }, [props.source]);
  useEffect(() => {
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    ro.observe(host.current!);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!doc || !width) return;
    let live = true,
      render: RenderTask | undefined,
      layer: TextLayer | undefined;
    async function draw() {
      const p = await doc!.getPage(page);
      if (!live) return;
      const base = p.getViewport({ scale: 1 }),
        scale = props.wide
          ? width / base.width
          : Math.min(
              width / base.width,
              (window.innerHeight - 36) / base.height,
            );
      const viewport = p.getViewport({ scale }),
        ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(12_000_000 / (viewport.width * viewport.height)),
        );
      const target = canvas.current!,
        container = text.current!;
      target.width = Math.ceil(viewport.width * ratio);
      target.height = Math.ceil(viewport.height * ratio);
      target.style.width = viewport.width + "px";
      target.style.height = viewport.height + "px";
      container.style.setProperty("--total-scale-factor", String(scale));
      container.replaceChildren();
      render = p.render({
        canvas: target,
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      layer = new TextLayer({
        textContentSource: p.streamTextContent(),
        container,
        viewport,
      });
      await Promise.all([render.promise, layer.render()]);
      if (live)
        latest.current.position({
          location: String(page),
          chapter: "",
          progress: Math.round((page / doc!.numPages) * 100),
          index: page - 1,
        });
    }
    draw().catch((e) => {
      if (live) latest.current.fail(e);
    });
    return () => {
      live = false;
      render?.cancel();
      layer?.cancel();
    };
  }, [doc, width, page, props.wide]);
  return (
    <div ref={host} className="pdf-document">
      <div className="pdf-sheet">
        <canvas ref={canvas} aria-label={t("reader.page", { number: page })} />
        <div className="textLayer" ref={text} />
      </div>
    </div>
  );
}
