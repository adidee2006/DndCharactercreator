import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { listCharacters, getCharacter, putCharacterRaw, deleteCharacterLocalOnly } from './characters';
import { uploadCharacterToCloud } from './cloudSync';
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
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in window was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup — allow popups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This site isn’t authorized for Google sign-in yet.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
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

export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
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

async function fetchCloudCharacters(uid: string): Promise<Map<string, Character>> {
  const snapshot = await getDocs(collection(db, 'users', uid, 'characters'));
  const byId = new Map<string, Character>();
  for (const docSnap of snapshot.docs) {
    const character = docSnap.data() as Character;
    if (character?.id) byId.set(character.id, character);
  }
  return byId;
}

/**
 * Deletions are tombstoned (see cloudSync.ts) rather than just removing the
 * character doc, so other devices can tell "deleted elsewhere" apart from
 * "never uploaded from this device yet." Maps character id -> deletedAt.
 */
async function fetchCloudDeletions(uid: string): Promise<Map<string, string>> {
  const snapshot = await getDocs(collection(db, 'users', uid, 'deletions'));
  const byId = new Map<string, string>();
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as { id?: string; deletedAt?: string };
    if (data?.id && data.deletedAt) byId.set(data.id, data.deletedAt);
  }
  return byId;
}

/** Uploads every character currently saved on this device to the account's cloud storage, unconditionally — except one a tombstone says was deleted at least as recently, which would just resurrect it. */
export async function pushCharactersToCloud(): Promise<number> {
  const uid = requireUid();
  const [characters, deletions] = await Promise.all([listCharacters(), fetchCloudDeletions(uid)]);
  let uploaded = 0;
  for (const character of characters) {
    const tombstoneAt = deletions.get(character.id);
    if (tombstoneAt && tombstoneAt >= character.updatedAt) continue;
    await uploadCharacterToCloud(character);
    uploaded++;
  }
  return uploaded;
}

/**
 * Uploads only local characters that are missing from the cloud or newer
 * than what's already there, and skips anything tombstoned as deleted at
 * least as recently as this device's copy. Safe to run automatically (e.g.
 * right after sign-in) without a stale local copy clobbering a newer edit —
 * or a deletion — made on another device.
 */
export async function pushNewerCharactersToCloud(): Promise<number> {
  const uid = requireUid();
  const [localCharacters, cloudById, deletions] = await Promise.all([
    listCharacters(),
    fetchCloudCharacters(uid),
    fetchCloudDeletions(uid),
  ]);
  let uploaded = 0;
  for (const local of localCharacters) {
    const tombstoneAt = deletions.get(local.id);
    if (tombstoneAt && tombstoneAt >= local.updatedAt) continue;
    const cloud = cloudById.get(local.id);
    if (!cloud || cloud.updatedAt < local.updatedAt) {
      await uploadCharacterToCloud(local);
      uploaded++;
    }
  }
  return uploaded;
}

export interface CloudPullResult {
  imported: number;
  keptLocal: number;
  deletedLocally: number;
}

/**
 * Downloads every character stored in the account's cloud storage and merges
 * it into this device's local database. A locally-newer character (by
 * `updatedAt`) is never overwritten by an older cloud copy. Also applies any
 * deletion tombstones: a character deleted on another device is removed
 * locally too, unless this device's copy was edited more recently than the
 * deletion (in which case it's kept, as a newer edit "undoing" the delete).
 */
export async function pullCharactersFromCloud(): Promise<CloudPullResult> {
  const uid = requireUid();
  const [snapshot, deletions] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'characters')),
    fetchCloudDeletions(uid),
  ]);
  const cloudIds = new Set<string>();
  let imported = 0;
  let keptLocal = 0;
  for (const docSnap of snapshot.docs) {
    const character = docSnap.data() as Character;
    if (!character || !character.id) continue;
    cloudIds.add(character.id);
    const existing = await getCharacter(character.id);
    if (existing && existing.updatedAt >= character.updatedAt) {
      keptLocal++;
      continue;
    }
    await putCharacterRaw(character);
    imported++;
  }

  let deletedLocally = 0;
  for (const [id, deletedAt] of deletions) {
    if (cloudIds.has(id)) continue; // a live character doc always wins over an old tombstone
    const existing = await getCharacter(id);
    if (existing && existing.updatedAt <= deletedAt) {
      await deleteCharacterLocalOnly(id);
      deletedLocally++;
    }
  }

  return { imported, keptLocal, deletedLocally };
}
