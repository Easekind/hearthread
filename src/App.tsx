import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { catalog, patchBooks, patchPrefs } from "./storage/catalog";
import { Brand, Icon, Tool, useObjectUrl } from "./ui/controls";
import { Shelf, type Action } from "./library/Shelf";
import { LibraryDialog, type Notify } from "./library/Dialogs";
import type { Book } from "./model";
import { exportBooks } from "./storage/transfer";
const Reader = lazy(() => import("./reader/Reader")),
  Settings = lazy(() =>
    import("./ui/Settings").then((m) => ({ default: m.Settings })),
  );
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
export default function App() {
  const data = useSyncExternalStore(catalog.subscribe, catalog.get);
  const [hash, setHash] = useState(() => location.hash.slice(1)),
    [query, setQuery] = useState(
      () => new URL(location.href).searchParams.get("q") ?? "",
    ),
    [folder, setFolder] = useState("");
  const [compact, setCompact] = useState(false),
    [mobile, setMobile] = useState(false),
    [drawerSize, setDrawerSize] = useState(
      () => matchMedia("(max-width:900px)").matches,
    );
  const [dialog, setDialog] = useState<{ kind: Action; books: Book[] } | null>(
      null,
    ),
    [notice, setNotice] = useState<{
      text: string;
      undo?: () => void | Promise<void>;
    } | null>(null);
  const search = useRef<HTMLInputElement>(null),
    returnTo = useRef<HTMLElement | null>(null),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = hash.startsWith("read-")
      ? data.books.find((b) => b.id === hash.slice(5) && !b.deleted)
      : undefined,
    settings = hash === "settings",
    layer = !!active || settings;
  const notify: Notify = useCallback((text, undo) => {
    clearTimeout(noticeTimer.current);
    setNotice({ text, undo });
  }, []);
  useEffect(() => {
    if (!notice) return;
    let remaining = notice.undo ? 8000 : 4500,
      start = 0;
    const node = document.querySelector<HTMLElement>(".toast")!;
    const stop = () => {
      clearTimeout(noticeTimer.current);
      if (start) remaining -= performance.now() - start;
      start = 0;
    };
    const resume = () => {
      stop();
      if (document.hidden || node.matches(":focus-within,:hover")) return;
      start = performance.now();
      noticeTimer.current = setTimeout(() => setNotice(null), remaining);
    };
    const visibility = () => (document.hidden ? stop() : resume());
    const blur = () => queueMicrotask(resume);
    resume();
    node.addEventListener("mouseenter", stop);
    node.addEventListener("mouseleave", resume);
    node.addEventListener("focusin", stop);
    node.addEventListener("focusout", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stop();
      node.removeEventListener("mouseenter", stop);
      node.removeEventListener("mouseleave", resume);
      node.removeEventListener("focusin", stop);
      node.removeEventListener("focusout", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [notice]);
  const close = useCallback(() => {
    history.replaceState(null, "", "#library");
    setHash("library");
    requestAnimationFrame(() =>
      returnTo.current?.focus({ preventScroll: true }),
    );
  }, []);
  function route(next: string) {
    returnTo.current = document.activeElement as HTMLElement;
    setMobile(false);
    location.hash = next;
    setHash(next);
  }
  useEffect(() => {
    const sync = () => setHash(location.hash.slice(1));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    const media = matchMedia("(max-width:900px)");
    const change = () => {
      setDrawerSize(media.matches);
      setMobile(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useLayoutEffect(() => {
    const media = matchMedia("(prefers-color-scheme:dark)");
    function theme() {
      const p = data.prefs;
      const t = p.system ? (media.matches ? "dark" : "light") : p.theme;
      document.body.className = [
        t === "light" ? "" : "theme-" + t,
        layer ? "has-library-layer" : "",
        p.reduce ? "reduce-motion" : "",
      ].join(" ");
      document.body.style.setProperty("--brand-thread", p.tint ?? "");
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute(
          "content",
          getComputedStyle(document.body)
            .getPropertyValue("--color-paper")
            .trim(),
        );
    }
    theme();
    media.addEventListener("change", theme);
    return () => media.removeEventListener("change", theme);
  }, [layer, data.prefs]);
  const font = useObjectUrl(data.prefs.customFont);
  useEffect(() => {
    if (!font) return;
    let live = true;
    const face = new FontFace("UserReading", 'url("' + font + '")');
    face
      .load()
      .then((f) => {
        if (live) document.fonts.add(f);
      })
      .catch((e) => notify(String(e)));
    return () => {
      live = false;
      document.fonts.delete(face);
    };
  }, [font, notify]);
  useEffect(() => {
    const u = new URL(location.href);
    if (query) u.searchParams.set("q", query);
    else u.searchParams.delete("q");
    history.replaceState(null, "", u);
  }, [query]);
  function open(b: Book) {
    if (
      !data.prefs.reduce &&
      document.documentElement.dataset.input !== "keyboard" &&
      !matchMedia("(prefers-reduced-motion:reduce)").matches
    ) {
      const jacket = document.querySelector(
        '[data-focus-book="' + b.id + '"] .book-cover',
      );
      jacket?.animate(
        [
          { transform: getComputedStyle(jacket).transform },
          { transform: "perspective(850px) rotateY(-58deg)" },
        ],
        { duration: 300, easing: "ease-out" },
      );
    }
    void patchBooks([b.id], { readAt: Date.now() });
    route("read-" + b.id);
  }
  function action(kind: Action, books: Book[] = []) {
    if (kind === "export") {
      void exportBooks(books).catch((e) => notify(String(e)));
      return;
    }
    setDialog({ kind, books });
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      document.documentElement.dataset.input = "keyboard";
      if (layer || dialog || e.isComposing) return;
      if (
        (e.ctrlKey || e.metaKey) &&
        ["k", "o"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === "k") search.current?.focus();
        else action("import");
      }
      if (e.key === "Escape") {
        setMobile(false);
        if (document.activeElement === search.current) setQuery("");
      }
    }
    const pointer = () => {
      document.documentElement.dataset.input = "pointer";
    };
    const error = (e: PromiseRejectionEvent) => {
      notify(String(e.reason));
      e.preventDefault();
    };
    const storage = (e: Event) => notify((e as CustomEvent).detail);
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", pointer);
    window.addEventListener("unhandledrejection", error);
    window.addEventListener("storage-error", storage);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", pointer);
      window.removeEventListener("unhandledrejection", error);
      window.removeEventListener("storage-error", storage);
    };
  }, [layer, dialog, notify]);
  function home() {
    setMobile(false);
    setFolder("");
    setQuery("");
    void patchPrefs({ view: "grid" });
    window.scrollTo(0, 0);
  }
  const toggle = () =>
      drawerSize ? setMobile((v) => !v) : setCompact((v) => !v),
    expanded = drawerSize ? mobile : !compact,
    label = expanded ? "收起导航" : "展开导航";
  return (
    <>
      <div className="app-root" id="app">
        <div
          className={
            "studio " +
            (compact ? "nav-compact " : "") +
            (mobile ? "nav-open" : "")
          }
          inert={layer || !!dialog}
        >
          <aside
            className="studio-nav"
            id="library-nav"
            aria-label="书库导航"
            role={mobile ? "dialog" : undefined}
            aria-modal={mobile || undefined}
          >
            <button
              className="studio-brand"
              aria-label="hearthread 书库"
              onClick={home}
            >
              <Brand />
            </button>
            {mobile && (
              <Tool
                className="icon-button nav-close"
                label="关闭导航"
                symbol="close"
                onClick={toggle}
              />
            )}
            <div className="nav-main">
              <nav aria-label="内容空间">
                <button
                  className="nav-item is-current"
                  aria-current="page"
                  title="书库"
                  onClick={home}
                >
                  <Icon name="library" />
                  <span>书库</span>
                </button>
              </nav>
            </div>
            <div className="nav-bottom">
              <button
                className="nav-item"
                title="设置"
                onClick={() => route("settings")}
              >
                <Icon name="settings" />
                <span>设置</span>
              </button>
            </div>
          </aside>
          {mobile && (
            <button
              className="nav-scrim"
              aria-label="关闭导航"
              onClick={toggle}
            />
          )}
          <div className="studio-workspace" inert={mobile}>
            <header className="studio-topbar">
              <div className="topbar-left">
                <Tool
                  data-action="toggle-nav"
                  label={label}
                  symbol="sidebar"
                  aria-expanded={expanded}
                  aria-controls="library-nav"
                  onClick={toggle}
                />
                <Brand mobile />
              </div>
              <div className="studio-search" role="search">
                <Icon name="search" />
                <input
                  ref={search}
                  id="global-query"
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  aria-label="搜索书库"
                  placeholder="搜索书名或作者"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query ? (
                  <Tool
                    label="清除搜索"
                    symbol="close"
                    onClick={() => {
                      setQuery("");
                      search.current?.focus();
                    }}
                  />
                ) : (
                  <kbd>{mod} K</kbd>
                )}
              </div>
              <button
                className="button import-button"
                aria-label="导入书籍"
                onClick={() => action("import")}
              >
                <Icon name="importBook" />
                <span>导入书籍</span>
              </button>
            </header>
            <main className="studio-main" id="main">
              <Shelf
                data={data}
                query={query}
                clear={() => setQuery("")}
                folder={folder}
                setFolder={setFolder}
                open={open}
                action={action}
              />
            </main>
          </div>
        </div>
      </div>
      <div id="library-layer">
        <Suspense fallback={null}>
          {active && (
            <Reader
              key={active.id}
              book={active}
              prefs={data.prefs}
              close={close}
            />
          )}
          {settings && <Settings data={data} notify={notify} close={close} />}
        </Suspense>
      </div>
      {dialog && (
        <LibraryDialog
          {...dialog}
          data={data}
          folder={folder}
          notify={notify}
          close={() => setDialog(null)}
          afterImport={(v) => {
            setFolder(v);
            setQuery("");
            void patchPrefs({ sort: "added" });
          }}
        />
      )}
      <div id="toast-root" role="status" aria-live="polite">
        {notice && (
          <div className="toast">
            <span>{notice.text}</span>
            {notice.undo && (
              <button
                onClick={async () => {
                  await notice.undo?.();
                  setNotice(null);
                }}
              >
                撤销
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
