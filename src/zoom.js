import { clamp } from './music.js';

export const MIN_ZOOM = .5;
export const MAX_ZOOM = 3;
export const normalizeZoom = value => Math.round(clamp(Number.isFinite(value) ? value : 1, MIN_ZOOM, MAX_ZOOM) * 100) / 100;

// Keep time spacing independent of screen height when rotating an iPad.
export function rollMetrics(height, zoom = 1) {
  const keyHeight = clamp(height * .255, 64, 112);
  const hitY = Math.max(0, height - keyHeight);
  const pixelsPerSecond = 100 * normalizeZoom(zoom);
  return { keyHeight, hitY, pixelsPerSecond, lookahead: hitY / pixelsPerSecond };
}

export function bindPinchZoom(canvas, getZoom, onChange, onEnd) {
  const pointers = new Map();
  let pinch = null;
  const distance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const begin = () => {
    const span = distance();
    pinch = span >= 12 ? { distance: span, zoom: getZoom() } : null;
  };
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 2) begin();
    else pinch = null;
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size !== 2) return;
    if (!pinch) { begin(); return; }
    onChange(normalizeZoom(pinch.zoom * distance() / pinch.distance));
  });
  const finish = event => {
    if (!pointers.delete(event.pointerId)) return;
    if (pinch) onEnd();
    pinch = null;
    if (pointers.size === 2) begin();
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, finish);
}
