import { listCharacters, getCharacter, saveCharacter } from './characters';
import type { Character } from '../types/character';

const SYNC_STORAGE_KEY = 'dnd-cc-sync-code';
const FETCH_TIMEOUT_MS = 15000;

/*
 * Cross-device sync uses kvdb.io, a free, key-less anonymous key/value
 * store built for exactly this kind of client-side use (no signup, no API
 * key, CORS-enabled REST calls straight from a browser). The first time
 * this device sets up sync, it creates its own private "bucket" (a POST to
 * kvdb.io with no auth); that bucket's id becomes the sync code. Push
 * writes the current character roster to a fixed key in that bucket; Pull
 * reads it back. Because it's the same bucket every time, one code keeps
 * working indefinitely — no need to regenerate it after every change.
 *
 * Honesty note: this app's previous sync backend (jsonblob.com) turned out
 * not to work from a real browser (almost certainly a CORS preflight
 * rejection on the POST), and this sandbox's network policy blocks every
 * third-party host, including kvdb.io, so this implementation could not be
 * exercised against the live service before shipping. The design is
 * defensive (timeouts, specific error messages) and JSON export/import
 * remains on the Characters page as a fallback that never depends on any
 * third party.
 */

const KVDB_BASE = 'https://kvdb.io';
const DATA_KEY = 'characters';

export interface SyncPayload {
  format: 'dnd-character-creator/sync';
  version: 1;
  savedAt: string;
  characters: Character[];
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('The sync service timed out. Try again in a moment.');
    if (err instanceof TypeError) {
      throw new Error(
        "Couldn't reach the sync service (kvdb.io). Check your internet connection — if this keeps happening, use Export/Import JSON instead.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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

/** Creates a new private bucket on the sync service and returns its id as the shareable, reusable sync code. */
export async function createSyncCode(): Promise<string> {
  const res = await fetchWithTimeout(KVDB_BASE, { method: 'POST' });
  if (!res.ok) throw new Error(`Sync service returned ${res.status} ${res.statusText} while setting up your code.`);
  const bucket = (await res.text()).trim();
  if (!bucket || bucket.length > 64 || /\s/.test(bucket)) {
    throw new Error("The sync service didn't return a usable code. It may have changed its API — please use Export/Import JSON instead for now.");
  }
  setStoredSyncCode(bucket);
  // Push the current roster immediately so the code is usable right away on another device.
  await pushToSyncCode(bucket);
  return bucket;
}

/** Overwrites the code's stored data with everything currently saved on this device. Safe to call repeatedly — the same code keeps working. */
export async function pushToSyncCode(code: string): Promise<void> {
  const payload = await buildPayload();
  const res = await fetchWithTimeout(`${KVDB_BASE}/${encodeURIComponent(code)}/${DATA_KEY}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Sync service returned ${res.status} ${res.statusText}.`);
  setStoredSyncCode(code);
}

export interface PullResult {
  imported: number;
  keptLocal: number;
  savedAt: string;
}

/**
 * Fetches a sync code's data and upserts every character into the local
 * database. To avoid a pull silently clobbering newer edits made locally
 * before they were pushed, a character already present locally is only
 * overwritten if the incoming copy has a newer `updatedAt`; otherwise the
 * local version is kept and it's counted under `keptLocal`. Never deletes
 * local characters that aren't in the pulled payload.
 */
export async function pullFromSyncCode(code: string): Promise<PullResult> {
  const res = await fetchWithTimeout(`${KVDB_BASE}/${encodeURIComponent(code)}/${DATA_KEY}`);
  if (res.status === 404) {
    throw new Error("That sync code doesn't have anything pushed to it yet (or doesn't exist) — push from the other device first, or double-check the code.");
  }
  if (!res.ok) throw new Error(`Sync service returned ${res.status} ${res.statusText}.`);
  const text = await res.text();
  let data: Partial<SyncPayload>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That code doesn’t point to character data from this app.');
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
  setStoredSyncCode(code);
  return { imported, keptLocal, savedAt: data.savedAt ?? new Date().toISOString() };
}
