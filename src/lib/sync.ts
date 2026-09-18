import LZString from 'lz-string';
import { listCharacters, getCharacter, saveCharacter } from './characters';
import type { Character } from '../types/character';

const SYNC_STORAGE_KEY = 'dnd-cc-sync-code';

/*
 * Cross-device sync is fully self-contained: the "code" is this device's
 * character data itself, compressed with lz-string into a URL-safe string.
 * Nothing is ever uploaded anywhere, so there's no server to be down, rate
 * limit, or require an account — pulling just decompresses and merges.
 *
 * This is the fourth backend this feature has used, and each of the
 * previous three failed for a different, real reason (all confirmed live,
 * not guessed): jsonblob.com's POST response only carries the new id in a
 * Location header, which fetch() can't read cross-origin. kvdb.io's
 * bucket-create endpoint needs a verified email before it accepts writes.
 * ExtendsClass's json-storage API — despite documentation suggesting
 * otherwise — returned a live 404 "Bin not found" when creating a bin with
 * a body, then a live 404 "Bin not found" again when trying to PUT to a
 * fresh client-generated id (it doesn't upsert), and finally a live 401
 * "Wrong API key" from a bare POST — meaning bin *creation* on that service
 * genuinely requires an account this app doesn't have, even though reading
 * and updating an already-existing bin by id does not. Three free "anonymous
 * JSON storage" services in a row gating the create step behind some form
 * of auth is a pattern, not a fluke, so this version stops depending on any
 * of them: the sync code is the data.
 *
 * The real tradeoff: since the code directly encodes the data, it changes
 * (and gets longer) every time you push, and there's no single reusable
 * address a second device can keep re-pulling from — each push produces a
 * fresh code that has to be re-shared. Export/Import JSON on the
 * Characters page remains the dependency-free fallback either way.
 */

export interface SyncPayload {
  format: 'dnd-character-creator/sync';
  version: 1;
  savedAt: string;
  characters: Character[];
}

export function getStoredSyncCode(): string | null {
  try {
    return localStorage.getItem(SYNC_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSyncCode(code: string | null) {
  try {
    if (code) localStorage.setItem(SYNC_STORAGE_KEY, code);
    else localStorage.removeItem(SYNC_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private browsing etc.) — code just won't persist across reloads.
  }
}

async function buildPayload(): Promise<SyncPayload> {
  const characters = await listCharacters();
  return { format: 'dnd-character-creator/sync', version: 1, savedAt: new Date().toISOString(), characters };
}

/** Encodes everything currently saved on this device into a fresh, self-contained sync code. */
export async function createSyncCode(): Promise<string> {
  const payload = await buildPayload();
  const code = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  if (!code) throw new Error("Couldn't build a sync code from your characters. Try Export/Import JSON instead.");
  setStoredSyncCode(code);
  return code;
}

/** Re-encodes this device's current data as a fresh code — since the code *is* the data, "pushing" just means generating a new one to share. */
export async function pushToSyncCode(): Promise<string> {
  return createSyncCode();
}

export interface PullResult {
  imported: number;
  keptLocal: number;
  savedAt: string;
}

/**
 * Decodes a sync code and upserts every character into the local database.
 * To avoid a pull silently clobbering newer edits made locally, a character
 * already present locally is only overwritten if the incoming copy has a
 * newer `updatedAt`; otherwise the local version is kept (counted under
 * `keptLocal`). Never deletes local characters that aren't in the code.
 */
export async function pullFromSyncCode(code: string): Promise<PullResult> {
  const trimmed = code.trim();
  const json = LZString.decompressFromEncodedURIComponent(trimmed);
  if (!json) {
    throw new Error('That doesn’t look like a valid sync code — double-check you copied the whole thing.');
  }
  let data: Partial<SyncPayload>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('That doesn’t look like a valid sync code — double-check you copied the whole thing.');
  }
  if (!data || !Array.isArray(data.characters)) {
    throw new Error('That code doesn’t point to character data from this app.');
  }
  let imported = 0;
  let keptLocal = 0;
  for (const character of data.characters) {
    if (!character || typeof character !== 'object' || !character.id) continue;
    const existing = await getCharacter(character.id);
    if (existing && existing.updatedAt >= character.updatedAt) {
      keptLocal++;
      continue;
    }
    await saveCharacter(character as Character);
    imported++;
  }
  setStoredSyncCode(trimmed);
  return { imported, keptLocal, savedAt: data.savedAt ?? new Date().toISOString() };
}
