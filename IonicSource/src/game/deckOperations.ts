import {
  serverTimestamp,
  getDoc,
  collection,
  doc,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { typedDoc, typedColl, runTransaction, setDocMerge } from "../firebase/firestore";
import { db } from "../firebase/firebaseApp";
import { DeckImageDoc, DeckMetaDoc } from "../types/database";
import { normalizeAndFlattenShapes } from "../utils/compactShapeCodec";

function autoId(): string {
  return doc(collection(db, "_autoid")).id;
}

function deckMetaRef(ownerUid: string) {
  return typedDoc<DeckMetaDoc>("user_decks", ownerUid, "deckMeta", "meta");
}

function deckImageRef(ownerUid: string, imageId: string) {
  return typedDoc<DeckImageDoc>("user_decks", ownerUid, "images", imageId);
}

function deckImagesColl(ownerUid: string) {
  return typedColl<DeckImageDoc>("user_decks", ownerUid, "images");
}

export async function ensureDeckMeta(ownerUid: string): Promise<DeckMetaDoc> {
  const ref = deckMetaRef(ownerUid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as DeckMetaDoc;
  }
  const now = serverTimestamp();
  const meta: DeckMetaDoc = {
    uid: ownerUid,
    count: 0,
    updatedAt: now as any,
  };
  await setDocMerge(ref, meta);
  return meta;
}

export async function saveDeckImage(
  ownerUid: string,
  imageData: Omit<DeckImageDoc, "id" | "ownerUid" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<DeckImageDoc> {
  return runTransaction(async (transaction) => {
    const metaRef = deckMetaRef(ownerUid);
    const metaSnap = await transaction.get(metaRef);
    let meta: DeckMetaDoc;
    let metaIsNew: boolean;
    if (metaSnap.exists()) {
      meta = metaSnap.data() as DeckMetaDoc;
      metaIsNew = false;
    } else {
      meta = { uid: ownerUid, count: 0, updatedAt: serverTimestamp() as any };
      metaIsNew = true;
    }

    const isNew = imageData.id === undefined;
    if (isNew && meta.count >= 50) {
      throw new Error("Deck full (50/50). Delete an image first.");
    }

    const id = imageData.id ?? autoId();
    const imgRef = deckImageRef(ownerUid, id);
    const now = serverTimestamp();

    const fullDoc: DeckImageDoc = {
      id,
      ownerUid,
      createdAt: now as any,
      updatedAt: now as any,
      width: imageData.width,
      height: imageData.height,
      shapeCount: imageData.shapeCount,
      options: imageData.options,
      shapesCompact: normalizeAndFlattenShapes(imageData.shapesCompact),
      ...(typeof imageData.label === "string" && imageData.label.trim().length > 0
        ? { label: imageData.label.trim() }
        : {}),
      ...(typeof imageData.previewDataUrl === "string" && imageData.previewDataUrl.length > 0
        ? { previewDataUrl: imageData.previewDataUrl }
        : {}),
      ...(imageData.imageSource ? { imageSource: imageData.imageSource } : {}),
    };

    transaction.set(imgRef, fullDoc);

    const nextCount = isNew ? Math.max(0, meta.count + 1) : meta.count;
    if (metaIsNew) {
      transaction.set(metaRef, {
        uid: ownerUid,
        count: nextCount,
        updatedAt: now,
      });
    } else {
      transaction.update(metaRef, {
        count: nextCount,
        updatedAt: now,
      });
    }

    return fullDoc;
  });
}

export async function deleteDeckImage(ownerUid: string, imageId: string): Promise<void> {
  return runTransaction(async (transaction) => {
    const imgRef = deckImageRef(ownerUid, imageId);
    const metaRef = deckMetaRef(ownerUid);

    const imgSnap = await transaction.get(imgRef);
    const metaSnap = await transaction.get(metaRef);

    if (imgSnap.exists()) {
      transaction.delete(imgRef);

      if (metaSnap.exists()) {
        const currentCount = Number(metaSnap.data().count) || 0;
        const nextCount = Math.max(0, currentCount - 1);
        transaction.update(metaRef, {
          count: nextCount,
          updatedAt: serverTimestamp(),
        });
      }
    }
  });
}

export async function deleteDeckImages(ownerUid: string, imageIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(imageIds.filter(Boolean)));
  if (!uniqueIds.length) return;

  return runTransaction(async (transaction) => {
    const metaRef = deckMetaRef(ownerUid);
    const imageRefs = uniqueIds.map((id) => deckImageRef(ownerUid, id));
    const [metaSnap, ...imageSnaps] = await Promise.all([
      transaction.get(metaRef),
      ...imageRefs.map((ref) => transaction.get(ref)),
    ]);
    const existingRefs = imageRefs.filter((_ref, index) => imageSnaps[index].exists());
    existingRefs.forEach((ref) => transaction.delete(ref));

    if (existingRefs.length && metaSnap.exists()) {
      const currentCount = Number(metaSnap.data().count) || 0;
      transaction.update(metaRef, {
        count: Math.max(0, currentCount - existingRefs.length),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function renameDeckImage(ownerUid: string, imageId: string, label: string): Promise<void> {
  const normalizedLabel = label.trim();
  const ref = deckImageRef(ownerUid, imageId);
  await runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Deck image not found.");
    transaction.update(ref, {
      label: normalizedLabel,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function getDeckImages(ownerUid: string): Promise<DeckImageDoc[]> {
  const q = query(deckImagesColl(ownerUid), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(q);
  const list: DeckImageDoc[] = [];
  snap.forEach((d) => list.push(d.data() as DeckImageDoc));
  return list;
}

export async function getDeckMeta(ownerUid: string): Promise<DeckMetaDoc | null> {
  const snap = await getDoc(deckMetaRef(ownerUid));
  if (!snap.exists()) return null;
  return snap.data() as DeckMetaDoc;
}

export async function getDeckImageById(
  ownerUid: string,
  imageId: string
): Promise<DeckImageDoc | null> {
  const snap = await getDoc(deckImageRef(ownerUid, imageId));
  if (!snap.exists()) return null;
  return snap.data() as DeckImageDoc;
}
