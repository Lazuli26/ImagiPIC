// Test-only Firestore boundary: browser checks never contact a real room.
import { useEffect, useState } from 'react';
export const db = {};
export const answers: any[] = [];
export let deckImages: any[] = [];
export const setDeckImages = (images: any[]) => { deckImages = images; };
export const getDeckImages = async () => deckImages;
export const saveDeckImage = async (_owner: string, payload: any) => ({ ...payload, id: 'saved-fixture', ownerUid: 'judge' });
export const typedDoc = () => ({});
export const getDocSnap = async () => ({ exists: () => false });
export const doc = (_db: any, path?: string) => path || 'new-guess';
export const collection = (_db: any, path: string) => path;
export const serverTimestamp = () => ({ toMillis: () => Date.now() });
export const arrayUnion = (uid: string) => [uid];
export const updateDoc = async (path: string, patch: any) => {
  if (path === 'rooms/TEST12/rounds/round-0') {
    window.dispatchEvent(new CustomEvent('fixture-round-update', { detail: patch }));
  }
};
export const getDocFromServer = async () => ({ exists: () => false });
export const watchDocument = () => () => {};
export const writeBatch = () => {
  const updates: { id: string; patch: any }[] = [];
  return { update: (path: string, patch: any) => { updates.push({ id: path.split('/').pop()!, patch }); }, commit: async () => {
    updates.forEach(({ id, patch }) => { const answer = answers.find(answer => answer.id === id); if (answer) Object.assign(answer, patch); });
    window.dispatchEvent(new Event('fixture-answer'));
  } };
};
export const runTransaction = async (_db: any, action: any) => {
  await action({ get: async () => ({ exists: () => false }), set: (_ref: any, value: any) => {
    if (value.textRaw) answers.push({ ...value, id: `answer-${answers.length}` });
  } });
  window.dispatchEvent(new Event('fixture-answer'));
};
export function useGuesses() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    window.addEventListener('fixture-answer', update);
    return () => window.removeEventListener('fixture-answer', update);
  }, []);
  return { guesses: [...answers] };
}
