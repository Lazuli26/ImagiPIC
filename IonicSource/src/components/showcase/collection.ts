import { useEffect, useState } from 'react';
import bundled from '../../data/showcase/collection.json';
import type { DeckImageDoc } from '../../types/database';

export interface ShowcaseImage { id: string; label?: string; width: number; height: number; shapeCount: number; shapesCompact: number[]; }
export interface ShowcaseSettings { source: 'gallery' | 'deck'; imageIds: string[]; durationSecs: number; }
export const DEFAULT_SHOWCASE: ShowcaseSettings = { source: 'gallery', imageIds: [], durationSecs: 12 };
export const gallery: ShowcaseImage[] = bundled;
const keyFor = (uid: string) => `imagipic.showcase.${uid || 'guest'}`;
export function readShowcaseSettings(uid: string): ShowcaseSettings {
  try {
    const data = JSON.parse(localStorage.getItem(keyFor(uid)) || 'null');
    return { source: data?.source === 'deck' ? 'deck' : 'gallery', imageIds: Array.isArray(data?.imageIds) ? data.imageIds.filter((id: unknown) => typeof id === 'string').slice(0, 12) : [], durationSecs: [8, 12, 20].includes(data?.durationSecs) ? data.durationSecs : 12 };
  } catch { return DEFAULT_SHOWCASE; }
}
export function resolveCollection(settings: ShowcaseSettings, images: DeckImageDoc[]): ShowcaseImage[] {
  if (settings.source === 'deck') {
    const selected = settings.imageIds.map(id => images.find(image => image.id === id)).filter((image): image is DeckImageDoc => !!image && image.width > 0 && image.height > 0 && image.shapesCompact.length > 0);
    if (selected.length) return selected;
  }
  return gallery;
}
export function useShowcaseSettings(uid: string) {
  const [settings, setSettings] = useState(() => readShowcaseSettings(uid));
  const [storageError, setStorageError] = useState('');
  useEffect(() => { setSettings(readShowcaseSettings(uid)); setStorageError(''); }, [uid]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === keyFor(uid) || event.key == null) setSettings(readShowcaseSettings(uid)); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, [uid]);
  const save = (next: ShowcaseSettings) => {
    setSettings(next); setStorageError('');
    try { localStorage.setItem(keyFor(uid), JSON.stringify(next)); }
    catch { setStorageError('Tu selección se aplicó, pero este navegador no permite guardarla para la próxima visita.'); }
  };
  return { settings, save, storageError };
}
