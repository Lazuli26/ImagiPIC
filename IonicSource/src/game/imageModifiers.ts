import type { ImageModifier } from '../types/database';

export const NO_IMAGE_MODIFIER: ImageModifier = { type: 'none' };

export function imageModifierFilter(modifier?: ImageModifier): string | undefined {
  if (modifier?.type === 'hue-shift') return `hue-rotate(${modifier.degrees}deg)`;
  if (modifier?.type === 'black-and-white') return 'grayscale(1)';
  return undefined;
}

// FNV-1a seed hash followed by Mulberry32 and Fisher-Yates. The sequence is
// independent of the client clock, frame rate, and playback controls.
export function seededShapeOrder(count: number, seed: string): number[] {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  }
  const random = () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length: count }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
