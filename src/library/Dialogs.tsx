import { t } from "../i18n";
import { collectionName } from "./labels";
import { useRef, useState } from "react";
import type { Action } from "./Shelf";
import type { Book, Catalog } from "../model";
import { Button, Icon, Modal, Select, Tool } from "../ui/controls";
import { patchBooks, update } from "../storage/catalog";
import { format, importBooks } from "../storage/transfer";
export type Notify = (
  message: string,
  undo?: () => void | Promise<void>,
) => void;
export function LibraryDialog({
  kind,
  books,
  data,
  folder,
  close,
  afterImport,
  notify,
}: {
  kind: Action;
  books: Book[];
  data: Catalog;
  folder: string;
  close: () => void;
  afterImport: (folder: string) => void;
  notify: Notify;
}) {
  const [name, setName] = useState(
    kind === "rename" ? (books[0]?.title ?? "") : "",
  );
  const [target, setTarget] = useState(folder || data.folders[0]),
    [queue, setQueue] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ready = queue.filter((file) => format(file.name) && file.size);
  const title = {
    import: t("library.import"),
    rename: t("dialog.rename"),
    move: t("dialog.move"),
    delete: t("dialog.delete"),
    folder: t("dialog.folder"),
    export: t("dialog.export"),
  }[kind];
  function stage(files: FileList | null) {
    if (files)
      setQueue((q) => [
        ...q,
        ...Array.from(files).filter(
          (f) =>
            !q.some(
              (o) =>
                o.name === f.name &&
                o.size === f.size &&
                o.lastModified === f.lastModified,
            ),
        ),
      ]);
  }
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const ids = books.map((b) => b.id);
      if (kind === "import") {
        const n = await importBooks(ready, target);
        afterImport(target);
        notify(
          t("notice.imported", { count: n }) +
            (n < ready.length ? t("import.duplicate") : ""),
        );
      }
      if (kind === "folder") {
        if (!name.trim()) throw new Error(t("error.folderName"));
        await update((s) => {
          if (s.folders.includes(name.trim()))
            throw new Error(t("error.folderExists"));
          return { folders: [...s.folders, name.trim()] };
        });
        notify(t("notice.folderCreated"));
      }
      if (kind === "move") await patchBooks(ids, { folder: target });
      if (kind === "rename") {
        if (!name.trim()) throw new Error(t("error.bookTitle"));
        await patchBooks(ids, { title: name.trim() });
      }
      if (kind === "delete") {
        await patchBooks(ids, { deleted: true });
        notify(t("notice.deleted", { count: ids.length }), () =>
          patchBooks(ids, { deleted: false }),
        );
      }
      close();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
  const confirmLabel = {
    import: ready.length
      ? t("import.confirm", { count: ready.length })
      : t("library.import"),
    folder: t("action.create"),
    move: t("action.move"),
    rename: t("action.save"),
    delete: t("delete.confirm", { count: books.length }),
    export: t("action.export"),
  }[kind];
  const destination = (
    <div className="destination">
      <Icon name="folder" />
      <span>
        {kind === "import" ? t("import.collection") : t("dialog.destination")}
      </span>
      <Select
        label={t("dialog.destination")}
        value={target}
        change={setTarget}
        options={Object.fromEntries(
          data.folders.map((f) => [f, collectionName(f)]),
        )}
      />
    </div>
  );
  return (
    <Modal
      title={title}
      close={() => {
        if (!busy) close();
      }}
      footer={
        <>
          <Button disabled={busy} onClick={close}>
            {t("action.cancel")}
          </Button>
          <Button
            variant={kind === "delete" ? "destructive" : "primary"}
            disabled={
              busy ||
              (kind === "import" && !ready.length) ||
              (["rename", "folder"].includes(kind) && !name.trim())
            }
            onClick={confirm}
          >
            {busy ? t("action.saving") : confirmLabel}
          </Button>
        </>
      }
    >
      {kind === "import" ? (
        <div
          className="import-workbench"
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            stage(e.dataTransfer.files);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
        >
          <input
            type="file"
            ref={input}
            id="import-files"
            accept=".epub,.pdf,.md,.markdown"
            multiple
            hidden
            onChange={(e) => {
              stage(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            className={"file-drop " + (over ? "over" : "")}
            onClick={() => input.current?.click()}
          >
            <span className="drop-symbol">
              <Icon name="importBook" />
            </span>
            <strong>{t("import.choose")}</strong>
            <span>{t("import.drop")}</span>
          </button>
          {queue.length > 0 && (
            <div className="file-review">
              <p className="queue-status" role="status">
                {t("import.ready", { count: ready.length })}
                {queue.length > ready.length
                  ? t("import.skipped", { count: queue.length - ready.length })
                  : ""}
              </p>
              <ul aria-label={t("import.files")}>
                {queue.map((f, i) => (
                  <li key={i}>
                    <Icon name="file" />
                    <span className="file-name">{f.name}</span>
                    <small>
                      {!f.size
                        ? t("import.empty")
                        : (format(f.name) ?? t("import.unsupported"))}
                    </small>
                    <Tool
                      label={t("import.remove", { name: f.name })}
                      symbol="close"
                      onClick={() =>
                        setQueue((q) => q.filter((_, n) => n !== i))
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {destination}
          <small className="preview-note">{t("import.local")}</small>
        </div>
      ) : kind === "rename" || kind === "folder" ? (
        <>
          <label className="dialog-field">
            {kind === "rename"
              ? t("dialog.bookName")
              : t("dialog.collectionName")}
            <input
              className="field-input"
              autoFocus
              maxLength={kind === "rename" ? 120 : 80}
              value={name}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (!e.nativeEvent.isComposing && e.key === "Enter")
                  void confirm();
              }}
            />
          </label>
          {kind === "rename" && (
            <p className="dialog-note">{t("dialog.renameHint")}</p>
          )}
        </>
      ) : (
        <>
          <ul className="dialog-books" aria-label={t("dialog.selected")}>
            {books.map((b) => (
              <li key={b.id}>
                <Icon name="book" />
                <span>{b.title}</span>
                <small>{b.type}</small>
              </li>
            ))}
          </ul>
          {kind === "move" ? (
            destination
          ) : (
            <p className="dialog-note">{t("dialog.undoHint")}</p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
