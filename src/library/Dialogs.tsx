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
    import: "导入书籍",
    rename: "重命名书籍",
    move: "移动到分类",
    delete: "删除藏书",
    folder: "新建分类",
    export: "导出书籍",
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
          "已导入 " +
            n +
            " 本书" +
            (n < ready.length ? "，已跳过重复文件" : ""),
        );
      }
      if (kind === "folder") {
        if (!name.trim()) throw new Error("请输入分类名称");
        await update((s) => {
          if (s.folders.includes(name.trim())) throw new Error("分类已存在");
          return { folders: [...s.folders, name.trim()] };
        });
        notify("已创建分类");
      }
      if (kind === "move") await patchBooks(ids, { folder: target });
      if (kind === "rename") {
        if (!name.trim()) throw new Error("请输入书名");
        await patchBooks(ids, { title: name.trim() });
      }
      if (kind === "delete") {
        await patchBooks(ids, { deleted: true });
        notify("已删除 " + ids.length + " 本书", () =>
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
    import: ready.length ? "导入 " + ready.length + " 本" : "导入书籍",
    folder: "创建",
    move: "移动",
    rename: "保存",
    delete: "删除 " + books.length + " 本书",
    export: "导出",
  }[kind];
  const destination = (
    <div className="destination">
      <Icon name="folder" />
      <span>{kind === "import" ? "导入到分类" : "目标分类"}</span>
      <Select
        label="目标分类"
        value={target}
        change={setTarget}
        options={Object.fromEntries(data.folders.map((f) => [f, f]))}
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
            取消
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
            {busy ? "正在保存…" : confirmLabel}
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
            <strong>选择书籍文件</strong>
            <span>或拖放至此 · EPUB、PDF、Markdown</span>
          </button>
          {queue.length > 0 && (
            <div className="file-review">
              <p className="queue-status" role="status">
                待导入 {ready.length} 本
                {queue.length > ready.length
                  ? " · 将跳过 " + (queue.length - ready.length) + " 项"
                  : ""}
              </p>
              <ul aria-label="所选文件">
                {queue.map((f, i) => (
                  <li key={i}>
                    <Icon name="file" />
                    <span className="file-name">{f.name}</span>
                    <small>
                      {!f.size ? "空文件" : (format(f.name) ?? "格式不支持")}
                    </small>
                    <Tool
                      label={"移除 " + f.name}
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
          <small className="preview-note">
            原文件保存在本地书库。相同内容只保存一份。
          </small>
        </div>
      ) : kind === "rename" || kind === "folder" ? (
        <>
          <label className="dialog-field">
            {kind === "rename" ? "书籍名称" : "分类名称"}
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
            <p className="dialog-note">仅更改书库中的显示名称。</p>
          )}
        </>
      ) : (
        <>
          <ul className="dialog-books" aria-label="所选藏书">
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
            <p className="dialog-note">
              从书库移除后，可在提示中点「撤销」恢复。
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
