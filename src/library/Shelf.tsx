import { useState } from "react";
import type { Book, Catalog } from "../model";
import { Cover, Icon, Menu, Select, Tool } from "../ui/controls";
import { patchBooks, patchPrefs } from "../storage/catalog";
export type Action =
  "import" | "rename" | "move" | "delete" | "export" | "folder";
export interface ShelfProps {
  data: Catalog;
  query: string;
  clear: () => void;
  folder: string;
  setFolder: (v: string) => void;
  open: (b: Book) => void;
  action: (kind: Action, books?: Book[]) => void;
}
const sorts = { recent: "最近阅读", added: "最近添加", title: "书名排序" };
export function Shelf({
  data,
  query,
  clear,
  folder,
  setFolder,
  open,
  action,
}: ShelfProps) {
  const [selected, setSelected] = useState("1"),
    [batch, setBatch] = useState(false),
    [checked, check] = useState<string[]>([]);
  const { prefs } = data;
  const items = data.books
    .filter(
      (b) =>
        !b.deleted &&
        (!folder || b.folder === folder) &&
        [b.title, b.en, b.author].some((t) =>
          t
            .replace(/\s+/g, " ")
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        ),
    )
    .sort((a, b) =>
      prefs.sort === "recent"
        ? b.readAt - a.readAt || a.added - b.added
        : prefs.sort === "added"
          ? b.added - a.added
          : a.title.localeCompare(b.title, "zh"),
    );
  const current = items.find((b) => b.id === selected) ?? items[0],
    list = prefs.view === "list" || batch;
  function step(delta: number) {
    if (items.length)
      setSelected(
        items[(items.indexOf(current) + delta + items.length) % items.length]
          .id,
      );
  }
  const selectedBooks = items.filter((b) => checked.includes(b.id));
  function toggle(id: string) {
    check((prior) =>
      prior.includes(id) ? prior.filter((i) => i !== id) : [...prior, id],
    );
  }
  function menu(b: Book) {
    return (
      <Menu
        label={b.title + " 的操作"}
        trigger={
          <button
            type="button"
            className="icon-button"
            data-book-menu={b.id}
            aria-label={b.title + " 的更多操作"}
          >
            <Icon name="more" />
          </button>
        }
        options={[
          { label: "打开阅读", icon: "book", run: () => open(b) },
          {
            label: b.pinned ? "取消置顶" : "置顶",
            icon: "pin",
            divider: true,
            run: () =>
              void patchBooks([b.id], {
                pinned: !b.pinned,
                readAt: b.pinned ? b.readAt : Date.now(),
              }),
          },
          ...(
            [
              ["rename", "edit", "重命名"],
              ["move", "moveBook", "移动到分类"],
              ["export", "exportBook", "导出原文件"],
              ["delete", "trash", "删除"],
            ] as const
          ).map(([kind, icon, label]) => ({
            label,
            icon,
            run: () => action(kind, [b]),
            danger: kind === "delete",
            divider: kind === "delete",
          })),
        ]}
      />
    );
  }
  return (
    <>
      <header className="studio-heading">
        <div className="heading-name">
          <h1>{query ? "搜索藏书" : "我的书库"}</h1>
          <span>{items.length} 本</span>
        </div>
        <div className="view-switch" aria-label="书库视图">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              className={list === (v === "list") ? "active" : ""}
              aria-pressed={list === (v === "list")}
              onClick={() => {
                setBatch(false);
                void patchPrefs({ view: v });
              }}
            >
              <Icon name={v} />
              {v === "grid" ? "书墙" : "列表"}
            </button>
          ))}
        </div>
      </header>
      <div className="wall-toolbar library-tools">
        <span className="toolbar-summary">
          {query ? "“" + query + "” 的搜索结果" : ""}
        </span>
        <div className="library-tool-actions">
          <Select
            label="按分类筛选"
            value={folder}
            change={(v) => {
              setFolder(v);
              check([]);
            }}
            options={{
              "": "全部分类",
              ...Object.fromEntries(data.folders.map((f) => [f, f])),
            }}
            icon="folder"
            extra={[
              {
                label: "新建分类",
                icon: "plus",
                divider: true,
                run: () => action("folder"),
              },
            ]}
          />
          <Select
            label="藏书排序"
            value={prefs.sort}
            options={sorts}
            icon="sort"
            change={(v) => void patchPrefs({ sort: v as keyof typeof sorts })}
          />
          {!batch && (
            <button
              className="tool-trigger manage-library"
              onClick={() => {
                setBatch(true);
                check([]);
              }}
            >
              <Icon name="manage" />
              管理藏书
            </button>
          )}
        </div>
      </div>
      {batch && (
        <section className="selection-bar" aria-label="批量管理">
          <div className="selection-state">
            <button
              disabled={!items.length}
              onClick={() =>
                check(
                  selectedBooks.length === items.length
                    ? []
                    : items.map((b) => b.id),
                )
              }
            >
              {items.length > 0 && selectedBooks.length === items.length
                ? "取消全选"
                : "全选"}
            </button>
            <span>
              已选 <b>{selectedBooks.length}</b> 本
            </span>
          </div>
          <div className="selection-ops">
            {(
              [
                ["move", "moveBook", "移动"],
                ["export", "exportBook", "导出"],
                ["delete", "trash", "删除"],
              ] as const
            ).map(([kind, symbol, title]) => (
              <button
                key={kind}
                disabled={!selectedBooks.length}
                onClick={() => action(kind, selectedBooks)}
              >
                <Icon name={symbol} />
                {title}
              </button>
            ))}
          </div>
          <button className="finish-selection" onClick={() => setBatch(false)}>
            完成
          </button>
        </section>
      )}
      {!items.length ? (
        <section className="empty library-empty">
          <span className="empty-symbol">
            <Icon name={query ? "search" : folder ? "folder" : "library"} />
          </span>
          <h2>
            {query
              ? "没有找到匹配的书籍"
              : folder
                ? "「" + folder + "」里还没有书"
                : "书库里还没有书"}
          </h2>
          <p>
            {query
              ? "试试其他书名或作者姓名。"
              : "可以导入 EPUB、PDF 或 Markdown。"}
          </p>
          <button
            className="button"
            onClick={() => (query ? clear() : action("import"))}
          >
            {query ? "清除搜索" : "导入书籍"}
          </button>
        </section>
      ) : list ? (
        <table className="list-view">
          <thead>
            <tr>
              {["书名 / 作者", "格式", "阅读进度", "大小", ""].map((h, i) => (
                <th className={i === 2 || i === 3 ? "num" : ""} key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr
                key={b.id}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("button,input"))
                    batch ? toggle(b.id) : open(b);
                }}
              >
                <td>
                  <div className="title-cell">
                    {batch && (
                      <input
                        type="checkbox"
                        checked={checked.includes(b.id)}
                        aria-label={"选择 " + b.title}
                        onChange={() => toggle(b.id)}
                      />
                    )}
                    <div className="mini-cover">
                      <Cover book={b} />
                    </div>
                    <button
                      data-open={b.id}
                      onClick={() => (batch ? toggle(b.id) : open(b))}
                    >
                      <div className="list-book-title">{b.title}</div>
                      <small>
                        {b.author.replace(" / 示例文档", "")}
                        <span className="mobile-format"> / {b.type}</span>
                      </small>
                    </button>
                  </div>
                </td>
                <td className="muted">{b.type}</td>
                <td className="num">
                  {b.progress ? b.progress + "%" : "未读"}
                </td>
                <td className="num muted">{b.size}</td>
                <td>{!batch && menu(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <section className="book-wall" aria-label="藏书书墙">
            {items.map((b) => (
              <article
                className={"wall-item " + (b === current ? "is-selected" : "")}
                key={b.id}
                data-wall-id={b.id}
              >
                <button
                  className="wall-select space-book"
                  data-focus-book={b.id}
                  aria-label={"选择 " + b.title}
                  aria-pressed={b === current}
                  onClick={() => setSelected(b.id)}
                  onDoubleClick={() => open(b)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      open(b);
                    }
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      const next =
                        items[
                          (items.indexOf(b) +
                            (e.key === "ArrowRight" ? 1 : -1) +
                            items.length) %
                            items.length
                        ];
                      setSelected(next.id);
                      document
                        .querySelector<HTMLButtonElement>(
                          '[data-focus-book="' + next.id + '"]',
                        )
                        ?.focus();
                    }
                  }}
                >
                  <div className="wall-scene">
                    <div className="wall-object">
                      <div className="wall-paper" aria-hidden="true" />
                      <Cover book={b} />
                    </div>
                    <span className="wall-selected">
                      <Icon name="check" /> 已选择
                    </span>
                  </div>
                  <span className="wall-title">{b.title}</span>
                  <span className="wall-author">
                    {b.author.replace(" / 示例文档", "")}
                  </span>
                </button>
                <div className="wall-meta">
                  <span>{b.type}</span>
                  <span>{b.progress ? b.progress + "%" : "未读"}</span>
                  {menu(b)}
                </div>
              </article>
            ))}
          </section>
          <footer className="reading-dock" aria-label="选中书籍">
            <div className="dock-book">
              <div className="mini-cover dock-cover">
                <Cover book={current} />
              </div>
              <div>
                <strong>{current.title}</strong>
                <span>
                  {current.progress
                    ? "已读 " + current.progress + "%"
                    : "尚未开始"}
                  <span className="dock-chapter">
                    {" / " + current.chapter}
                  </span>
                </span>
              </div>
            </div>
            <div className="dock-controls">
              <Tool label="上一本" symbol="previous" onClick={() => step(-1)} />
              <Tool label="下一本" symbol="next" onClick={() => step(1)} />
              <button
                className="button primary read-button"
                onClick={() => open(current)}
              >
                {current.progress ? "继续阅读" : "开始阅读"}
                <Icon name="arrow" />
              </button>
            </div>
          </footer>
        </>
      )}
    </>
  );
}
