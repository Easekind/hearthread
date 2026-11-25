// One position and velocity are shared by dragging, settling and dismissal.
const sheetMotion = { position: 0, velocity: 0, target: 0, frame: 0, pointer: null };
const compactSheet = () => matchMedia('(max-width:600px)').matches;
function sheetExtent(panel) {
  return compactSheet() ? panel.offsetHeight + 2 : panel.offsetWidth + 20;
}
function paintSheet(panel) {
  const distance = sheetMotion.position;
  panel.style.transform = compactSheet() ? `translateY(${distance}px)` : `translateX(${distance}px)`;
  document.documentElement.style.setProperty('--sheet-opacity', String(Math.min(1, Math.max(0, 1 - distance / sheetExtent(panel)))));
}
function settleSheet(target) {
  const state = sheetMotion;
  cancelAnimationFrame(state.frame);
  state.target = target;
  let previous = performance.now();
  function tick(now) {
    const panel = document.querySelector('.library-drawer');
    if (!panel) return;
    const dt = Math.min(.032, (now - previous) / 1000);
    previous = now;
    // Analytic critically damped spring, response 0.32 seconds.
    const omega = 2 * Math.PI / .32;
    const offset = state.position - state.target;
    const slope = state.velocity + omega * offset;
    const decay = Math.exp(-omega * dt);
    state.position = state.target + (offset + slope * dt) * decay;
    state.velocity = (state.velocity - omega * slope * dt) * decay;
    if (motionPreference() || (Math.abs(state.target - state.position) < .35 && Math.abs(state.velocity) < 6)) {
      state.position = state.target;
      state.velocity = 0;
      paintSheet(panel);
      state.frame = 0;
      if (state.target > 0) finishClosingLayer();
      return;
    }
    paintSheet(panel);
    state.frame = requestAnimationFrame(tick);
  }
  state.frame = requestAnimationFrame(tick);
}
function presentSheet() {
  const panel = document.querySelector('.library-drawer');
  sheetMotion.pointer = null;
  sheetMotion.velocity = 0;
  sheetMotion.position = motionPreference() ? 0 : sheetExtent(panel);
  paintSheet(panel);
  if (!motionPreference()) settleSheet(0);
}
function dismissSheet() {
  const panel = document.querySelector('.library-drawer');
  if (!panel) return false;
  if (motionPreference()) {
    cancelAnimationFrame(sheetMotion.frame);
    return false;
  }
  sheetMotion.pointer = null;
  settleSheet(sheetExtent(panel));
  return true;
}
document.addEventListener('pointerdown', event => {
  const handle = event.target.closest('.sheet-grab');
  if (!handle || !event.isPrimary || event.button !== 0) return;
  cancelAnimationFrame(sheetMotion.frame);
  handle.setPointerCapture(event.pointerId);
  sheetMotion.pointer = { id: event.pointerId, startY: event.clientY, startPosition: sheetMotion.position, samples: [[event.timeStamp,event.clientY]] };
});
document.addEventListener('pointermove', event => {
  const drag = sheetMotion.pointer;
  if (!drag || drag.id !== event.pointerId) return;
  const panel = document.querySelector('.library-drawer');
  if (!panel) return;
  const next = drag.startPosition + event.clientY - drag.startY;
  sheetMotion.position = next >= 0 ? next : next / (2 + Math.abs(next) / 40);
  drag.samples.push([event.timeStamp,event.clientY]);
  drag.samples = drag.samples.filter(([time]) => event.timeStamp - time <= 90);
  paintSheet(panel);
});
function releaseSheet(event) {
  const drag = sheetMotion.pointer;
  if (!drag || drag.id !== event.pointerId) return;
  sheetMotion.pointer = null;
  const panel = document.querySelector('.library-drawer');
  if (!panel) return;
  const [time, y] = drag.samples[0];
  const elapsed = event.timeStamp - time;
  sheetMotion.velocity = elapsed > 0 && elapsed < 140 ? (event.clientY - y) * 1000 / elapsed : 0;
  const deceleration = .995;
  const coast = (sheetMotion.velocity / 1000) * deceleration / (1 - deceleration);
  const projected = sheetMotion.position + coast;
  settleSheet(event.type === 'pointerup' && projected > sheetExtent(panel) * .32 ? sheetExtent(panel) : 0);
}
document.addEventListener('pointerup', releaseSheet);
document.addEventListener('pointercancel', releaseSheet);
