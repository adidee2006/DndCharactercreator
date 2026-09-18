import { listCharacters, getCharacter, saveCharacter } from './characters';
import type { Character } from '../types/character';

const SYNC_STORAGE_KEY = 'dnd-cc-sync-code';
const FETCH_TIMEOUT_MS = 15000;

/*
 * Cross-device sync uses ExtendsClass's free, key-less JSON storage API as
 * an anonymous save slot. Creating a bin returns its id, which becomes the
 * reusable sync code; push/pull read and write that same bin's JSON body
 * directly. The real API host is json.extendsclass.com (NOT
 * api.extendsclass.com, which a previous version of this code guessed
 * wrong and which 404s on every single request — confirmed against a real,
 * working integration of this exact service).
 *
 * This is the third backend this feature has used. jsonblob.com never
 * worked from a real browser (its POST response only carries the new id in
 * a Location header, which fetch() can't read cross-origin without the
 * server explicitly exposing it — it didn't). kvdb.io's bucket-create
 * endpoint requires a POST body with an email address (an empty POST
 * 500s), and — more fundamentally — actually accepting writes to that
 * bucket requires the email to be verified, which has no answer for a
 * static page with no account system. ExtendsClass's bin storage needs no
 * account or key to read or update a bin by id, which is why it was picked
 * here.
 *
 * Every request that can fail surfaces the server's actual response body
 * in the thrown error (not just a status code) — if this API's contract
 * turns out to be subtly different than documented, the resulting error
 * message should say so directly instead of leaving another round of
 * guessing. JSON export/import on the Characters page remains a
 * dependency-free fallback either way.
 */

const API_BASE = 'https://json.extendsclass.com/bin';

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
        "Couldn't reach the sync service. Check your internet connection — if this keeps happening, use Export/Import JSON instead.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Turns a failed response into an error that includes the server's own explanation, not just a status code. */
async function errorFromResponse(res: Response, context: string): Promise<Error> {
  let body = '';
  try {
    body = (await res.text()).trim().slice(0, 300);
  } catch {
    // ignore — body just won't be included
  }
  return new Error(`Sync service returned ${res.status} ${res.statusText} ${context}.${body ? ` (${body})` : ''}`);
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

/** Pulls a bin id out of wherever the service put it — a JSON field, or a URI/URL whose last path segment is the id. */
function extractBinId(body: unknown): string | null {
  if (typeof body === 'string') return body.trim() || null;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    for (const key of ['id', 'bin', '_id', 'uri', 'url']) {
      const v = b[key];
      if (typeof v === 'string' && v.trim()) return v.trim().split('/').filter(Boolean).pop() ?? v.trim();
    }
  }
  return null;
}

/** A short, URL-safe random id — used as a client-generated bin id if the service's own POST-to-create endpoint doesn't cooperate. */
function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

/** Creates a new bin on the sync service and returns its id as the shareable, reusable sync code. */
export async function createSyncCode(): Promise<string> {
  const payload = await buildPayload();
  const res = await fetchWithTimeout(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // some deployments might return the id as plain text instead of JSON
    }
    const id = extractBinId(body) ?? extractBinId(await res.text().catch(() => null));
    if (id) {
      setStoredSyncCode(id);
      return id;
    }
  }
  // POST-to-create didn't give us an id (wrong response shape, or this
  // endpoint needs an account this app doesn't have). Fall back to writing
  // directly to a client-generated id — PUT to a bin id creates it if it
  // doesn't exist yet, same as every push after this one.
  const id = randomId();
  const putRes = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!putRes.ok) throw await errorFromResponse(putRes, 'while setting up your code');
  setStoredSyncCode(id);
  return id;
}

/** Overwrites the code's stored data with everything currently saved on this device. Safe to call repeatedly — the same code keeps working. */
export async function pushToSyncCode(code: string): Promise<void> {
  const payload = await buildPayload();
  const res = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.status === 404) throw new Error('That sync code no longer exists. Create a new one instead.');
  if (!res.ok) throw await errorFromResponse(res, 'while pushing');
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
  const res = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(code)}`);
  if (res.status === 404) {
    throw new Error("That sync code wasn't found — double-check it, or push from the other device first.");
  }
  if (!res.ok) throw await errorFromResponse(res, 'while pulling');
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
