import {
  CollectionReference,
  DocumentReference,
  DocumentData,
  doc,
  collection,
  setDoc,
  SetOptions,
  getDoc,
  DocumentSnapshot,
  onSnapshot,
  SnapshotListenOptions,
  Unsubscribe,
  runTransaction as fsRunTransaction,
  Transaction,
} from "firebase/firestore";
import { db } from "./firebaseApp";

export type TypedDocRef<T> = DocumentReference<T>;
export type TypedCollRef<T> = CollectionReference<T>;

export function typedDoc<T>(path: string, ...pathSegments: string[]): TypedDocRef<T> {
  return doc(db, path, ...pathSegments) as DocumentReference<T>;
}

export function typedColl<T>(path: string, ...pathSegments: string[]): TypedCollRef<T> {
  return collection(db, path, ...pathSegments) as CollectionReference<T>;
}

export function setDocMerge<T>(
  reference: DocumentReference<T>,
  data: Partial<T>
): Promise<void> {
  const options: SetOptions = { merge: true };
  return setDoc(reference as DocumentReference<DocumentData>, data as DocumentData, options);
}

export async function getDocSnap<T>(
  reference: DocumentReference<T>
): Promise<DocumentSnapshot<T>> {
  return getDoc(reference);
}

export function onSnapshotTyped<T>(
  reference: DocumentReference<T> | CollectionReference<T>,
  observer: { next?: (snapshot: any) => void; error?: (error: Error) => void; complete?: () => void } | ((snapshot: any) => void),
  options?: SnapshotListenOptions
): Unsubscribe {
  if (typeof observer === "function") {
    return onSnapshot(reference as any, options || {}, observer as any);
  }
  return onSnapshot(reference as any, options || {}, observer as any);
}

export function runTransaction<T>(
  updateFunction: (transaction: Transaction) => Promise<T>
): Promise<T> {
  return fsRunTransaction(db, updateFunction);
}
