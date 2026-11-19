import { useEffect, useMemo, useState } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
import type { DeckImageDoc, RoundDoc } from '../types/database';
import { decodeAllToSvgRows, unflattenShapes } from '../utils/compactShapeCodec';

export function useRoundShapes(round: RoundDoc) {
  const { imageRef, shapesCompactCopy, width, height, roundIndex } = round;
  // Firestore recreates arrays on metadata/control updates. Keep decoded rows
  // stable while their contents are unchanged so the SVG can append new nodes.
  const compactKey = useMemo(() => JSON.stringify(shapesCompactCopy || []), [shapesCompactCopy]);
  const inlineRows = useMemo(() => decodeAllToSvgRows(
    unflattenShapes(JSON.parse(compactKey)), width || 512, height || 512,
  ), [compactKey, width, height]);
  const key = JSON.stringify([roundIndex, imageRef, width, height]);
  const [loaded, setLoaded] = useState<{ key: string; rows: string[]; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!imageRef || inlineRows.length) return;
    const parts = imageRef.split('/');
    if (parts.length !== 4 || parts[0] !== 'user_decks' || parts[2] !== 'images') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const load = async () => {
      try {
        const snapshot = await getDocFromServer(doc(db, imageRef));
        if (cancelled) return;
        if (snapshot.exists()) {
          const image = snapshot.data() as DeckImageDoc;
          const rows = decodeAllToSvgRows(unflattenShapes(image.shapesCompact), image.width || 512, image.height || 512);
          if (rows.length) {
            setLoaded({ key, rows, width: image.width || 512, height: image.height || 512 });
            return;
          }
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('Image synchronization failed:', error);
      }
      timer = setTimeout(load, Math.min(1000 * 2 ** attempts++, 10000));
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, imageRef, inlineRows.length]);

  // The round copy is available in the same render as its state transition.
  // Async deck reads are scoped to an image and cannot overwrite another turn.
  if (inlineRows.length) return { rows: inlineRows, width: width || 512, height: height || 512 };
  if (loaded?.key === key) return loaded;
  return { rows: [], width: width || 512, height: height || 512 };
}
