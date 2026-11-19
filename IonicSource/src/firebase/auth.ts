import { signInAnonymously, signOut, updateProfile, User } from "firebase/auth";
import { auth } from "./firebaseApp";

export { auth };

export const GUEST_NAME_MAX_LENGTH = 30;

export async function signInAsGuest(name: string): Promise<User> {
  const displayName = name.trim();
  if (!displayName || displayName.length > GUEST_NAME_MAX_LENGTH) {
    throw new Error(`Escribe un nombre de usuario de 1 a ${GUEST_NAME_MAX_LENGTH} caracteres.`);
  }
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    throw new Error('Ya tienes una sesión iniciada.');
  }
  // Reuse an incomplete guest session if saving the name failed or the page
  // was reloaded. Names are labels; Firebase UIDs identify players.
  const user = auth.currentUser || (await signInAnonymously(auth)).user;
  await updateProfile(user, { displayName });
  return user;
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}
