import { useEffect, useState, useCallback, useMemo } from "react";
import { onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { typedDoc, typedColl } from "../firebase/firestore";
import { DeckImageDoc, DeckMetaDoc } from "../types/database";

export function useDeck(ownerUid: string) {
  const [serverImages, setServerImages] = useState<DeckImageDoc[]>([]);
  const [serverMeta, setServerMeta] = useState<DeckMetaDoc | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [addedImages, setAddedImages] = useState<DeckImageDoc[]>([]);

  const images = useMemo<DeckImageDoc[]>(() => {
    const combined: DeckImageDoc[] = [];
    const seen = new Set<string>();
    for (const img of addedImages) {
      if (!removedIds.has(img.id)) {
        combined.push(img);
        seen.add(img.id);
      }
    }
    for (const img of serverImages) {
      if (!seen.has(img.id) && !removedIds.has(img.id)) {
        combined.push(img);
      }
    }
    combined.sort((a, b) => {
      const at = (a.createdAt as any)?.seconds ?? 0;
      const bt = (b.createdAt as any)?.seconds ?? 0;
      if (bt !== at) return bt - at;
      return a.id.localeCompare(b.id);
    });
    return combined.slice(0, 50);
  }, [addedImages, serverImages, removedIds]);

  const meta = useMemo<DeckMetaDoc | null>(() => {
    if (!serverMeta) {
      const count = images.length;
      if (count === 0) return null;
      return { uid: ownerUid, count, updatedAt: new Date() as any };
    }
    const adjustedCount = Math.max(0, serverMeta.count - removedIds.size + addedImages.length);
    return { ...serverMeta, count: Math.max(0, adjustedCount) };
  }, [serverMeta, images.length, ownerUid, removedIds.size, addedImages.length]);

  const optimisticallyRemove = useCallback((id: string) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const optimisticallyAdd = useCallback((doc: DeckImageDoc) => {
    setRemovedIds((prev) => {
      if (!prev.has(doc.id)) return prev;
      const next = new Set(prev);
      next.delete(doc.id);
      return next;
    });
    setAddedImages((prev) => {
      if (prev.some((x) => x.id === doc.id)) return prev;
      return [doc, ...prev];
    });
  }, []);

  useEffect(() => {
    if (!ownerUid) {
      setServerImages([]);
      setServerMeta(null);
      setRemovedIds(new Set());
      setAddedImages([]);
      return;
    }

    const collRef = typedColl<DeckImageDoc>("user_decks", ownerUid, "images");
    const metaRef = typedDoc<DeckMetaDoc>("user_decks", ownerUid, "deckMeta", "meta");

    const q = query(collRef, orderBy("createdAt", "desc"), limit(50));

    const unsubImages = onSnapshot(q, (snapshot) => {
      const list: DeckImageDoc[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as DeckImageDoc;
        list.push(d);
        setRemovedIds((prev) => {
          if (!prev.has(d.id)) return prev;
          const next = new Set(prev);
          next.delete(d.id);
          return next;
        });
        setAddedImages((prev) => prev.filter((x) => x.id !== d.id));
      });
      setServerImages(list);
    });

    const unsubMeta = onSnapshot(
      metaRef,
      (snap) => {
        if (snap.exists()) {
          setServerMeta(snap.data() as DeckMetaDoc);
        } else {
          setServerMeta(null);
        }
      },
      () => {
        setServerMeta(null);
      }
    );

    return () => {
      unsubImages();
      unsubMeta();
    };
  }, [ownerUid]);

  return { images, meta, optimisticallyRemove, optimisticallyAdd };
}
