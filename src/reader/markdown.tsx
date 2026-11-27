import { renderToStaticMarkup } from "react-dom/server";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

// The paginator consumes passive chapter documents. Keep the same Markdown
// policy in the display document and the detached document used for search.
export function openMarkdown(text: string, title: string) {
  const html = renderToStaticMarkup(
    <Markdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      urlTransform={(url, key) =>
        key === "src" && /^data:image\/(jpeg|gif|png|webp);base64,/i.test(url)
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
      }}
    >
      {text}
    </Markdown>,
  );
  const doc = document.implementation.createHTMLDocument("");
  doc.head.innerHTML = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src blob: data:"><style>
    img,table {max-width:100%} pre {white-space:pre-wrap} body {overflow-wrap:anywhere}
    table {border-collapse:collapse} td,th {border:1px solid currentColor;padding:.2em .5em}
  </style>`;
  doc.body.className = "markdown-content";
  doc.body.innerHTML = html;
  const ids = new Set([...doc.querySelectorAll("[id]")].map((el) => el.id));
  const toc = [...doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => {
    const label = h.textContent.trim();
    const base = label.toLowerCase().replace(/\s+/g, "-") || "section";
    let id = base;
    for (let suffix = 2; ids.has(id); suffix++) id = base + "-" + suffix;
    ids.add(id);
    h.id = id;
    return { label, href: "#" + encodeURIComponent(id) };
  });

  // Locate a saved fraction in the complete source document. Foliate's CFI
  // maps that range into the displayed chapter, including split long chapters.
  const blocks = [...doc.body.children];
  let length = 0;
  const starts = new Map(
    blocks.map((block) => {
      const start = length;
      length += Math.max(1, block.textContent.length);
      return [block, start] as const;
    }),
  );
  function fractionAt(range: Range) {
    const node = range.startContainer;
    let block =
      node === doc.body
        ? (doc.body.childNodes[range.startOffset] as Node | undefined)
        : node;
    while (block && block.parentNode !== doc.body)
      block = block.parentNode ?? undefined;
    if (!block) return 0;
    const start = starts.get(block as Element);
    if (start == null) return 0;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(block);
    if (block.contains(node)) prefix.setEnd(node, range.startOffset);
    else prefix.collapse(true);
    return (start + prefix.toString().length) / length;
  }
  function rangeAt(fraction: number) {
    const offset = Math.min(
      length - 1,
      Math.max(0, Math.round(fraction * length)),
    );
    const block = blocks.findLast((el) => starts.get(el)! <= offset);
    if (!block) return undefined;
    const range = doc.createRange();
    range.selectNodeContents(block);
    let remaining = offset - starts.get(block)!;
    const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const size = text.textContent!.length;
      if (remaining < size) {
        range.setStart(text, remaining);
        break;
      }
      remaining -= size;
    }
    range.collapse(true);
    return range;
  }
  const data = new XMLSerializer().serializeToString(doc);
  const fragment = (target: Document, hash: string) => {
    try {
      return target.getElementById(decodeURIComponent(hash));
    } catch {
      return null;
    }
  };
  return {
    metadata: { title },
    sections: [
      {
        id: "body",
        size: new Blob([data]).size,
        load: () => "about:blank",
        loadContent: () => data,
        createDocument: () =>
          new DOMParser().parseFromString(data, "application/xhtml+xml"),
      },
    ],
    toc,
    textPosition: { doc, fractionAt, rangeAt },
    splitTOCHref: (href: string) => ["body", href.slice(1)],
    getTOCFragment: fragment,
    isExternal: (href: string) => /^(?:https?:|mailto:)/i.test(href),
    resolveHref: (href: string) => {
      if (href.startsWith("#"))
        return {
          index: 0,
          anchor: (target: Document) => fragment(target, href.slice(1)),
        };
      return null;
    },
  };
}
