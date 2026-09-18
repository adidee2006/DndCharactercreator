import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { listCharacters, getCharacter, saveCharacter } from './characters';
import type { Character } from '../types/character';

const SYNC_STORAGE_KEY = 'dnd-cc-sync-code';

export interface SyncPayload {
  format: 'dnd-character-creator/sync';
  version: 1;
  savedAt: string;
  characters: Character[];
}

/*
 * Cross-device sync is entirely local: the "code" is the character data
 * itself, compressed and encoded, never uploaded anywhere. Earlier this
 * used jsonblob.com as a free anonymous backing store, but that meant
 * every push/pull depended on a third-party service being reachable *and*
 * allowing cross-origin browser requests — which turned out to fail in
 * practice (the browser's CORS preflight for a JSON POST was being
 * rejected, surfacing as an opaque "couldn't reach the service" network
 * error with no way to fix it from this app). A self-contained code has no
 * server to be unreachable, works offline, and is actually more private
 * (nothing leaves the user's own devices except what they choose to paste
 * or send themselves).
 */

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

/** Builds a fresh sync code from everything currently saved on this device. Regenerate after making changes you want to share. */
export async function createSyncCode(): Promise<string> {
  const payload = await buildPayload();
  const code = compressToEncodedURIComponent(JSON.stringify(payload));
  setStoredSyncCode(code);
  return code;
}

function decodePayload(code: string): SyncPayload {
  const trimmed = code.trim();
  if (!trimmed) throw new Error('Paste a sync code first.');
  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(trimmed);
  } catch {
    json = null;
  }
  if (!json) {
    throw new Error("That doesn't look like a valid sync code — check you copied the whole thing with nothing missing.");
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('That sync code decoded but its contents were not valid — it may be from an incompatible version of this app.');
  }
  const payload = data as Partial<SyncPayload>;
  if (!payload || payload.format !== 'dnd-character-creator/sync' || !Array.isArray(payload.characters)) {
    throw new Error("That code doesn't point to character data from this app.");
  }
  return payload as SyncPayload;
}

export interface PullResult {
  imported: number;
  keptLocal: number;
  savedAt: string;
}

/**
 * Decodes a sync code and upserts every character into the local database.
 * To avoid a pull silently clobbering newer edits made locally since the
 * code was generated, a character already present locally is only
 * overwritten if the incoming copy has a newer `updatedAt`; otherwise the
 * local version is kept and counted under `keptLocal`. Never deletes local
 * characters that aren't in the pulled payload.
 */
export async function importSyncCode(code: string): Promise<PullResult> {
  const data = decodePayload(code);
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
  setStoredSyncCode(code.trim());
  return { imported, keptLocal, savedAt: data.savedAt ?? new Date().toISOString() };
}
