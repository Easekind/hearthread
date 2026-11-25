import { t } from "../i18n";
import {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { defaults, themeOptions, type Book, type Preferences } from "../model";
import { EngineBoundary } from "./EngineBoundary";
import { bookSource, patchBooks, patchPrefs } from "../storage/catalog";
import { Icon, Papers, Tool, TypeControls, typeStyle } from "../ui/controls";
import { useCustomFontName } from "../ui/useCustomFontName";
import { useResolvedTheme } from "../ui/useResolvedTheme";
import { Slider } from "../ui/slider";
import type { Destination, Position, ReaderEngine } from "./engine";
const Epub = lazy(() => import("./Epub")),
  Pdf = lazy(() => import("./Pdf")),
  TextDocument = lazy(() => import("./TextDocument"));
export default function Reader({
  book,
  prefs,
  close,
}: {
  book: Book;
  prefs: Preferences;
  close: () => void;
}) {
  const [source, setSource] = useState(""),
    [error, setError] = useState(""),
    [tools, show] = useState(false),
    [panel, setPanel] = useState(""),
    [wide, setWide] = useState(false);
  const [toc, setToc] = useState<Destination[]>([]),
    [count, setCount] = useState(0),
    [index, setIndex] = useState(0),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<Destination[]>([]),
    [searching, setSearching] = useState(false),
    [ready, setReady] = useState(false);
  const layer = useRef<HTMLElement>(null),
    engine = useRef<ReaderEngine | null>(null),
    pending = useRef<Position | undefined>(undefined),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initial = useRef(book).current;
  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));
  const lastSave = useRef<Promise<void>>(Promise.resolve());
  function flush() {
    clearTimeout(timer.current);
    const p = pending.current;
    pending.current = undefined;
    if (p)
      lastSave.current = patchBooks([initial.id], {
        location: p.location,
        progress: Math.max(0, Math.min(100, p.progress)),
        chapter: p.chapter,
        sectionIndex:
          initial.type === "EPUB" && !p.chapter ? p.index : undefined,
      });
    return lastSave.current;
  }
  function position(p: Position) {
    setIndex(p.index);
    pending.current = p;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 200);
  }
  async function leave() {
    const current = engine.current?.capture?.();
    if (current) pending.current = current;
    try {
      await flush();
      close();
    } catch (e) {
      fail(e);
    }
  }
  function toggle() {
    setPanel("");
    show((v) => !v);
  }
  function selectPanel(name: string) {
    show(true);
    setPanel((v) => (v === name ? "" : name));
  }
  useLayoutEffect(() => {
    layer.current?.focus({ preventScroll: true });
    if (
      !matchMedia("(prefers-reduced-motion:reduce)").matches &&
      document.documentElement.dataset.input !== "keyboard"
    )
      layer.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 300,
        easing: "ease-out",
      });
  }, []);
  useEffect(() => {
    let live = true,
      release: (() => void) | undefined;
    bookSource(initial)
      .then((s) => {
        if (!live) {
          s.release();
          return;
        }
        release = s.release;
        setSource(s.url);
      })
      .catch(fail);
    const hide = () => {
      if (document.hidden) {
        const p = engine.current?.capture?.();
        if (p) pending.current = p;
        void flush();
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", flush);
    return () => {
      live = false;
      release?.();
      flush();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", flush);
    };
  }, [initial]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        show(true);
        setPanel("search");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (panel) setPanel("");
        else void leave();
        return;
      }
      if (
        (e.target as Element)?.closest?.(
          "input,select,textarea,button,a,[role=slider]",
        )
      )
        return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        engine.current?.turn(e.key === "ArrowLeft" ? -1 : 1);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [panel, close]);
  useEffect(() => {
    const abort = new AbortController();
    setResults([]);
    if (!ready || panel !== "search" || !query.trim()) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      engine.current
        ?.search(query.trim(), abort.signal)
        .then((r) => {
          if (!abort.signal.aborted) setResults(r);
        })
        .catch((e) => {
          if (!abort.signal.aborted) fail(e);
        })
        .finally(() => {
          if (!abort.signal.aborted) setSearching(false);
        });
    }, 200);
    return () => {
      clearTimeout(id);
      abort.abort();
    };
  }, [panel, query, ready]);
  const component = initial.object
    ? initial.type === "EPUB"
      ? Epub
      : initial.type === "PDF"
        ? Pdf
        : TextDocument
    : TextDocument;
  const Engine = component;
  const paper = useResolvedTheme(prefs.paper);
  const enginePrefs = useMemo(() => ({ ...prefs, paper }), [prefs, paper]);
  const props = {
    book: initial,
    prefs: enginePrefs,
    source,
    wide,
    position,
    toggle,
    fail,
    ready: (api: ReaderEngine, items: Destination[], n: number) => {
      engine.current = api;
      setToc(items);
      setCount(n);
      setReady(true);
    },
  };
  const epub = book.type === "EPUB",
    pdf = book.type === "PDF";
  const customFontName = useCustomFontName(
    panel === "type" && !pdf ? prefs.customFont : undefined,
  );
  const heading =
    panel === "toc"
      ? t("reader.contents")
      : panel === "type"
        ? pdf
          ? t("reader.paper")
          : t("settings.typography")
        : t("reader.find");
  function go(t: string | number) {
    engine.current?.go(t);
    setPanel("");
    layer.current?.focus();
  }
  return (
    <section
      className="reading-layer layer-scroll"
      role="dialog"
      aria-modal="true"
      aria-label={t("reader.dialog")}
      tabIndex={-1}
      ref={layer}
    >
      <main
        className={"reader reading-room " + (tools || error ? "" : "is-focus")}
        data-paper={paper}
        data-pdf-wide={wide}
        style={typeStyle(prefs)}
      >
        {!tools && (
          <button className="reading-tools-access" onClick={() => show(true)}>
            {t("reader.showTools")}
          </button>
        )}
        <header className="room-head" inert={!tools && !error}>
          <button
            className="room-back"
            aria-label={t("reader.back")}
            onClick={leave}
          >
            <Icon name="back" />
            <span>{t("library.title")}</span>
          </button>
          <div className="room-identity">
            <strong>{book.title}</strong>
            <small>
              {book.object
                ? book.author
                : book.author.replace(" / 示例文档", "")}
            </small>
          </div>
          <div className="room-actions">
            <Tool
              className="room-tool"
              label={t("reader.find")}
              symbol="search"
              aria-expanded={panel === "search"}
              onClick={() => selectPanel("search")}
            />
          </div>
        </header>
        <div
          onClick={(e) => {
            if (
              !(e.target as Element).closest("button,a") &&
              window.getSelection()?.isCollapsed
            )
              toggle();
          }}
        >
          {error ? (
            <section className="reading-content" role="alert">
              <h1>{t("reader.failed")}</h1>
              <p>{error}</p>
              <button className="button" onClick={leave}>
                {t("reader.back")}
              </button>
            </section>
          ) : (
            <EngineBoundary fail={fail}>
              <Suspense fallback={null}>
                {source && <Engine {...props} />}
              </Suspense>
            </EngineBoundary>
          )}
        </div>
        {!ready && !error && (
          <div className="reader-loading" role="status">
            {t("reader.opening")}{" "}
            <button className="button" onClick={leave}>
              {t("reader.back")}
            </button>
          </div>
        )}
        <footer
          className="room-dock"
          aria-label={t("reader.tools")}
          inert={!tools}
        >
          <Tool
            className="room-tool"
            label={t("reader.contents")}
            aria-expanded={panel === "toc"}
            symbol="contents"
            onClick={() => selectPanel("toc")}
          />
          <div className="room-navigation">
            {(!pdf || book.object) && (
              <Tool
                className="room-tool"
                label={epub ? t("reader.prev") : t("reader.pageUp")}
                symbol="previous"
                onClick={() => engine.current?.turn(-1)}
              />
            )}
            {epub ? (
              <div className="chapter-position">
                <span>
                  {t("reader.chapter", { number: index + 1 })} <i>/ {count}</i>
                </span>
                {count > 1 && (
                  <Slider
                    aria-label={t("reader.selectChapter")}
                    value={[index + 1]}
                    min={1}
                    max={count}
                    onValueChange={([chapter]) => go(chapter - 1)}
                  />
                )}
              </div>
            ) : pdf ? (
              <button
                className="pdf-fit"
                aria-label={t("reader.fit")}
                aria-pressed={wide}
                onClick={() => setWide((v) => !v)}
              >
                {t("reader.page", { number: book.object ? index + 1 : 3 })} ·{" "}
                {wide ? t("reader.fitWidth") : t("reader.fitPage")}{" "}
                <Icon name={wide ? "fitWidth" : "fitPage"} />
              </button>
            ) : (
              <span className="document-position">Markdown</span>
            )}
            {(!pdf || book.object) && (
              <Tool
                className="room-tool"
                label={epub ? t("reader.next") : t("reader.pageDown")}
                symbol="next"
                onClick={() => engine.current?.turn(1)}
              />
            )}
          </div>
          <Tool
            className="room-tool"
            label={pdf ? t("reader.paper") : t("settings.typography")}
            aria-expanded={panel === "type"}
            symbol={pdf ? "sun" : "type"}
            onClick={() => selectPanel("type")}
          />
        </footer>
        {panel && (
          <aside className={"room-panel panel-" + panel} aria-label={heading}>
            <div className="row between">
              <h2>{heading}</h2>
              <Tool
                symbol="close"
                label={t("reader.closePanel", { heading })}
                onClick={() => setPanel("")}
              />
            </div>
            {panel === "type" ? (
              <>
                {!pdf && (
                  <TypeControls
                    prefs={prefs}
                    customFontName={customFontName}
                    change={patchPrefs}
                  />
                )}
                <Papers
                  label={t("reader.paper")}
                  options={themeOptions}
                  value={prefs.paper}
                  change={(paper) => void patchPrefs({ paper })}
                />
                {!pdf && (
                  <button
                    className="reset-reading"
                    onClick={() =>
                      void patchPrefs({
                        size: defaults.size,
                        leading: defaults.leading,
                        fontCategory: defaults.fontCategory,
                        fontFamily: defaults.fontFamily,
                        paper: "light",
                      })
                    }
                  >
                    {t("reader.reset")}
                  </button>
                )}
              </>
            ) : panel === "toc" ? (
              <div className="contents-list">
                {toc.length ? (
                  toc.map((item, i) => (
                    <button
                      key={i}
                      aria-current={i === index ? "location" : undefined}
                      onClick={() => go(item.target)}
                    >
                      <small>{String(i + 1).padStart(2, "0")}</small>
                      <span>{item.label}</span>
                    </button>
                  ))
                ) : (
                  <p>{t("reader.noContents")}</p>
                )}
              </div>
            ) : (
              <>
                <label className="room-search">
                  <Icon name="search" />
                  <input
                    autoFocus
                    type="search"
                    aria-label={t("reader.search")}
                    placeholder={t("reader.search")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div id="book-results" className="contents-list">
                  {searching ? (
                    <p>{t("reader.searching")}</p>
                  ) : results.length ? (
                    results.map((hit, i) => (
                      <button key={i} onClick={() => go(hit.target)}>
                        {hit.label}
                      </button>
                    ))
                  ) : (
                    query && <p>{t("reader.noMatches")}</p>
                  )}
                </div>
              </>
            )}
          </aside>
        )}
      </main>
    </section>
  );
}
