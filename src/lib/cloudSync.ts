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
    // Deleting the character doc alone isn't enough for sync: another
    // device that already has this character locally would just see it
    // absent from the cloud, which is indistinguishable from "never
    // uploaded yet" — so it would never learn the character was deleted,
    // and could even resurrect it on its next auto-upload. A tombstone
    // makes the deletion itself a fact other devices can pull.
    await Promise.all([
      deleteDoc(doc(db, 'users', uid, 'characters', id)),
      setDoc(doc(db, 'users', uid, 'deletions', id), { id, deletedAt: new Date().toISOString() }),
    ]);
  } catch {
    // Best-effort, same as above.
  }
}
