import {
  useEffect,
  useState,
  type ReactNode,
  type CSSProperties,
  type ComponentProps,
} from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as DialogPrimitive from "@radix-ui/react-dialog";
export { Button } from "./button";
import icons from "./icons.json";
import { files } from "../storage/files";
import wordmark from "./wordmark.svg?raw";
import jackets from "../library/jackets.json";
import type { Book, Paper, Preferences } from "../model";
export function Icon({ name }: { name: string }) {
  return (
    <svg
      className="ui-glyph"
      data-symbol={name}
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      {name === "sidebar" && (
        <path
          className="sidebar-pane"
          d="M5 4h4v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
          stroke="none"
        />
      )}
      <path d={icons[name as keyof typeof icons]} />
    </svg>
  );
}
export function Brand({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      <svg
        className={mobile ? "mobile-brand brand-symbol" : "brand-symbol"}
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <path d="M5 4 15 10V19L25 13V4L35 10V36L25 30V21L15 27V36L5 30Z" />
      </svg>
      {!mobile && (
        <span
          className="brand-name"
          dangerouslySetInnerHTML={{ __html: wordmark }}
        />
      )}
    </>
  );
}
export function useObjectUrl(key?: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl("");
    if (!key) return;
    let active = true,
      release: (() => void) | undefined;
    files
      .url(key)
      .then((s) => {
        if (active) {
          release = s.release;
          setUrl(s.url);
        } else s.release();
      })
      .catch(() => {});
    return () => {
      active = false;
      release?.();
    };
  }, [key]);
  return url;
}
export function Cover({ book }: { book: Book }) {
  const image = useObjectUrl(book.cover);
  const svg = Object.hasOwn(jackets, book.style)
    ? jackets[book.style as keyof typeof jackets]
    : null;
  return (
    <div className={"book-cover cover-" + book.style} aria-hidden="true">
      {image ? (
        <img className="import-cover" src={image} alt="" />
      ) : svg ? (
        <svg
          className="jacket-face"
          viewBox="0 0 256 358"
          focusable="false"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <svg className="jacket-face" viewBox="0 0 256 358">
          <text x="24" y="62" className="jacket-sans" fontSize="16">
            {book.type}
          </text>
          <text x="24" y="171" className="jacket-serif" fontSize="20">
            {Array.from(book.title).slice(0, 10).join("")}
          </text>
          <path d="M24 317h208" stroke="currentColor" opacity=".35" />
        </svg>
      )}
      <span className="jacket-binding" />
    </div>
  );
}
export function Tool({
  symbol,
  label,
  className = "icon-button",
  ...props
}: ComponentProps<"button"> & { symbol: string; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={className}
      {...props}
    >
      {symbol === "type" ? (
        <span className="type-symbol">Aa</span>
      ) : (
        <Icon name={symbol} />
      )}
    </button>
  );
}
export interface Option {
  label: string;
  run: () => void;
  icon?: string;
  checked?: boolean;
  danger?: boolean;
  divider?: boolean;
}
export function Menu({
  label,
  trigger,
  options,
}: {
  label: string;
  trigger: ReactNode;
  options: Option[];
}) {
  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="menu library-popup"
          aria-label={label}
          align="end"
          sideOffset={6}
          collisionPadding={8}
          loop
        >
          {options.map((o) => (
            <div key={o.label}>
              {o.divider && <hr />}
              <Dropdown.Item asChild onSelect={o.run}>
                <button
                  type="button"
                  className={o.danger ? "destructive" : ""}
                  role={o.checked === undefined ? "menuitem" : "menuitemradio"}
                  aria-checked={o.checked}
                >
                  {o.icon && <Icon name={o.icon} />}
                  <span>{o.label}</span>
                  {o.checked && <Icon name="check" />}
                </button>
              </Dropdown.Item>
            </div>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
export function Select({
  label,
  value,
  options,
  change,
  icon,
  id,
  extra = [],
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  change: (key: string) => void;
  icon?: string;
  id?: string;
  extra?: Option[];
}) {
  return (
    <Menu
      label={label}
      trigger={
        <button
          type="button"
          className="tool-trigger field-trigger"
          aria-label={label + "，" + options[value]}
          id={id}
        >
          {icon && <Icon name={icon} />}
          <span>{options[value]}</span>
          <Icon name="down" />
        </button>
      }
      options={[
        ...Object.entries(options).map(([key, title]) => ({
          label: title,
          checked: key === value,
          run: () => change(key),
        })),
        ...extra,
      ]}
    />
  );
}
export function Modal({
  title,
  children,
  footer,
  close,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  close: () => void;
}) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(opened) => {
        if (!opened) close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-backdrop" />
        <DialogPrimitive.Content
          className="modal library-dialog app-modal"
          aria-describedby={undefined}
        >
          <div className="row between">
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            <Tool symbol="close" label="关闭对话框" onClick={close} />
          </div>
          <div className="dialog-content">{children}</div>
          {footer && <div className="modal-actions">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export const papers = { light: "素白", paper: "暖纸", dark: "墨夜" };
export function Papers({
  value,
  change,
}: {
  value: Paper;
  change: (p: Paper) => void;
}) {
  return (
    <div className="paper-choices">
      {(Object.keys(papers) as Paper[]).map((p) => (
        <button
          className="paper-choice"
          aria-pressed={value === p}
          key={p}
          onClick={() => change(p)}
        >
          <span className={"paper-sample " + p}>Aa</span>
          <span>{papers[p]}</span>
          {value === p && <Icon name="check" />}
        </button>
      ))}
    </div>
  );
}
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  change,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  change: (n: number) => void;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      style={
        {
          "--range-fill":
            (max > min ? ((value - min) / (max - min)) * 100 : 0) + "%",
        } as CSSProperties
      }
      onChange={(e) => change(e.target.valueAsNumber)}
    />
  );
}
export function TypeControls({
  prefs,
  change,
  latin = false,
}: {
  prefs: Preferences;
  change: (p: Partial<Preferences>) => void;
  latin?: boolean;
}) {
  const faces = {
    serif: "衬线",
    sans: "无衬线",
    ...(prefs.customFont ? { custom: "自定义字体" } : {}),
  };
  return (
    <div className="type-controls">
      {(["chinese", ...(latin ? ["latin"] : [])] as const).map((key) => (
        <div key={key} className="face-row">
          <span>{key === "latin" ? "西文字体" : "中文字体"}</span>
          <Select
            label={key === "latin" ? "西文字体" : "中文字体"}
            options={faces}
            value={prefs[key as "chinese" | "latin"]}
            change={(v) => change({ [key]: v })}
          />
        </div>
      ))}
      {(
        [
          {
            key: "size",
            label: "字号",
            unit: " px",
            min: 16,
            max: 30,
            step: 1,
          },
          {
            key: "leading",
            label: "行距",
            unit: " 倍",
            min: 1.5,
            max: 2.4,
            step: 0.05,
          },
        ] as const
      ).map((v) => (
        <label className="type-slider" key={v.key}>
          {v.label}
          <output>{prefs[v.key] + v.unit}</output>
          <Range
            label={v.label}
            value={prefs[v.key]}
            {...{ min: v.min, max: v.max, step: v.step }}
            change={(n) => change({ [v.key]: n })}
          />
        </label>
      ))}
    </div>
  );
}
export const typeStyle = (prefs: Preferences) =>
  ({
    "--reader-size": prefs.size + "px",
    "--reader-leading": prefs.leading,
    "--reading-face":
      (prefs.latin === "custom"
        ? "UserReading"
        : prefs.latin === "serif"
          ? "Georgia"
          : "Arial") +
      ", " +
      (prefs.chinese === "custom"
        ? "UserReading"
        : prefs.chinese === "serif"
          ? "var(--font-reading)"
          : "var(--font-ui)"),
  }) as CSSProperties;
