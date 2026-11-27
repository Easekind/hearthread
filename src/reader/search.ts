import { t } from "../i18n";
import type { SearchHit } from "./engine";
import type { EpubView, Publication } from "./foliate";

const moduleUrl = (file: string) =>
  new URL("/foliate/" + file, location.href).href;
export const loadSearch = () =>
  import(/* @vite-ignore */ moduleUrl("search.js"));
export const searchLimit = 150;

function passageExcerpt(range: Range, excerpt: SearchHit["excerpt"]) {
  const block = range.startContainer.parentElement?.closest(
    "p,li,blockquote,pre,td,h1,h2,h3,h4,h5,h6",
  );
  if (!block?.contains(range.endContainer)) return excerpt;
  const before = range.cloneRange(),
    after = range.cloneRange();
  before.selectNodeContents(block);
  before.setEnd(range.startContainer, range.startOffset);
  after.selectNodeContents(block);
  after.setStart(range.endContainer, range.endOffset);
  const pre = before.toString().replace(/\s+/g, " "),
    post = after.toString().replace(/\s+/g, " ");
  return {
    pre: (pre.length > 48 ? "…" : "") + pre.slice(-48),
    match: range.toString(),
    post: post.slice(0, 48) + (post.length > 48 ? "…" : ""),
  };
}

export async function searchPublication(
  book: Publication,
  view: EpubView,
  query: string,
  signal: AbortSignal,
  title: string,
) {
  if (book.search) return book.search(query, signal);
  const [{ searchMatcher }, { textWalker }] = await Promise.all([
    loadSearch(),
    import(/* @vite-ignore */ moduleUrl("text-walker.js")),
  ]);
  const match = searchMatcher(textWalker, {
    defaultLocale: view.language.canonical,
  });
  const hits: SearchHit[] = [];
  for (const [index, section] of book.sections.entries()) {
    if (signal.aborted) break;
    const doc = await section.createDocument?.();
    if (!doc || signal.aborted) continue;
    for (const { range, excerpt } of match(doc, query)) {
      const item = view.getProgressOf(index, range).tocItem;
      const target = view.getCFI(index, range);
      hits.push({
        section: index,
        target,
        groupId: item?.href ?? section.id,
        group:
          item?.label ||
          (book.sections.length === 1
            ? title
            : t("reader.chapter", { number: index + 1 })),
        excerpt: passageExcerpt(range, excerpt),
        anchor: view.resolveCFI(target).anchor,
      });
      if (hits.length === searchLimit) return hits;
    }
  }
  return hits;
}

export function highlightHit(view: EpubView, hit?: SearchHit, reveal = false) {
  for (const { index, doc } of view.renderer.getContents()) {
    const win = doc?.defaultView;
    if (!win?.CSS.highlights) continue;
    const registry = win.CSS.highlights;
    registry.delete("found-passage");
    if (index !== hit?.section || !hit) continue;
    let range;
    // A large spine item can have multiple chunk documents mounted at once.
    try {
      range = hit.anchor(doc);
    } catch {
      continue;
    }
    if (!range || range.collapsed || !range.getClientRects().length) continue;
    registry.set("found-passage", new win.Highlight(range));
    if (reveal && view.renderer.hasAttribute("overflowing-y")) {
      const frame = win.frameElement!.getBoundingClientRect();
      const rect = range.getBoundingClientRect();
      const viewport = view.renderer.getBoundingClientRect();
      if (
        frame.top + rect.bottom > viewport.bottom ||
        frame.top + rect.top < viewport.top
      )
        view.renderer.scrollTop +=
          frame.top + rect.top - viewport.top - viewport.height / 3;
    }
  }
}
