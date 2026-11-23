import { useEffect, useRef, type PointerEvent } from "react";
/** The same spring drives the drawer entrance, touch drag and dismissal. */
export function useSheet(close: () => void) {
  const drawer = useRef<HTMLElement>(null),
    scrim = useRef<HTMLDivElement>(null),
    onClose = useRef(close);
  onClose.current = close;
  const motion = useRef({ position: 0, velocity: 0, frame: 0 }),
    drag = useRef<{
      start: number;
      offset: number;
      samples: number[][];
    } | null>(null);
  const mobile = () => matchMedia("(max-width:600px)").matches;
  const extent = () =>
    mobile()
      ? drawer.current!.offsetHeight + 2
      : drawer.current!.offsetWidth + 20;
  function paint() {
    if (!drawer.current) return;
    const p = motion.current.position;
    drawer.current.style.transform =
      (mobile() ? "translateY(" : "translateX(") + p + "px)";
    if (scrim.current)
      scrim.current.style.opacity = String(
        Math.max(0, Math.min(1, 1 - p / extent())),
      );
  }
  const reduced = () =>
    document.documentElement.dataset.input === "keyboard" ||
    matchMedia("(prefers-reduced-motion:reduce)").matches;
  function settle(target: number) {
    const state = motion.current;
    cancelAnimationFrame(state.frame);
    if (reduced()) {
      state.position = target;
      paint();
      if (target) onClose.current();
      return;
    }
    let previous = performance.now();
    function tick(now: number) {
      if (!drawer.current) return;
      const dt = Math.min(0.032, (now - previous) / 1000),
        omega = (2 * Math.PI) / 0.32,
        offset = state.position - target,
        slope = state.velocity + omega * offset,
        decay = Math.exp(-omega * dt);
      previous = now;
      state.position = target + (offset + slope * dt) * decay;
      state.velocity = (state.velocity - omega * slope * dt) * decay;
      if (
        Math.abs(target - state.position) < 0.35 &&
        Math.abs(state.velocity) < 6
      ) {
        state.position = target;
        state.velocity = 0;
        paint();
        if (target) onClose.current();
        return;
      }
      paint();
      state.frame = requestAnimationFrame(tick);
    }
    state.frame = requestAnimationFrame(tick);
  }
  useEffect(() => {
    drawer.current?.focus();
    motion.current.position = reduced() ? 0 : extent();
    paint();
    settle(0);
    return () => cancelAnimationFrame(motion.current.frame);
  }, []);
  function end(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const [time, y] = d.samples[0],
      elapsed = e.timeStamp - time;
    motion.current.velocity =
      elapsed > 0 && elapsed < 140 ? ((e.clientY - y) * 1000) / elapsed : 0;
    drag.current = null;
    settle(
      e.type === "pointerup" &&
        motion.current.position + motion.current.velocity * 0.199 >
          extent() * 0.32
        ? extent()
        : 0,
    );
  }
  return {
    drawer,
    scrim,
    dismiss: () => settle(extent()),
    handle: {
      onPointerDown(e: PointerEvent<HTMLDivElement>) {
        if (e.button !== 0 || !e.isPrimary) return;
        cancelAnimationFrame(motion.current.frame);
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          start: e.clientY,
          offset: motion.current.position,
          samples: [[e.timeStamp, e.clientY]],
        };
      },
      onPointerMove(e: PointerEvent<HTMLDivElement>) {
        const d = drag.current;
        if (!d) return;
        const next = d.offset + e.clientY - d.start;
        motion.current.position =
          next >= 0 ? next : next / (2 + Math.abs(next) / 40);
        d.samples.push([e.timeStamp, e.clientY]);
        d.samples = d.samples.filter(([t]) => e.timeStamp - t <= 90);
        paint();
      },
      onPointerCancel: end,
      onPointerUp: end,
    },
  };
}
