import { t } from "../i18n";
import { collectionName, chapterLabel } from "./labels";
import { useState } from "react";
import type { Book, Catalog } from "../model";
import { Cover, Icon, Menu, Select, Tool } from "../ui/controls";
import { patchBooks, patchPrefs } from "../storage/catalog";
export type Action =
  | "import"
  | "rename"
  | "move"
  | "delete"
  | "export"
  | "folder";
export interface ShelfProps {
  data: Catalog;
  query: string;
  clear: () => void;
  folder: string;
  setFolder: (v: string) => void;
  open: (b: Book) => void;
  action: (kind: Action, books?: Book[]) => void;
}
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
  const sorts = {
    recent: t("sort.recent"),
    added: t("sort.added"),
    title: t("sort.title"),
  };
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
          : a.title.localeCompare(b.title, prefs.locale),
    );
  const current = items.find((b) => b.id === selected) ?? items[0],
    list = prefs.view === "list" || batch;
  const chapter = current && chapterLabel(current);
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
        label={t("book.actions", { title: b.title })}
        trigger={
          <button
            type="button"
            className="icon-button"
            data-book-menu={b.id}
            aria-label={t("book.more", { title: b.title })}
          >
            <Icon name="more" />
          </button>
        }
        options={[
          { label: t("book.open"), icon: "book", run: () => open(b) },
          {
            label: b.pinned ? t("book.unpin") : t("book.pin"),
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
              ["rename", "edit", t("action.rename")],
              ["move", "moveBook", t("dialog.move")],
              ["export", "exportBook", t("book.export")],
              ["delete", "trash", t("action.delete")],
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
          <h1>{query ? t("library.results") : t("library.heading")}</h1>
          <span>{t("library.count", { count: items.length })}</span>
        </div>
        <div className="view-switch" aria-label={t("library.view")}>
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
              {v === "grid" ? t("view.grid") : t("view.list")}
            </button>
          ))}
        </div>
      </header>
      <div className="wall-toolbar library-tools">
        <span className="toolbar-summary">
          {query ? t("library.query", { query }) : ""}
        </span>
        <div className="library-tool-actions">
          <Select
            label={t("library.filter")}
            value={folder}
            change={(v) => {
              setFolder(v);
              check([]);
            }}
            options={{
              "": t("library.allCollections"),
              ...Object.fromEntries(
                data.folders.map((f) => [f, collectionName(f)]),
              ),
            }}
            icon="folder"
            extra={[
              {
                label: t("dialog.folder"),
                icon: "plus",
                divider: true,
                run: () => action("folder"),
              },
            ]}
          />
          <Select
            label={t("library.sort")}
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
              {t("library.manage")}
            </button>
          )}
        </div>
      </div>
      {batch && (
        <section className="selection-bar" aria-label={t("library.batch")}>
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
                ? t("selection.clear")
                : t("selection.all")}
            </button>
            <span>{t("selection.count", { count: selectedBooks.length })}</span>
          </div>
          <div className="selection-ops">
            {(
              [
                ["move", "moveBook", t("action.move")],
                ["export", "exportBook", t("action.export")],
                ["delete", "trash", t("action.delete")],
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
            {t("action.done")}
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
              ? t("library.noResults")
              : folder
                ? t("collection.empty", { name: collectionName(folder) })
                : t("library.empty")}
          </h2>
          <p>{query ? t("library.trySearch") : t("library.importHint")}</p>
          <button
            className="button"
            onClick={() => (query ? clear() : action("import"))}
          >
            {query ? t("search.clear") : t("library.import")}
          </button>
        </section>
      ) : list ? (
        <table className="list-view">
          <thead>
            <tr>
              {[
                t("book.titleAuthor"),
                t("book.format"),
                t("book.progress"),
                t("book.size"),
                "",
              ].map((h, i) => (
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
                  if ((e.target as HTMLElement).closest("button,input")) return;
                  if (batch) toggle(b.id);
                  else open(b);
                }}
              >
                <td>
                  <div className="title-cell">
                    {batch && (
                      <input
                        type="checkbox"
                        checked={checked.includes(b.id)}
                        aria-label={t("book.select", { title: b.title })}
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
                        {b.object
                          ? b.author
                          : b.author.replace(" / 示例文档", "")}
                        <span className="mobile-format"> / {b.type}</span>
                      </small>
                    </button>
                  </div>
                </td>
                <td className="muted">{b.type}</td>
                <td className="num">
                  {b.progress ? b.progress + "%" : t("book.unread")}
                </td>
                <td className="num muted">{b.size}</td>
                <td>{!batch && menu(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <section className="book-wall" aria-label={t("library.wall")}>
            {items.map((b) => (
              <article
                className={"wall-item " + (b === current ? "is-selected" : "")}
                key={b.id}
                data-wall-id={b.id}
              >
                <button
                  className="wall-select space-book"
                  data-focus-book={b.id}
                  aria-label={t("book.select", { title: b.title })}
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
                      <Icon name="check" /> {t("selection.selected")}
                    </span>
                  </div>
                  <span className="wall-title">{b.title}</span>
                  <span className="wall-author">
                    {b.object ? b.author : b.author.replace(" / 示例文档", "")}
                  </span>
                </button>
                <div className="wall-meta">
                  <span>{b.type}</span>
                  <span>
                    {b.progress ? b.progress + "%" : t("book.unread")}
                  </span>
                  {menu(b)}
                </div>
              </article>
            ))}
          </section>
          <footer className="reading-dock" aria-label={t("library.current")}>
            <div className="dock-book">
              <div className="mini-cover dock-cover">
                <Cover book={current} />
              </div>
              <div>
                <strong>{current.title}</strong>
                <span>
                  {current.progress
                    ? t("book.percent", { percent: current.progress })
                    : t("book.notStarted")}
                  <span className="dock-chapter">
                    {chapter && " / " + chapter}
                  </span>
                </span>
              </div>
            </div>
            <div className="dock-controls">
              <Tool
                label={t("book.previous")}
                symbol="previous"
                onClick={() => step(-1)}
              />
              <Tool
                label={t("book.next")}
                symbol="next"
                onClick={() => step(1)}
              />
              <button
                className="button primary read-button"
                onClick={() => open(current)}
              >
                {current.progress ? t("book.resume") : t("book.start")}
                <Icon name="arrow" />
              </button>
            </div>
          </footer>
        </>
      )}
    </>
  );
}
