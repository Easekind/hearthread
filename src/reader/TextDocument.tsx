import { t } from "../i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import { textViewport, visiblePassage } from "./textViewport";
import { openExternal } from "./links";
import remarkGfm from "remark-gfm";
import chapters from "./chapters.json";
import pdfSample from "./pdf-sample.html?raw";
import type { EngineProps } from "./engine";
export default function TextDocument(props: EngineProps) {
  const specimen = props.book.type === "EPUB",
    pdf = props.book.type === "PDF";
  const [chapter, setChapter] = useState(
    specimen
      ? Math.min(
          3,
          Math.max(
            0,
            props.book.location
              ? Number(props.book.location.split("/")[0])
              : props.book.progress >= 60
                ? 2
                : props.book.progress >= 30
                  ? 1
                  : 0,
          ),
        )
      : 0,
  );
  const [document, setDocument] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const dual = props.prefs.pageLayout === "double" && !pdf;
  const resume = useRef(
    Number(
      specimen ? props.book.location?.split("/")[1] : props.book.location,
    ) || 0,
  );
  const pending = useRef(-1);
  const selectedPassage = useRef<HTMLElement | undefined>(undefined);
  const restoredSection = useRef(props.book.sectionIndex);
  useEffect(() => {
    if (specimen || pdf) return;
    const abort = new AbortController();
    fetch(props.source, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error(t("error.markdownRead"));
        return r.text();
      })
      .then(setDocument)
      .catch((e) => {
        if (!abort.signal.aborted) latest.current.fail(e);
      });
    return () => abort.abort();
  }, [props.source, specimen, pdf]);
  useLayoutEffect(() => {
    if (!specimen && !pdf && document === null) return;
    const content = root.current!;
    const headings = [...content.querySelectorAll<HTMLElement>("h2")];
    const nodes = () => [
      ...content.querySelectorAll<HTMLElement>("p,li,blockquote,h1,h2,td"),
    ];
    const viewport = textViewport(content, dual);
    // The previous layout is still active here, so its visible passage can be
    // located again after the columns have changed.
    const oldLayout = content.dataset.layout;
    const layout = dual ? "double" : "single";
    const anchor =
      oldLayout && oldLayout !== layout
        ? (selectedPassage.current ?? visiblePassage(nodes()))
        : undefined;
    content.dataset.layout = layout;
    viewport.measure();
    viewport.restore(resume.current);
    if (anchor) viewport.reveal(anchor);
    if (restoredSection.current !== undefined && !specimen) {
      const heading = headings[restoredSection.current];
      if (heading && viewport.isVisible(heading))
        selectedPassage.current = heading;
      restoredSection.current = undefined;
    }

    function revealPassage(passage?: HTMLElement) {
      selectedPassage.current = passage;
      viewport.reveal(passage);
      record();
    }
    function followFragment(event: MouseEvent) {
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href^='#']",
      );
      if (!link) return;
      event.preventDefault();
      try {
        const id = decodeURIComponent(link.hash.slice(1));
        const target =
          id && content.querySelector<HTMLElement>("#" + CSS.escape(id));
        if (target) revealPassage(target);
      } catch {
        // A malformed fragment has no destination in this document.
      }
    }
    function to(target: string | number) {
      if (specimen) {
        const [ch, ix] = String(target).split("/").map(Number);
        pending.current = Number.isFinite(ix) ? ix : -1;
        resume.current = 0;
        setChapter(ch);
        viewport.restore(0);
        if (ch === chapter && pending.current >= 0) {
          viewport.reveal(content.querySelectorAll("p")[pending.current]);
          pending.current = -1;
        }
      } else {
        const passage =
          typeof target === "string" && target.startsWith("hit-")
            ? nodes()[Number(target.slice(4))]
            : headings[Number(target)];
        revealPassage(passage);
      }
    }
    const toc = specimen
      ? chapters.map((c, i) => ({ label: c.title, target: i }))
      : headings.map((h, i) => ({ label: h.textContent ?? "", target: i }));
    latest.current.ready(
      {
        capture,
        turn(d) {
          if ((!specimen || dual) && viewport.turn(d)) {
            selectedPassage.current = undefined;
            record();
            return;
          }
          if (specimen) {
            const next = Math.min(
              chapters.length - 1,
              Math.max(0, chapter + d),
            );
            if (next !== chapter) {
              to(next);
              if (d < 0 && dual) resume.current = 1;
            }
          }
        },
        go: to,
        async search(q) {
          const needle = q.toLowerCase();
          return specimen
            ? chapters.flatMap((c, i) =>
                c.paragraphs.flatMap((p, j) =>
                  p.toLowerCase().includes(needle)
                    ? [{ label: p, target: i + "/" + j }]
                    : [],
                ),
              )
            : nodes()
                .flatMap((node, i) =>
                  node.textContent?.toLowerCase().includes(needle)
                    ? [{ label: node.textContent, target: "hit-" + i }]
                    : [],
                )
                .slice(0, 150);
        },
      },
      toc,
      specimen ? chapters.length : toc.length,
    );
    if (specimen && pending.current >= 0) {
      viewport.reveal(content.querySelectorAll("p")[pending.current]);
      pending.current = -1;
    }
    function capture() {
      const fraction = viewport.fraction();
      if (specimen)
        return {
          location: fraction ? chapter + "/" + fraction : String(chapter),
          index: chapter,
          chapter: chapters[chapter].title,
          progress: Math.round(((chapter + 1) / chapters.length) * 100),
        };
      const passage = selectedPassage.current;
      const selected = passage && viewport.isVisible(passage);
      if (!selected) selectedPassage.current = undefined;
      const index = selected
        ? headings.findLastIndex(
            (h) =>
              h === passage ||
              !!(
                h.compareDocumentPosition(passage) &
                Node.DOCUMENT_POSITION_FOLLOWING
              ),
          )
        : viewport.sectionAtStart(headings);
      return {
        index,
        location: String(fraction),
        progress: Math.round(fraction * 100),
        chapter: headings[index]?.textContent ?? props.book.title,
      };
    }
    const record = () => {
      resume.current = viewport.fraction();
      latest.current.position(capture());
    };
    record();
    viewport.host.addEventListener("scroll", record, { passive: true });
    content.addEventListener("click", followFragment);
    const observer = new ResizeObserver(() => {
      if (!dual) return;
      viewport.measure();
      viewport.restore(resume.current);
    });
    if (dual && viewport.article) observer.observe(viewport.article);
    return () => {
      observer.disconnect();
      content.removeEventListener("click", followFragment);
      viewport.host.removeEventListener("scroll", record);
    };
  }, [
    document,
    chapter,
    specimen,
    pdf,
    dual,
    props.prefs.size,
    props.prefs.leading,
    props.prefs.fontFamily,
    props.prefs.fontCategory,
  ]);
  if (specimen) {
    const c = chapters[chapter];
    return (
      <div className="text-document" ref={root}>
        <article className="reading-content">
          <div className="chapter-kicker">
            {t("reader.chapter", { number: chapter + 1 })}
          </div>
          <h1>{c.title}</h1>
          {c.paragraphs.map((p, i) => (
            <p key={i} className={!i ? "opening" : ""}>
              {p}
            </p>
          ))}
          <div className="chapter-end">
            {t("reader.specimen", { title: props.book.title })}
          </div>
        </article>
      </div>
    );
  }
  if (pdf)
    return (
      <div
        className="text-document"
        ref={root}
        dangerouslySetInnerHTML={{ __html: pdfSample }}
      />
    );
  return (
    <div className="text-document" ref={root}>
      <article className="reading-content markdown-content">
        <Markdown
          skipHtml
          remarkPlugins={[remarkGfm]}
          urlTransform={(url, key) =>
            key === "src" &&
            /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(url)
              ? url
              : defaultUrlTransform(url)
          }
          components={markdownComponents}
        >
          {document ?? ""}
        </Markdown>
      </article>
    </div>
  );
}

const markdownComponents: Components = {
  img: ({ src, alt }) =>
    typeof src === "string" && src.startsWith("data:image/") ? (
      <img src={src} alt={alt} />
    ) : (
      <span>{alt}</span>
    ),
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (!href) return;
        if (/^(?:https?:|mailto:)/i.test(href)) void openExternal(href);
      }}
    >
      {children}
    </a>
  ),
  h2: ({ children }) => (
    <h2 id={String(children).toLowerCase().replaceAll(" ", "-")}>{children}</h2>
  ),
};
