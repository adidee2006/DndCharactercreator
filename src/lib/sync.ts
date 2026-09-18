import { listCharacters, getCharacter, saveCharacter } from './characters';
import type { Character } from '../types/character';

const SYNC_STORAGE_KEY = 'dnd-cc-sync-code';
const API_BASE = 'https://jsonblob.com/api/jsonBlob';
const FETCH_TIMEOUT_MS = 15000;

export interface SyncPayload {
  format: 'dnd-character-creator/sync';
  version: 1;
  savedAt: string;
  characters: Character[];
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('The sync service timed out. Try again in a moment.');
    if (err instanceof TypeError) {
      throw new Error(
        "Couldn't reach the sync service (jsonblob.com). Check your internet connection — if this keeps happening, use Export/Import JSON instead.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Pulls a blob id out of wherever the service put it — a Location header, or a field in the JSON body. */
function extractBlobId(locationHeader: string | null, body: unknown): string | null {
  const fromHeader = locationHeader?.split('/').filter(Boolean).pop();
  if (fromHeader) return fromHeader;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    for (const key of ['id', 'blobId', 'uri', 'url']) {
      const v = b[key];
      if (typeof v === 'string') return v.split('/').filter(Boolean).pop() ?? v;
    }
  }
  return null;
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
    // localStorage unavailable (private browsing etc.) — sync code just won't persist across reloads.
  }
}

async function buildPayload(): Promise<SyncPayload> {
  const characters = await listCharacters();
  return { format: 'dnd-character-creator/sync', version: 1, savedAt: new Date().toISOString(), characters };
}

/** Creates a brand-new sync blob from everything currently saved locally, returning its shareable code. */
export async function createSyncCode(): Promise<string> {
  const payload = await buildPayload();
  const res = await fetchWithTimeout(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Sync service returned ${res.status} ${res.statusText}.`);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Some deployments return an empty body on create — that's fine, we only need the Location header then.
  }
  const id = extractBlobId(res.headers.get('location'), body);
  if (!id) {
    throw new Error(
      "The sync service didn't return a usable code. It may have changed its API — please use Export/Import JSON instead for now.",
    );
  }
  setStoredSyncCode(id);
  return id;
}

/** Overwrites an existing sync code's data with everything currently saved locally. */
export async function pushToSyncCode(code: string): Promise<void> {
  const payload = await buildPayload();
  const res = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.status === 404) throw new Error('That sync code no longer exists. Create a new one instead.');
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
  const res = await fetchWithTimeout(`${API_BASE}/${encodeURIComponent(code)}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) throw new Error("That sync code wasn't found. Double-check it, or create a new one on the other device.");
  if (!res.ok) throw new Error(`Sync service returned ${res.status} ${res.statusText}.`);
  const data = (await res.json()) as Partial<SyncPayload>;
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
