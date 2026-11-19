import { imageModifierFilter, seededShapeOrder } from './imageModifiers';

test('a seed gives all clients the same permutation without repeating or losing shapes', () => {
  const order = seededShapeOrder(100, 'imagipic');
  expect(order).toEqual(seededShapeOrder(100, 'imagipic'));
  expect(order).not.toEqual(seededShapeOrder(100, 'otra-semilla'));
  expect(order.slice().sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i));
  expect(seededShapeOrder(0, '')).toEqual([]);
  expect(seededShapeOrder(1, '')).toEqual([0]);
});

test('each color modifier applies one filter and legacy turns keep their colors', () => {
  expect(imageModifierFilter({ type: 'hue-shift', degrees: -120 })).toBe('hue-rotate(-120deg)');
  expect(imageModifierFilter({ type: 'black-and-white' })).toBe('grayscale(1)');
  expect(imageModifierFilter({ type: 'shuffle', seed: '123' })).toBeUndefined();
  expect(imageModifierFilter({ type: 'none' })).toBeUndefined();
  expect(imageModifierFilter()).toBeUndefined();
});
