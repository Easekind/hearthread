import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
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
              ? Number(props.book.location)
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
  const pending = useRef(-1);
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
  useEffect(() => {
    if (!specimen && !pdf && document === null) return;
    const content = root.current!,
      scroll = content.closest<HTMLElement>(".reading-layer")!;
    const headings = [...content.querySelectorAll<HTMLElement>("h2")];
    const nodes = () => [
      ...content.querySelectorAll<HTMLElement>("p,li,blockquote,h1,h2,td"),
    ];
    function to(target: string | number) {
      if (specimen) {
        const [ch, ix] = String(target).split("/").map(Number);
        pending.current = Number.isFinite(ix) ? ix : -1;
        setChapter(ch);
        scroll.scrollTop = 0;
        if (ch === chapter && pending.current >= 0) {
          content
            .querySelectorAll("p")
            [pending.current]?.scrollIntoView({ block: "center" });
          pending.current = -1;
        }
      } else if (typeof target === "string" && target.startsWith("hit-"))
        nodes()[Number(target.slice(4))]?.scrollIntoView({ block: "center" });
      else headings[Number(target)]?.scrollIntoView();
    }
    const toc = specimen
      ? chapters.map((c, i) => ({ label: c.title, target: i }))
      : headings.map((h, i) => ({ label: h.textContent ?? "", target: i }));
    latest.current.ready(
      {
        capture: specimen ? undefined : capture,
        turn: (d) =>
          specimen
            ? to(Math.min(3, Math.max(0, chapter + d)))
            : scroll.scrollBy({ top: d * scroll.clientHeight * 0.87 }),
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
    if (specimen) {
      latest.current.position({
        location: String(chapter),
        index: chapter,
        chapter: chapters[chapter].title,
        progress: Math.round(((chapter + 1) / chapters.length) * 100),
      });
      if (pending.current >= 0) {
        content
          .querySelectorAll("p")
          [pending.current]?.scrollIntoView({ block: "center" });
        pending.current = -1;
      }
      return;
    }
    const max = () => Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    if (props.book.location)
      scroll.scrollTop = Number(props.book.location) * max();
    function capture() {
      const fraction = max() ? scroll.scrollTop / max() : 0;
      const index = Math.max(
        0,
        headings.findLastIndex(
          (h) => h.getBoundingClientRect().top < scroll.clientHeight * 0.5,
        ),
      );
      return {
        index,
        location: String(fraction),
        progress: Math.round(fraction * 100),
        chapter: headings[index]?.textContent ?? props.book.title,
      };
    }
    const record = () => latest.current.position(capture());
    scroll.addEventListener("scroll", record, { passive: true });
    return () => scroll.removeEventListener("scroll", record);
  }, [document, chapter, specimen, pdf]);
  if (specimen) {
    const c = chapters[chapter];
    return (
      <div ref={root}>
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
    return <div ref={root} dangerouslySetInnerHTML={{ __html: pdfSample }} />;
  return (
    <div ref={root}>
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
          components={{
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
                  if (href.startsWith("#")) {
                    try {
                      root.current
                        ?.querySelector(
                          "#" + CSS.escape(decodeURIComponent(href.slice(1))),
                        )
                        ?.scrollIntoView();
                    } catch {
                      /* Invalid anchor in the source document. */
                    }
                  } else if (/^(?:https?:|mailto:)/i.test(href))
                    void openExternal(href);
                }}
              >
                {children}
              </a>
            ),
            h2: ({ children }) => (
              <h2 id={String(children).toLowerCase().replaceAll(" ", "-")}>
                {children}
              </h2>
            ),
          }}
        >
          {document ?? ""}
        </Markdown>
      </article>
    </div>
  );
}
