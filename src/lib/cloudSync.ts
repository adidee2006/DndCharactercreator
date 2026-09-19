import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Character } from '../types/character';

/*
 * Best-effort, fire-and-forget cloud mirroring for whoever is currently
 * signed in. Lives separately from characters.ts/account.ts to avoid a
 * circular import (account.ts already imports the characters.ts CRUD
 * functions for its bulk upload/download buttons).
 */

function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

export async function uploadCharacterToCloud(character: Character): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  try {
    // Firestore rejects `undefined` field values; round-trip through JSON
    // to strip them, same as the manual bulk upload does.
    const sanitized = JSON.parse(JSON.stringify(character));
    await setDoc(doc(db, 'users', uid, 'characters', character.id), sanitized);
  } catch {
    // A signed-in user's local save should never fail because the cloud
    // mirror hiccuped — the manual Upload button on the Account page can
    // always re-sync everything later.
  }
}

export async function deleteCharacterFromCloud(id: string): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  try {
    await deleteDoc(doc(db, 'users', uid, 'characters', id));
  } catch {
    // Best-effort, same as above.
  }
}
