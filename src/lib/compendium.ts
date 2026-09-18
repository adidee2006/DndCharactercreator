import { db } from './db';
import { srdCompendium, SRD_VERSION } from '../data/srd';
import type {
  Compendium,
  Race,
  DndClass,
  Background,
  Feat,
  Spell,
  Item,
  SourceInfo,
} from '../types/compendium';
import { emptyCompendium } from '../types/compendium';

type CategoryKey = keyof Compendium;

const CATEGORY_TABLES = {
  races: () => db.races,
  classes: () => db.classes,
  backgrounds: () => db.backgrounds,
  feats: () => db.feats,
  spells: () => db.spells,
  items: () => db.items,
} as const;

/**
 * Builds the effective compendium: bundled SRD data as the base layer, with
 * anything synced from the internet or imported as a custom/homebrew
 * compendium overlaid on top (by key, so overrides win).
 */
export async function loadMergedCompendium(): Promise<Compendium> {
  const merged: Compendium = {
    races: { ...srdCompendium.races },
    classes: { ...srdCompendium.classes },
    backgrounds: { ...srdCompendium.backgrounds },
    feats: { ...srdCompendium.feats },
    spells: { ...srdCompendium.spells },
    items: { ...srdCompendium.items },
  };

  const [races, classes, backgrounds, feats, spells, items] = await Promise.all([
    db.races.toArray(),
    db.classes.toArray(),
    db.backgrounds.toArray(),
    db.feats.toArray(),
    db.spells.toArray(),
    db.items.toArray(),
  ]);

  for (const r of races) merged.races[r.key] = r;
  for (const c of classes) merged.classes[c.key] = c;
  for (const b of backgrounds) merged.backgrounds[b.key] = b;
  for (const f of feats) merged.feats[f.key] = f;
  for (const s of spells) merged.spells[s.key] = s;
  for (const i of items) merged.items[i.key] = i;

  return merged;
}

export async function getCompendiumStats() {
  const merged = await loadMergedCompendium();
  const countByOrigin = (records: Record<string, { source: SourceInfo }>) => {
    const counts = { srd: 0, remote: 0, custom: 0 };
    for (const rec of Object.values(records)) counts[rec.source.origin]++;
    return counts;
  };
  return {
    races: { total: Object.keys(merged.races).length, ...countByOrigin(merged.races) },
    classes: { total: Object.keys(merged.classes).length, ...countByOrigin(merged.classes) },
    backgrounds: { total: Object.keys(merged.backgrounds).length, ...countByOrigin(merged.backgrounds) },
    feats: { total: Object.keys(merged.feats).length, ...countByOrigin(merged.feats) },
    spells: { total: Object.keys(merged.spells).length, ...countByOrigin(merged.spells) },
    items: { total: Object.keys(merged.items).length, ...countByOrigin(merged.items) },
    bundledVersion: SRD_VERSION,
  };
}

export async function getSyncMeta(key: string): Promise<string | undefined> {
  const rec = await db.meta.get(key);
  return rec?.value;
}

async function setSyncMeta(key: string, value: string) {
  await db.meta.put({ key, value });
}

/** Removes every remotely-synced entry (keeps bundled SRD data and custom imports intact). */
export async function clearRemoteData() {
  for (const key of Object.keys(CATEGORY_TABLES) as CategoryKey[]) {
    const table = CATEGORY_TABLES[key]();
    const rows = await table.filter((r: { source: SourceInfo }) => r.source.origin === 'remote').toArray();
    await table.bulkDelete(rows.map((r: { key: string }) => r.key));
  }
  await setSyncMeta('lastRemoteSync', '');
}

/** Removes every custom/homebrew entry (keeps bundled SRD data and remote sync intact). */
export async function clearCustomData() {
  for (const key of Object.keys(CATEGORY_TABLES) as CategoryKey[]) {
    const table = CATEGORY_TABLES[key]();
    const rows = await table.filter((r: { source: SourceInfo }) => r.source.origin === 'custom').toArray();
    await table.bulkDelete(rows.map((r: { key: string }) => r.key));
  }
}

export interface SyncProgress {
  stage: string;
  fetched: number;
  errors: string[];
}

const DND5E_API = 'https://www.dnd5eapi.co/api';

interface D5eApiIndexEntry {
  index: string;
  name: string;
  url: string;
}
interface D5eApiListResponse {
  count: number;
  results: D5eApiIndexEntry[];
}

const FETCH_TIMEOUT_MS = 12000;

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('timed out');
    // A network-level failure here almost always means the request never left the
    // browser (offline, DNS failure, or the remote host refusing/CORS-blocking it),
    // not a bug in the parsing below — surface that distinction to the user.
    if (err instanceof TypeError) throw new Error('network request failed (offline, or the API is unreachable from this browser)');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Runs async work over a list with at most `limit` requests in flight at once. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const REMOTE: SourceInfo = { origin: 'remote', label: 'dnd5eapi.co (synced)' };
const CONCURRENCY = 8;

/**
 * Pulls the full SRD spell and equipment lists from the public dnd5eapi.co
 * REST API and stores them as "remote" compendium entries, which take
 * precedence over the bundled starter data. Safe to re-run; it's an upsert.
 * Fetches run with bounded concurrency (not one-at-a-time) so a full sync
 * takes seconds rather than minutes.
 */
export async function syncCompendiumFromInternet(
  onProgress?: (p: SyncProgress) => void,
): Promise<{ spellsFetched: number; spellsSaved: number; itemsFetched: number; itemsSaved: number; errors: string[] }> {
  const errors: string[] = [];
  let spellsFetched = 0;
  let spellsSaved = 0;
  let itemsFetched = 0;
  let itemsSaved = 0;

  const report = (stage: string, fetched: number) => onProgress?.({ stage, fetched, errors });

  // --- Spells ---
  try {
    report('Listing spells…', 0);
    const list = await fetchJson<D5eApiListResponse>(`${DND5E_API}/spells`);
    let fetched = 0;
    const spellResults = await mapWithConcurrency(list.results, CONCURRENCY, async (entry) => {
      try {
        const detail = await fetchJson<any>(`${DND5E_API}${entry.url}`);
        const spell: Spell = {
          key: detail.index,
          name: detail.name,
          source: REMOTE,
          level: detail.level ?? 0,
          school: (detail.school?.name ?? 'Evocation') as Spell['school'],
          castingTime: detail.casting_time ?? '1 action',
          range: detail.range ?? 'Self',
          components: [...(detail.components ?? []), detail.material ? `(${detail.material})` : '']
            .filter(Boolean)
            .join(', '),
          duration: detail.duration ?? 'Instantaneous',
          concentration: !!detail.concentration,
          ritual: !!detail.ritual,
          classes: (detail.classes ?? []).map((c: { index: string }) => c.index),
          description: Array.isArray(detail.desc) ? detail.desc.join('\n\n') : String(detail.desc ?? ''),
        };
        return spell;
      } catch (err) {
        errors.push(`Spell "${entry.name}": ${(err as Error).message}`);
        return null;
      } finally {
        fetched++;
        if (fetched % 15 === 0 || fetched === list.results.length) report('Fetching spells…', fetched);
      }
    });
    const spellsToSave = spellResults.filter((s): s is Spell => s != null);
    spellsFetched = list.results.length;
    try {
      await db.spells.bulkPut(spellsToSave);
      spellsSaved = spellsToSave.length;
    } catch (err) {
      errors.push(`Saving spells to the local database failed: ${(err as Error).message}`);
    }
    report('Fetching spells…', spellsFetched);
  } catch (err) {
    errors.push(`Couldn't list spells: ${(err as Error).message}`);
  }

  // --- Equipment (weapons, armor, adventuring gear) ---
  try {
    report('Listing equipment…', 0);
    const list = await fetchJson<D5eApiListResponse>(`${DND5E_API}/equipment`);
    let fetched = 0;
    const itemResults = await mapWithConcurrency(list.results, CONCURRENCY, async (entry) => {
      try {
        const detail = await fetchJson<any>(`${DND5E_API}${entry.url}`);
        const category: string = detail.equipment_category?.name ?? 'Adventuring Gear';
        const isWeapon = category === 'Weapon';
        const isArmor = category === 'Armor';
        const item: Item = {
          key: detail.index,
          name: detail.name,
          source: REMOTE,
          type: isWeapon ? 'weapon' : isArmor ? (detail.armor_category === 'Shield' ? 'shield' : 'armor') : 'gear',
          cost: detail.cost ? `${detail.cost.quantity} ${detail.cost.unit}` : undefined,
          weight: detail.weight,
          damage: detail.damage?.damage_dice,
          damageType: detail.damage?.damage_type?.name,
          weaponProperties: (detail.properties ?? []).map((p: { name: string }) => p.name),
          armorClassBase: detail.armor_class?.base,
          armorClassAddDex: detail.armor_class?.dex_bonus,
          armorClassMaxDex: detail.armor_class?.max_bonus,
          strengthRequirement: detail.str_minimum || undefined,
          stealthDisadvantage: !!detail.stealth_disadvantage,
          description: Array.isArray(detail.desc) ? detail.desc.join('\n\n') : undefined,
        };
        return item;
      } catch (err) {
        errors.push(`Item "${entry.name}": ${(err as Error).message}`);
        return null;
      } finally {
        fetched++;
        if (fetched % 15 === 0 || fetched === list.results.length) report('Fetching equipment…', fetched);
      }
    });
    const itemsToSave = itemResults.filter((i): i is Item => i != null);
    itemsFetched = list.results.length;
    try {
      await db.items.bulkPut(itemsToSave);
      itemsSaved = itemsToSave.length;
    } catch (err) {
      errors.push(`Saving equipment to the local database failed: ${(err as Error).message}`);
    }
    report('Fetching equipment…', itemsFetched);
  } catch (err) {
    errors.push(`Couldn't list equipment: ${(err as Error).message}`);
  }

  if (spellsSaved > 0 || itemsSaved > 0) {
    await setSyncMeta('lastRemoteSync', new Date().toISOString());
    await setSyncMeta('lastRemoteSyncCounts', JSON.stringify({ spellsSaved, itemsSaved }));
  }

  return { spellsFetched, spellsSaved, itemsFetched, itemsSaved, errors };
}

// --------------------------------------------------------------------------
// Custom / homebrew compendium import
// --------------------------------------------------------------------------

/** Shape a user's homebrew JSON file should follow. Every field is optional/partial. */
export type CustomCompendiumInput = Partial<{
  label: string;
  races: Record<string, Partial<Race> & { key?: string; name: string }>;
  classes: Record<string, Partial<DndClass> & { key?: string; name: string }>;
  backgrounds: Record<string, Partial<Background> & { key?: string; name: string }>;
  feats: Record<string, Partial<Feat> & { key?: string; name: string }>;
  spells: Record<string, Partial<Spell> & { key?: string; name: string }>;
  items: Record<string, Partial<Item> & { key?: string; name: string }>;
}>;

export interface CustomImportResult {
  counts: Record<CategoryKey, number>;
  warnings: string[];
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'entry'
  );
}

/**
 * Accepts a category either as the documented shape (object keyed by slug)
 * or as a plain array of entries (a very natural mistake to make writing
 * homebrew JSON by hand) and normalizes to the keyed form, slugifying each
 * entry's name for a key when one isn't already provided.
 */
function normalizeCategory<T extends { key?: string; name?: string }>(
  value: unknown,
): Record<string, T> | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const out: Record<string, T> = {};
    const seen = new Map<string, number>();
    for (const entry of value as T[]) {
      const base = entry.key ?? slugify(entry.name ?? 'entry');
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      out[n === 0 ? base : `${base}-${n}`] = entry;
    }
    return out;
  }
  if (typeof value === 'object') return value as Record<string, T>;
  return undefined;
}

function withDefaults<T extends { key?: string; name: string }>(
  entryKey: string,
  raw: T,
  source: SourceInfo,
  defaults: object,
): T & { key: string; source: SourceInfo } {
  return { ...defaults, ...raw, key: raw.key ?? entryKey, source } as T & { key: string; source: SourceInfo };
}

/**
 * Validates and stores a user-supplied custom/homebrew compendium (parsed
 * JSON matching CustomCompendiumInput). Entries are upserted by key, so a
 * custom entry can either add new content or override bundled/remote data.
 * Tolerant of a few common shape mistakes (arrays instead of keyed objects)
 * and throws a clear, specific error when the file doesn't match anything
 * recognizable, rather than silently importing nothing.
 */
export async function importCustomCompendium(rawInput: unknown): Promise<CustomImportResult> {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw new Error(
      'Expected a JSON object with one or more of these top-level keys: races, classes, backgrounds, feats, spells, items. ' +
        (Array.isArray(rawInput)
          ? 'Got a JSON array instead — wrap it as, e.g., { "items": [ ...your array... ] }.'
          : 'Got something else instead.'),
    );
  }

  const input = rawInput as Record<string, unknown>;
  const races = normalizeCategory<Partial<Race> & { name: string }>(input.races);
  const classes = normalizeCategory<Partial<DndClass> & { name: string }>(input.classes);
  const backgrounds = normalizeCategory<Partial<Background> & { name: string }>(input.backgrounds);
  const feats = normalizeCategory<Partial<Feat> & { name: string }>(input.feats);
  const spells = normalizeCategory<Partial<Spell> & { name: string }>(input.spells);
  const items = normalizeCategory<Partial<Item> & { name: string }>(input.items);

  if (!races && !classes && !backgrounds && !feats && !spells && !items) {
    throw new Error(
      'No recognized categories found in this file. Expected one or more of: races, classes, backgrounds, feats, spells, items — each either an object keyed by a short id, or an array of entries.',
    );
  }

  const warnings: string[] = [];
  const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim() : 'Custom Compendium';
  const source: SourceInfo = { origin: 'custom', label };
  const counts: Record<CategoryKey, number> = { races: 0, classes: 0, backgrounds: 0, feats: 0, spells: 0, items: 0 };

  if (races) {
    const rows = Object.entries(races).map(([k, v]) =>
      withDefaults(k, v, source, { size: 'Medium', speed: 30, abilityBonuses: [], traits: [], languages: [] }),
    );
    await db.races.bulkPut(rows as Race[]);
    counts.races = rows.length;
  }
  if (classes) {
    const rows = Object.entries(classes).map(([k, v]) => {
      if (!v.hitDie) warnings.push(`Class "${v.name ?? k}" has no hitDie; defaulting to d8.`);
      return withDefaults(k, v, source, {
        hitDie: 8,
        primaryAbility: [],
        savingThrowProficiencies: [],
        armorProficiencies: [],
        weaponProficiencies: [],
        toolProficiencies: [],
        skillChoices: { count: 2, options: 'any' },
        startingEquipment: [],
        features: [],
        subclassLevel: 3,
        subclasses: [],
      });
    });
    await db.classes.bulkPut(rows as DndClass[]);
    counts.classes = rows.length;
  }
  if (backgrounds) {
    const rows = Object.entries(backgrounds).map(([k, v]) =>
      withDefaults(k, v, source, {
        skillProficiencies: [],
        toolProficiencies: [],
        languages: 0,
        equipment: [],
        feature: { name: 'Feature', description: '' },
      }),
    );
    await db.backgrounds.bulkPut(rows as Background[]);
    counts.backgrounds = rows.length;
  }
  if (feats) {
    const rows = Object.entries(feats).map(([k, v]) => withDefaults(k, v, source, { description: '' }));
    await db.feats.bulkPut(rows as Feat[]);
    counts.feats = rows.length;
  }
  if (spells) {
    const rows = Object.entries(spells).map(([k, v]) =>
      withDefaults(k, v, source, {
        level: 0,
        school: 'Evocation',
        castingTime: '1 action',
        range: 'Self',
        components: 'V, S',
        duration: 'Instantaneous',
        concentration: false,
        ritual: false,
        classes: [],
        description: '',
      }),
    );
    await db.spells.bulkPut(rows as Spell[]);
    counts.spells = rows.length;
  }
  if (items) {
    const rows = Object.entries(items).map(([k, v]) => withDefaults(k, v, source, { type: 'gear' }));
    await db.items.bulkPut(rows as Item[]);
    counts.items = rows.length;
  }

  return { counts, warnings };
}

export async function exportCustomCompendium(): Promise<CustomCompendiumInput & { label: string }> {
  const isCustom = (r: { source: SourceInfo }) => r.source.origin === 'custom';
  const [races, classes, backgrounds, feats, spells, items] = await Promise.all([
    db.races.filter(isCustom).toArray(),
    db.classes.filter(isCustom).toArray(),
    db.backgrounds.filter(isCustom).toArray(),
    db.feats.filter(isCustom).toArray(),
    db.spells.filter(isCustom).toArray(),
    db.items.filter(isCustom).toArray(),
  ]);
  const toRecord = <T extends { key: string }>(arr: T[]) => Object.fromEntries(arr.map((r) => [r.key, r]));
  return {
    label: 'My Custom Compendium',
    races: toRecord(races),
    classes: toRecord(classes),
    backgrounds: toRecord(backgrounds),
    feats: toRecord(feats),
    spells: toRecord(spells),
    items: toRecord(items),
  };
}

export function newEmptyCompendium(): Compendium {
  return emptyCompendium();
}
