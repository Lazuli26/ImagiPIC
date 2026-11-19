import { DEFAULT_SHOWCASE, gallery, readShowcaseSettings, resolveCollection } from './collection';
import type { DeckImageDoc } from '../../types/database';
beforeEach(() => localStorage.clear());
test('restores each account’s selection without exposing it to another account', () => {
  localStorage.setItem('imagipic.showcase.ana', JSON.stringify({ source: 'deck', imageIds: ['one'], durationSecs: 20 }));
  expect(readShowcaseSettings('ana').imageIds).toEqual(['one']);
  expect(readShowcaseSettings('beto')).toEqual(DEFAULT_SHOWCASE);
});
test('falls back to the gallery when saved images have been deleted', () => {
  const settings = { source: 'deck' as const, imageIds: ['deleted'], durationSecs: 12 };
  expect(resolveCollection(settings, [])).toBe(gallery);
});
test('keeps the chosen order and ignores deleted entries', () => {
  const images = ['one', 'two'].map(id => ({ id, width: 100, height: 100, shapesCompact: [6, 255, 4, 0, 0, 100, 100] })) as DeckImageDoc[];
  expect(resolveCollection({ source: 'deck', imageIds: ['two', 'deleted', 'one'], durationSecs: 12 }, images).map(image => image.id)).toEqual(['two', 'one']);
});
test('recovers from damaged browser storage', () => {
  localStorage.setItem('imagipic.showcase.ana', '{broken');
  expect(readShowcaseSettings('ana')).toEqual(DEFAULT_SHOWCASE);
});
