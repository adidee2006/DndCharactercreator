import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { listCharacters, getCharacter, saveCharacter } from './characters';
import type { Character } from '../types/character';

/*
 * Real accounts: each user signs in with Firebase Auth (email/password),
 * and their characters live in Firestore under users/{uid}/characters/{id}.
 * The Firestore rules (see firestore.rules) only allow a signed-in user to
 * read or write documents under their own uid, so this is actually private
 * — unlike the earlier code-based sync, which anyone with the code could read.
 */

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with that email already exists — try logging in instead.';
    case 'auth/invalid-email':
      return 'That doesn’t look like a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts — wait a bit and try again.';
    default:
      return (err as Error)?.message || 'Something went wrong.';
  }
}

export async function signUp(email: string, password: string): Promise<void> {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function logIn(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

function requireUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('You need to be logged in for that.');
  return user.uid;
}

/** Uploads every character currently saved on this device to the account's cloud storage. */
export async function pushCharactersToCloud(): Promise<number> {
  const uid = requireUid();
  const characters = await listCharacters();
  for (const character of characters) {
    await setDoc(doc(db, 'users', uid, 'characters', character.id), character);
  }
  return characters.length;
}

export interface CloudPullResult {
  imported: number;
  keptLocal: number;
}

/**
 * Downloads every character stored in the account's cloud storage and merges
 * it into this device's local database. A locally-newer character (by
 * `updatedAt`) is never overwritten by an older cloud copy.
 */
export async function pullCharactersFromCloud(): Promise<CloudPullResult> {
  const uid = requireUid();
  const snapshot = await getDocs(collection(db, 'users', uid, 'characters'));
  let imported = 0;
  let keptLocal = 0;
  for (const docSnap of snapshot.docs) {
    const character = docSnap.data() as Character;
    if (!character || !character.id) continue;
    const existing = await getCharacter(character.id);
    if (existing && existing.updatedAt >= character.updatedAt) {
      keptLocal++;
      continue;
    }
    await saveCharacter(character);
    imported++;
  }
  return { imported, keptLocal };
}
