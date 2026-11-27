import type { EpubView } from "./foliate";

// Contacts within this radius are taps, including minor movement while lifting.
const tapSlop = 6;

export function bindSwipe(
  surface: HTMLElement,
  view: EpubView,
  turn: (direction: number) => void,
  signal?: AbortSignal,
) {
  let start: Touch | undefined;
  const selection = () => surface.ownerDocument.getSelection();
  function direction(touch: Touch) {
    if (!view.renderer || !start || touch.identifier !== start.identifier)
      return 0;
    const dx = start.clientX - touch.clientX;
    const dy = start.clientY - touch.clientY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < tapSlop) return 0;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    return Math.sign(horizontal ? (view.renderer.rtl ? -dx : dx) : dy);
  }
  surface.addEventListener(
    "touchstart",
    (e) => {
      start =
        e.touches.length === 1 &&
        selection()?.isCollapsed &&
        (window.visualViewport?.scale ?? 1) <= 1
          ? e.touches[0]
          : undefined;
    },
    { passive: true, signal },
  );
  surface.addEventListener(
    "touchmove",
    (e) => {
      if (!start) return;
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !selection()?.isCollapsed) {
        start = undefined;
        return;
      }
      if (!direction(touch)) return;
      const dx = start.clientX - touch.clientX;
      const dy = start.clientY - touch.clientY;
      const renderer = view.renderer;
      if (!renderer) return;
      // Let a zoomed page pan natively until a fresh swipe starts at its edge.
      if (
        Math.abs(dy) > Math.abs(dx) &&
        renderer.hasAttribute("overflowing-y") &&
        (dy < 0
          ? renderer.scrollTop > 1
          : renderer.scrollTop + renderer.clientHeight <
            renderer.scrollHeight - 1)
      ) {
        start = undefined;
        return;
      }
      if (e.cancelable) e.preventDefault();
    },
    { passive: false, signal },
  );
  surface.addEventListener(
    "touchend",
    (e) => {
      const step =
        start && e.touches.length === 0 && selection()?.isCollapsed
          ? direction(e.changedTouches[0])
          : 0;
      start = undefined;
      if (!step) return;
      if (e.cancelable) e.preventDefault();
      turn(step);
    },
    { passive: false, signal },
  );
  surface.addEventListener(
    "touchcancel",
    () => {
      start = undefined;
    },
    { passive: true, signal },
  );
}
