import { WheelGestures } from "wheel-gestures";
import type { EpubView } from "./foliate";

export function wheelPaging(
  view: EpubView,
  turn: (direction: number) => void,
  signal: AbortSignal,
) {
  const gestures = WheelGestures({
    preventWheelAction: false,
    reverseSign: false,
  });
  let lastTime = -Infinity;
  let turned = 0;
  let horizontal = false;
  const unsubscribe = gestures.on(
    "wheel",
    ({ event, isStart, isEnding, isMomentum }) => {
      if (isEnding) return;
      const gap = event.timeStamp - lastTime;
      lastTime = event.timeStamp;
      // Sparse mouse strokes may end before the recognizer can measure cadence.
      if (isStart || (!isMomentum && gap >= 100)) turned = 0;
      if (!turned) horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = horizontal ? event.deltaX : event.deltaY;
      if (!delta) return;
      const direction = Math.sign(delta);
      const reversed = turned === -direction;
      if (turned && !reversed) return;
      const inertial =
        isMomentum && (!reversed || ("momentum" in event && event.momentum));
      if (turned && inertial) return;
      const renderer = view.renderer;
      const offset = horizontal ? "scrollLeft" : "scrollTop";
      if (
        renderer.hasAttribute(horizontal ? "overflowing-x" : "overflowing-y")
      ) {
        const before = renderer[offset];
        const unit =
          event.deltaMode === 2
            ? horizontal
              ? renderer.clientWidth
              : renderer.clientHeight
            : event.deltaMode === 1
              ? 18
              : 1;
        renderer[offset] += delta * unit;
        if (renderer[offset] !== before) return;
      }
      if (inertial) return;
      turned = direction;
      turn(direction);
    },
  );
  signal.addEventListener("abort", unsubscribe, { once: true });
  return (event: WheelEvent) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.defaultPrevented ||
      !view.renderer
    )
      return;
    event.preventDefault();
    // Page iframes have independent time origins. Use one clock for all surfaces.
    gestures.feedWheel({
      deltaMode: event.deltaMode,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      timeStamp:
        (event.view?.performance.timeOrigin ?? performance.timeOrigin) +
        event.timeStamp,
      momentum: (event as WheelEvent & { momentum?: boolean }).momentum,
    });
  };
}
