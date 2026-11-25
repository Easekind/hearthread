// Markdown and the built-in chapters share a vertical scroll surface in
// single-page mode and a horizontally paginated article in two-page mode.
export function textViewport(content: HTMLElement, dual: boolean) {
  const layer = content.closest<HTMLElement>(".reading-layer")!;
  const article = content.querySelector<HTMLElement>(".reading-content");
  const host = dual ? content : layer;
  const offset = () => (dual ? host.scrollLeft : host.scrollTop);
  const extent = () =>
    dual
      ? host.scrollWidth - host.clientWidth
      : host.scrollHeight - host.clientHeight;
  const fraction = () => (extent() > 0 ? offset() / extent() : 0);
  const stride = () =>
    host.clientWidth + parseFloat(getComputedStyle(article!).columnGap);

  function measure() {
    if (!dual || !article) return;
    const step = stride();
    const gap = step - host.clientWidth;
    const screens = Math.ceil((article.scrollWidth + gap - 1) / step);
    // Give an unpaired final column a full spread to scroll into.
    content.style.setProperty("--spread-width", screens * step - gap + "px");
  }

  function restore(fraction: number) {
    const value = fraction * extent();
    if (dual) host.scrollLeft = Math.round(value / stride()) * stride();
    else host.scrollTop = value;
  }

  function reveal(target?: Element | Range) {
    if (!target) return;
    const rect = target.getClientRects()[0];
    if (!rect) return;
    if (dual) {
      const left =
        host.scrollLeft + rect.left - host.getBoundingClientRect().left;
      host.scrollLeft = Math.floor((left + 1) / stride()) * stride();
    } else if (target instanceof Range) {
      host.scrollTop += rect.top - host.clientHeight * 0.15;
    } else target.scrollIntoView({ block: "center" });
  }

  function turn(direction: number) {
    const before = offset();
    if (dual)
      host.scrollLeft = (Math.round(before / stride()) + direction) * stride();
    else host.scrollBy({ top: direction * host.clientHeight * 0.87 });
    return Math.abs(offset() - before) > 1;
  }

  function isVisible(target: Element) {
    const bounds = host.getBoundingClientRect();
    return Array.from(target.getClientRects()).some(
      (rect) =>
        rect.right > bounds.left &&
        rect.left < bounds.right &&
        rect.bottom > bounds.top &&
        rect.top < bounds.bottom,
    );
  }

  function sectionAtStart(headings: Element[]) {
    const bounds = host.getBoundingClientRect();
    const top = dual ? article!.getBoundingClientRect().top : bounds.top;
    const current = headings.findLastIndex((heading) => {
      const rect = heading.getBoundingClientRect();
      if (!dual) return rect.top <= top + 1;
      return (
        rect.right <= bounds.left + 1 ||
        (rect.left <= bounds.left + 1 && rect.top <= top + 1)
      );
    });
    return current < 0 && headings[0] && isVisible(headings[0]) ? 0 : current;
  }

  return {
    host,
    article,
    fraction,
    measure,
    restore,
    reveal,
    turn,
    isVisible,
    sectionAtStart,
  };
}

// Keep a character on screen even when one paragraph spans several columns.
export function visiblePassage(nodes: HTMLElement[]) {
  const visible = (rect: DOMRect) =>
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.left >= 0 &&
    rect.left < window.innerWidth;
  const node = nodes.find((el) =>
    Array.from(el.getClientRects()).some(visible),
  );
  if (!node) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  const line = Array.from(range.getClientRects()).find(visible);
  if (line) {
    const caret = document.caretRangeFromPoint?.(
      line.left + 1,
      Math.max(0, line.top) + 1,
    );
    if (caret && node.contains(caret.startContainer)) return caret;
  }
  return node;
}
