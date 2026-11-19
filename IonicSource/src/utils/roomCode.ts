import {
  CollectionReference,
  getDoc,
  doc,
} from "firebase/firestore";

export const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(len: number = 6): string {
  let result = "";
  const charsLen = CHARSET.length;
  for (let i = 0; i < len; i++) {
    const randomIndex = Math.floor(Math.random() * charsLen);
    result += CHARSET.charAt(randomIndex);
  }
  return result;
}

export function isValidRoomCode(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const pattern = new RegExp(`^[${CHARSET}]+$`);
  return pattern.test(s);
}

export async function generateUniqueRoomCode(
  coll: CollectionReference,
  len: number = 6,
  maxTries: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const code = generateRoomCode(len);
    const docRef = doc(coll, code);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return code;
    }
  }
  throw new Error(`Failed to generate unique room code after ${maxTries} tries`);
}
