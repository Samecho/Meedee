import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPinchZoom, normalizeZoom, rollMetrics } from '../src/zoom.js';

test('Rotating to a shorter screen preserves note lengths and beat spacing', () => {
  const landscape = rollMetrics(584, 1);
  const portrait = rollMetrics(840, 1);
  assert.equal(.12 * landscape.pixelsPerSecond, 12);
  assert.equal(landscape.pixelsPerSecond, portrait.pixelsPerSecond);
  assert.ok(landscape.lookahead < portrait.lookahead);
});

test('Zoom stretches musical time around the keyboard without resizing keys', () => {
  const normal = rollMetrics(584, 1);
  const enlarged = rollMetrics(584, 2);
  assert.equal(enlarged.pixelsPerSecond, normal.pixelsPerSecond * 2);
  assert.equal(enlarged.lookahead, normal.lookahead / 2);
  assert.equal(enlarged.hitY, normal.hitY);
  assert.equal(enlarged.keyHeight, normal.keyHeight);
  assert.equal(normalizeZoom(-1), .5);
  assert.equal(normalizeZoom(20), 3);
  assert.equal(normalizeZoom(NaN), 1);
});

function gesture() {
  const canvas = new EventTarget();
  canvas.setPointerCapture = () => {};
  let zoom = 1, saved = 0;
  bindPinchZoom(canvas, () => zoom, value => { zoom = value; }, () => { saved++; });
  const pointer = (type, pointerId, x, y = 0, pointerType = 'touch') => {
    canvas.dispatchEvent(Object.assign(new Event(type), { pointerId, clientX: x, clientY: y, pointerType }));
  };
  return { pointer, get zoom() { return zoom; }, get saved() { return saved; } };
}

test('Two-finger spreading and pinching changes scale, saving only when released', () => {
  const g = gesture();
  g.pointer('pointerdown', 1, 100);
  g.pointer('pointerdown', 2, 200);
  g.pointer('pointermove', 2, 300);
  assert.equal(g.zoom, 2);
  assert.equal(g.saved, 0);
  g.pointer('pointermove', 2, 150);
  assert.equal(g.zoom, .5);
  g.pointer('pointerup', 2, 150);
  assert.equal(g.saved, 1);
  g.pointer('lostpointercapture', 2, 150);
  g.pointer('pointermove', 1, 500);
  assert.equal(g.saved, 1);
  assert.equal(g.zoom, .5);
});

test('Single touches and mouse drags do not zoom; cancelled gestures stop cleanly', () => {
  const g = gesture();
  g.pointer('pointerdown', 1, 100);
  g.pointer('pointermove', 1, 200);
  g.pointer('pointerdown', 2, 400, 0, 'mouse');
  g.pointer('pointermove', 2, 800, 0, 'mouse');
  assert.equal(g.zoom, 1);
  g.pointer('pointerdown', 3, 300);
  g.pointer('pointermove', 3, 2000);
  assert.equal(g.zoom, 3);
  g.pointer('pointercancel', 3, 2000);
  g.pointer('pointermove', 3, 250);
  assert.equal(g.zoom, 3);
  assert.equal(g.saved, 1);
});
