import { t, type MessageKey, languageNames, isLocale } from "../i18n";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Cover,
  Icon,
  Modal,
  Papers,
  Select,
  Tool,
  TypeControls,
  typeStyle,
} from "./controls";
import { isTauri } from "@tauri-apps/api/core";
import {
  fontExtensions,
  importFontFile,
  pickNativeFont,
} from "../storage/readingFont";
import { themeOptions, type Catalog } from "../model";
import { patchPrefs } from "../storage/catalog";
import { files } from "../storage/files";
import { useCustomFontName } from "./useCustomFontName";
import { useSheet } from "./useSheet";
import type { Notify } from "../library/Dialogs";
const StorageDetails = lazy(() => import("./StorageDetails"));
const symbols = {
  appearance: "sun",
  reading: "book",
  language: "language",
  storage: "storage",
  shortcuts: "keyboard",
  about: "info",
};
type Tab = keyof typeof symbols;
function Row({
  name,
  detail,
  children,
}: {
  name: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        {name}
        {detail && <small>{detail}</small>}
      </div>
      {children}
    </div>
  );
}
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="pref-group">
      {title && <h3>{title}</h3>}
      <div className="pref-rows">{children}</div>
    </section>
  );
}
export function Settings({
  data,
  close,
  notify,
}: {
  data: Catalog;
  close: () => void;
  notify: Notify;
}) {
  const [tab, setTab] = useState<Tab>("appearance"),
    [sub, setSub] = useState(""),
    [path, setPath] = useState(""),
    [licenses, setLicenses] = useState(""),
    [busy, setBusy] = useState(false);
  const { drawer, dismiss, handle } = useSheet(close);
  const restore = useRef<HTMLInputElement>(null),
    font = useRef<HTMLInputElement>(null);
  const names = {
    appearance: t("settings.appearance"),
    reading: t("settings.typography"),
    language: t("settings.language"),
    storage: t("settings.storage"),
    shortcuts: t("settings.shortcuts"),
    about: t("settings.about"),
  };
  const p = data.prefs,
    mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const customFontName = useCustomFontName(
    tab === "reading" ? p.customFont : undefined,
  );
  useEffect(() => {
    void files.location().then(setPath);
  }, [p.locale]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (sub || document.querySelector("[data-radix-popper-content-wrapper]"))
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
      if (e.key === "Tab") {
        const all = [
          ...drawer.current!.querySelectorAll<HTMLButtonElement>(
            'button:enabled,input:not([hidden]),[role=slider][tabindex="0"]',
          ),
        ].filter((n) => n.offsetWidth);
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
          e.preventDefault();
          all[0]?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [sub, close]);
  function action(label: string, fn: () => void) {
    return (
      <button className="pref-action" disabled={busy} onClick={fn}>
        {label}
      </button>
    );
  }
  async function transfer(job: () => Promise<unknown>, message: MessageKey) {
    setBusy(true);
    try {
      if ((await job()) !== false) notify(t(message));
    } catch (e) {
      notify(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="library-scrim" onClick={dismiss} />
      <section
        className="library-drawer layer-scroll"
        ref={drawer}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
      >
        <div className="sheet-grab" aria-hidden="true" {...handle}>
          <i />
        </div>
        <Tool
          className="icon-button drawer-close"
          label={t("panel.close")}
          symbol="close"
          onClick={dismiss}
        />
        <div className="preferences">
          <header className="preferences-title">
            <h1>{t("settings.title")}</h1>
          </header>
          <div className="preferences-grid">
            <nav
              className="preferences-nav"
              aria-label={t("settings.categories")}
            >
              {(Object.keys(names) as Tab[]).map((t, i) => (
                <button
                  key={t}
                  aria-current={tab === t ? "page" : "false"}
                  onClick={() => setTab(t)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const n = (i + (e.key === "ArrowDown" ? 1 : -1) + 6) % 6;
                      setTab((Object.keys(names) as Tab[])[n]);
                      (
                        e.currentTarget.parentElement!.children[
                          n
                        ] as HTMLElement
                      ).focus();
                    }
                  }}
                >
                  <Icon name={symbols[t]} />
                  {names[t]}
                </button>
              ))}
            </nav>
            <section className="preferences-detail">
              <h2>{names[tab]}</h2>
              <div className="mobile-preference">
                <Select
                  label={t("settings.categories")}
                  value={tab}
                  options={names}
                  change={(v) => setTab(v as Tab)}
                  icon={symbols[tab]}
                />
              </div>
              {tab === "appearance" && (
                <>
                  <div
                    className="appearance-preview"
                    aria-label={t("settings.preview")}
                  >
                    <div className="mini-window">
                      <div className="mini-rail">
                        <Icon name="library" />
                      </div>
                      <div className="mini-library">
                        <strong>{t("library.heading")}</strong>
                        <div className="mini-shelf">
                          {data.books.slice(0, 3).map((b) => (
                            <div key={b.id}>
                              <Cover book={b} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Papers
                    label={t("settings.theme")}
                    options={themeOptions}
                    value={p.theme}
                    change={(theme) => void patchPrefs({ theme })}
                  />
                </>
              )}
              {tab === "reading" && (
                <>
                  <article className="type-specimen" style={typeStyle(p)}>
                    <small>{t("settings.typePreview")}</small>
                    <p lang="zh-CN">
                      清晨的湖面映着树影。
                      <br />
                      沿着岸边，再读一页。
                    </p>
                    <p lang="en">Morning light on the water.</p>
                  </article>
                  <Group title={t("settings.body")}>
                    <TypeControls
                      prefs={p}
                      customFontName={customFontName}
                      change={patchPrefs}
                    />
                  </Group>
                  <Group>
                    <Row
                      name={customFontName || t("font.custom")}
                      detail={t("font.formats")}
                    >
                      {action(
                        p.customFont ? t("font.replace") : t("font.import"),
                        () => {
                          if (isTauri())
                            void transfer(pickNativeFont, "font.applied");
                          else font.current?.click();
                        },
                      )}
                    </Row>
                  </Group>
                  <input
                    ref={font}
                    type="file"
                    hidden
                    accept={fontExtensions.map((ext) => "." + ext).join(",")}
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = "";
                      if (file)
                        void transfer(
                          () => importFontFile(file),
                          "font.applied",
                        );
                    }}
                  />
                </>
              )}
              {tab === "language" && (
                <Group title={t("settings.displayLanguage")}>
                  <Row name={t("settings.interfaceLanguage")}>
                    <Select
                      label={t("settings.interfaceLanguage")}
                      value={p.locale}
                      options={languageNames}
                      change={(value) => {
                        if (isLocale(value)) void patchPrefs({ locale: value });
                      }}
                    />
                  </Row>
                </Group>
              )}
              {tab === "storage" && (
                <>
                  <Group title={t("settings.device")}>
                    <Row name={t("storage.location")} detail={path}>
                      {action(t("storage.view"), () => setSub("storage"))}
                    </Row>
                  </Group>
                  <Group title={t("storage.backups")}>
                    <Row
                      name={t("storage.exportLibrary")}
                      detail={t("storage.backupContents")}
                    >
                      {action(
                        t("storage.exportBackup"),
                        () =>
                          void transfer(
                            async () =>
                              (await import("../storage/backup")).backup(),
                            "storage.exported",
                          ),
                      )}
                    </Row>
                    <Row
                      name={t("storage.restore")}
                      detail={t("storage.restoreDetail")}
                    >
                      {action(t("storage.chooseBackup"), () =>
                        restore.current?.click(),
                      )}
                    </Row>
                  </Group>
                  <input
                    type="file"
                    accept=".zip"
                    ref={restore}
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        void transfer(
                          async () =>
                            (await import("../storage/backup")).restore(f),
                          "storage.restored",
                        );
                      e.target.value = "";
                    }}
                  />
                </>
              )}
              {tab === "shortcuts" && (
                <Group title={t("settings.keyboard")}>
                  {[
                    [t("library.search"), mod + " K"],
                    [t("library.import"), mod + " O"],
                    [t("reader.find"), mod + " F"],
                    [t("reader.turnPage"), "← / →"],
                    [t("panel.close"), "Esc"],
                  ].map(([name, key]) => (
                    <Row key={name} name={name}>
                      <kbd className="key">{key}</kbd>
                    </Row>
                  ))}
                </Group>
              )}
              {tab === "about" && (
                <>
                  <div className="product-signature">
                    <svg viewBox="0 0 40 40" aria-hidden="true">
                      <path d="M5 4 15 10V19L25 13V4L35 10V36L25 30V21L15 27V36L5 30Z" />
                    </svg>
                    <strong>hearthread</strong>
                    <small>{t("settings.version")}</small>
                  </div>
                  <Group>
                    <Row name={t("settings.credits")}>
                      {action(t("settings.viewLicenses"), () => {
                        setSub("licenses");
                        Promise.all(
                          [
                            "/foliate/LICENSE",
                            "/licenses/shadcn-ui.txt",
                            "/design/licenses.txt",
                            "/licenses/runtime.txt",
                          ].map(async (path) => (await fetch(path)).text()),
                        ).then((parts) => setLicenses(parts.join("\n\n")));
                      })}
                    </Row>
                  </Group>
                </>
              )}
            </section>
          </div>
        </div>
      </section>
      {sub && (
        <Modal
          title={
            sub === "storage" ? t("storage.local") : t("settings.licenses")
          }
          close={() => setSub("")}
        >
          {sub === "storage" ? (
            <Suspense>
              <StorageDetails books={data.books} path={path} />
            </Suspense>
          ) : (
            <pre className="whitespace-pre-wrap">{licenses}</pre>
          )}
        </Modal>
      )}
    </>
  );
}
