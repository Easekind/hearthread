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
const names = {
  appearance: "外观",
  reading: "阅读排版",
  language: "语言",
  storage: "本地存储",
  shortcuts: "快捷键",
  about: "关于与更新",
};
const symbols = {
  appearance: "sun",
  reading: "book",
  language: "language",
  storage: "storage",
  shortcuts: "keyboard",
  about: "info",
};
type Tab = keyof typeof names;
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
  const p = data.prefs,
    mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const customFontName = useCustomFontName(
    tab === "reading" ? p.customFont : undefined,
  );
  useEffect(() => {
    void files.location().then(setPath);
  }, []);
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
  async function transfer(job: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      if ((await job()) !== false) notify(message);
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
        aria-label="设置"
      >
        <div className="sheet-grab" aria-hidden="true" {...handle}>
          <i />
        </div>
        <Tool
          className="icon-button drawer-close"
          label="关闭面板"
          symbol="close"
          onClick={dismiss}
        />
        <div className="preferences">
          <header className="preferences-title">
            <h1>设置</h1>
          </header>
          <div className="preferences-grid">
            <nav className="preferences-nav" aria-label="设置分类">
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
                  label="设置分类"
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
                    aria-label="当前主题的书库预览"
                  >
                    <div className="mini-window">
                      <div className="mini-rail">
                        <Icon name="library" />
                      </div>
                      <div className="mini-library">
                        <strong>我的书库</strong>
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
                    label="书库外观"
                    options={themeOptions}
                    value={p.theme}
                    change={(theme) => void patchPrefs({ theme })}
                  />
                </>
              )}
              {tab === "reading" && (
                <>
                  <article className="type-specimen" style={typeStyle(p)}>
                    <small>排版预览</small>
                    <p>
                      清晨的湖面映着树影。
                      <br />
                      沿着岸边，再读一页。
                    </p>
                    <p lang="en">Morning light on the water.</p>
                  </article>
                  <Group title="正文">
                    <TypeControls
                      prefs={p}
                      customFontName={customFontName}
                      change={patchPrefs}
                    />
                  </Group>
                  <Group>
                    <Row
                      name={customFontName || "自定义字体"}
                      detail="OTF、TTF、WOFF2"
                    >
                      {action(p.customFont ? "更换字体" : "导入字体", () => {
                        if (isTauri())
                          void transfer(pickNativeFont, "已应用字体");
                        else font.current?.click();
                      })}
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
                        void transfer(() => importFontFile(file), "已应用字体");
                    }}
                  />
                </>
              )}
              {tab === "language" && (
                <Group title="显示语言">
                  <Row name="界面语言">
                    <span>简体中文</span>
                  </Row>
                </Group>
              )}
              {tab === "storage" && (
                <>
                  <Group title="此设备">
                    <Row name="书库位置" detail={path}>
                      {action("查看位置", () => setSub("本地书库"))}
                    </Row>
                  </Group>
                  <Group title="备份与恢复">
                    <Row name="导出完整书库" detail="原始文件与阅读记录">
                      {action(
                        "导出备份",
                        () =>
                          void transfer(
                            async () =>
                              (await import("../storage/backup")).backup(),
                            "书库备份已导出",
                          ),
                      )}
                    </Row>
                    <Row
                      name="从备份恢复"
                      detail="合并书目，恢复同一本书的阅读记录"
                    >
                      {action("选择备份", () => restore.current?.click())}
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
                          "书库已恢复",
                        );
                      e.target.value = "";
                    }}
                  />
                </>
              )}
              {tab === "shortcuts" && (
                <Group title="键盘操作">
                  {[
                    ["搜索书库", mod + " K"],
                    ["导入书籍", mod + " O"],
                    ["书内搜索", mod + " F"],
                    ["切换章节", "← / →"],
                    ["关闭面板", "Esc"],
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
                    <small>本地阅读器 · v0.1.0</small>
                  </div>
                  <Group>
                    <Row name="开源项目与字体">
                      {action("查看许可", () => {
                        setSub("开源许可");
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
        <Modal title={sub} close={() => setSub("")}>
          {sub === "本地书库" ? (
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
