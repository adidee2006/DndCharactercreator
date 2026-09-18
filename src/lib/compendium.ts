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
  ItemType,
  SpellSchool,
  ClassFeature,
  Subclass,
  Subrace,
  Trait,
  AbilityBonus,
  AbilityKey,
  SkillKey,
  SourceInfo,
} from '../types/compendium';
import { emptyCompendium, ABILITY_KEYS, SKILLS } from '../types/compendium';

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

type WithCitableSource<T> = Omit<T, 'source'> & { key?: string; name: string; source?: Partial<SourceInfo> };

/** Shape a user's homebrew JSON file should follow. Every field is optional/partial. */
export type CustomCompendiumInput = Partial<{
  label: string;
  races: Record<string, WithCitableSource<Partial<Race>>>;
  classes: Record<string, WithCitableSource<Partial<DndClass>>>;
  backgrounds: Record<string, WithCitableSource<Partial<Background>>>;
  feats: Record<string, WithCitableSource<Partial<Feat>>>;
  spells: Record<string, WithCitableSource<Partial<Spell>>>;
  items: Record<string, WithCitableSource<Partial<Item>>>;
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

function withDefaults<T extends { key?: string; name: string; source?: Partial<SourceInfo> }>(
  entryKey: string,
  raw: T,
  source: SourceInfo,
  defaults: object,
): T & { key: string; source: SourceInfo } {
  // An entry can carry its own partial `source` (e.g. { book, page }) to cite where it came from;
  // that merges onto the batch's origin/label rather than replacing it.
  return { ...defaults, ...raw, key: raw.key ?? entryKey, source: { ...source, ...raw.source } } as T & {
    key: string;
    source: SourceInfo;
  };
}

// --------------------------------------------------------------------------
// Sanitization: hand-written or converted homebrew JSON very often gets a
// field's *type* wrong (a lone string where the app expects an array, a
// prose paragraph where it expects a structured list, wrong casing on an
// enum). Every array-typed field the rest of the app assumes exists gets
// coerced here, at the import boundary, rather than trusting arbitrary
// input all the way down into render code — one bad field used to be able
// to crash the entire app (no error boundary previously existed either;
// that's fixed separately, this is the first line of defense).
// --------------------------------------------------------------------------

/** Coerces to an array: arrays pass through, a lone scalar/object becomes a 1-item array, null/undefined becomes undefined. */
function toArray<T>(value: unknown): T[] | undefined {
  if (Array.isArray(value)) return value as T[];
  if (value == null || value === '') return undefined;
  return [value as T];
}

function asStringArray(value: unknown, fallback: string[] = []): string[] {
  const arr = toArray<unknown>(value);
  if (!arr) return fallback;
  return arr.map((v) => String(v)).filter((s) => s.trim().length > 0);
}

function asAbilityKeyArray(value: unknown, fallback: AbilityKey[] = []): AbilityKey[] {
  const arr = toArray<unknown>(value);
  if (!arr) return fallback;
  return arr.map((v) => String(v).toLowerCase().slice(0, 3)).filter((v): v is AbilityKey => (ABILITY_KEYS as string[]).includes(v));
}

function asSkillKeyArray(value: unknown, fallback: SkillKey[] = []): SkillKey[] {
  const arr = toArray<unknown>(value);
  if (!arr) return fallback;
  const known = Object.keys(SKILLS);
  return arr.map((v) => String(v)).filter((v): v is SkillKey => known.includes(v));
}

function sanitizeFeatures(value: unknown): ClassFeature[] {
  const arr = toArray<unknown>(value) ?? [];
  return arr
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({
      level: Number(f.level) || 1,
      name: String(f.name ?? 'Feature'),
      description: String(f.description ?? ''),
    }));
}

function sanitizeSubclasses(value: unknown, warnKey: (name: string) => string): Subclass[] {
  const arr = toArray<unknown>(value) ?? [];
  return arr
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      key: String(s.key ?? warnKey(String(s.name ?? 'subclass'))),
      name: String(s.name ?? 'Subclass'),
      features: sanitizeFeatures(s.features),
    }));
}

function sanitizeAbilityBonuses(value: unknown): AbilityBonus[] {
  const arr = toArray<unknown>(value) ?? [];
  return arr
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map((b) => ({ ability: (String(b.ability ?? 'str').toLowerCase().slice(0, 3) as AbilityKey) || 'str', bonus: Number(b.bonus) || 0 }))
    .filter((b) => (ABILITY_KEYS as string[]).includes(b.ability));
}

function sanitizeTraits(value: unknown): Trait[] {
  const arr = toArray<unknown>(value) ?? [];
  return arr
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({ name: String(t.name ?? 'Trait'), description: String(t.description ?? '') }));
}

function sanitizeSubraces(value: unknown): Subrace[] | undefined {
  const arr = toArray<unknown>(value);
  if (!arr) return undefined;
  return arr
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      key: String(s.key ?? slugify(String(s.name ?? 'subrace'))),
      name: String(s.name ?? 'Subrace'),
      abilityBonuses: sanitizeAbilityBonuses(s.abilityBonuses),
      traits: sanitizeTraits(s.traits),
      speed: s.speed != null ? Number(s.speed) : undefined,
    }));
}

const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'shield', 'gear', 'tool', 'consumable', 'magic', 'mount', 'treasure'];
const ITEM_RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];
const SPELL_SCHOOLS: SpellSchool[] = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
];

function asItemType(value: unknown, warnings: string[], entryName: string): ItemType {
  const s = String(value ?? '').toLowerCase();
  const match = ITEM_TYPES.find((t) => t === s);
  if (match) return match;
  if (value != null) warnings.push(`Item "${entryName}" has unrecognized type "${String(value)}"; defaulting to "gear".`);
  return 'gear';
}

function asRarity(value: unknown): Item['rarity'] | undefined {
  if (value == null) return undefined;
  const match = ITEM_RARITIES.find((r) => r.toLowerCase() === String(value).toLowerCase());
  return match as Item['rarity'] | undefined;
}

function asSpellSchool(value: unknown, warnings: string[], entryName: string): SpellSchool {
  const s = String(value ?? '').toLowerCase();
  const match = SPELL_SCHOOLS.find((sc) => sc.toLowerCase() === s);
  if (match) return match;
  if (value != null) warnings.push(`Spell "${entryName}" has unrecognized school "${String(value)}"; defaulting to "Evocation".`);
  return 'Evocation';
}

function sanitizeRace(r: Race): Race {
  return {
    ...r,
    size: (['Tiny', 'Small', 'Medium', 'Large'] as const).includes(r.size) ? r.size : 'Medium',
    speed: Number(r.speed) || 30,
    abilityBonuses: sanitizeAbilityBonuses(r.abilityBonuses),
    traits: sanitizeTraits(r.traits),
    languages: asStringArray(r.languages),
    subraces: sanitizeSubraces((r as unknown as Record<string, unknown>).subraces),
  };
}

function sanitizeClass(c: DndClass): DndClass {
  const hitDie = ([6, 8, 10, 12] as const).includes(c.hitDie) ? c.hitDie : 8;
  return {
    ...c,
    hitDie,
    primaryAbility: asAbilityKeyArray(c.primaryAbility),
    savingThrowProficiencies: asAbilityKeyArray(c.savingThrowProficiencies),
    armorProficiencies: asStringArray(c.armorProficiencies),
    weaponProficiencies: asStringArray(c.weaponProficiencies),
    toolProficiencies: asStringArray(c.toolProficiencies),
    startingEquipment: asStringArray(c.startingEquipment),
    features: sanitizeFeatures(c.features),
    subclasses: sanitizeSubclasses(c.subclasses, (name) => slugify(name)),
    subclassLevel: Number(c.subclassLevel) || 3,
    skillChoices:
      c.skillChoices && typeof c.skillChoices === 'object'
        ? {
            count: Number(c.skillChoices.count) || 0,
            options: c.skillChoices.options === 'any' ? 'any' : asSkillKeyArray(c.skillChoices.options),
          }
        : { count: 2, options: 'any' },
  };
}

function sanitizeBackground(b: Background): Background {
  return {
    ...b,
    skillProficiencies: asSkillKeyArray(b.skillProficiencies),
    toolProficiencies: asStringArray(b.toolProficiencies),
    languages: Number(b.languages) || 0,
    equipment: asStringArray(b.equipment),
    feature:
      b.feature && typeof b.feature === 'object'
        ? { name: String(b.feature.name ?? 'Feature'), description: String(b.feature.description ?? '') }
        : { name: 'Feature', description: '' },
    personalityTraits: (b as unknown as Record<string, unknown>).personalityTraits != null ? asStringArray(b.personalityTraits) : undefined,
    ideals: (b as unknown as Record<string, unknown>).ideals != null ? asStringArray(b.ideals) : undefined,
    bonds: (b as unknown as Record<string, unknown>).bonds != null ? asStringArray(b.bonds) : undefined,
    flaws: (b as unknown as Record<string, unknown>).flaws != null ? asStringArray(b.flaws) : undefined,
  };
}

function sanitizeFeat(f: Feat): Feat {
  const raw = f as unknown as Record<string, unknown>;
  return {
    ...f,
    abilityBonusChoice:
      raw.abilityBonusChoice && typeof raw.abilityBonusChoice === 'object'
        ? {
            abilities: asAbilityKeyArray((raw.abilityBonusChoice as Record<string, unknown>).abilities),
            amount: Number((raw.abilityBonusChoice as Record<string, unknown>).amount) || 1,
          }
        : undefined,
  };
}

function sanitizeSpell(s: Spell, warnings: string[]): Spell {
  return {
    ...s,
    level: Math.max(0, Math.min(9, Number(s.level) || 0)),
    school: asSpellSchool(s.school, warnings, s.name),
    classes: asStringArray(s.classes).map((c) => slugify(c)),
    concentration: !!s.concentration,
    ritual: !!s.ritual,
  };
}

function sanitizeItem(i: Item, warnings: string[]): Item {
  const raw = i as unknown as Record<string, unknown>;
  return {
    ...i,
    type: asItemType(i.type, warnings, i.name),
    weight: raw.weight != null && raw.weight !== '' ? Number(raw.weight) || undefined : undefined,
    contains: raw.contains != null ? asStringArray(raw.contains) : undefined,
    weaponProperties: raw.weaponProperties != null ? asStringArray(raw.weaponProperties) : undefined,
    rarity: asRarity(raw.rarity),
    requiresAttunement: !!raw.requiresAttunement,
    stealthDisadvantage: !!raw.stealthDisadvantage,
  };
}

/** Looks up any existing record for this key (a previous custom import, a remote sync, or bundled SRD data), to merge onto rather than replace. */
async function existingBase<T>(table: { get(key: string): Promise<T | undefined> }, key: string, srdRecord: T | undefined): Promise<Partial<T> | undefined> {
  const existingCustom = await table.get(key);
  return existingCustom ?? srdRecord;
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

  // A custom entry reusing an existing key (its own previous import, a
  // remote-synced entry, or a bundled SRD one) merges onto that record
  // instead of replacing it outright — a partial homebrew override (say,
  // just a reworded description) used to blank out every array field the
  // original entry had (proficiencies, features, subclasses...), which is
  // what made "override the Fighter with my own notes" silently destroy
  // the Fighter's mechanics instead of just annotating them.
  if (races) {
    const rows = await Promise.all(
      Object.entries(races).map(async ([k, v]) => {
        const key = v.key ?? k;
        const base = (await existingBase(db.races, key, srdCompendium.races[key])) ?? {
          size: 'Medium',
          speed: 30,
          abilityBonuses: [],
          traits: [],
          languages: [],
        };
        return sanitizeRace(withDefaults(k, v, source, base) as Race);
      }),
    );
    await db.races.bulkPut(rows);
    counts.races = rows.length;
  }
  if (classes) {
    const rows = await Promise.all(
      Object.entries(classes).map(async ([k, v]) => {
        const key = v.key ?? k;
        const base = await existingBase(db.classes, key, srdCompendium.classes[key]);
        if (!base && !v.hitDie) warnings.push(`Class "${v.name ?? k}" has no hitDie; defaulting to d8.`);
        const merged = withDefaults(k, v, source, base ?? {
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
        return sanitizeClass(merged as DndClass);
      }),
    );
    await db.classes.bulkPut(rows);
    counts.classes = rows.length;
  }
  if (backgrounds) {
    const rows = await Promise.all(
      Object.entries(backgrounds).map(async ([k, v]) => {
        const key = v.key ?? k;
        const base = (await existingBase(db.backgrounds, key, srdCompendium.backgrounds[key])) ?? {
          skillProficiencies: [],
          toolProficiencies: [],
          languages: 0,
          equipment: [],
          feature: { name: 'Feature', description: '' },
        };
        return sanitizeBackground(withDefaults(k, v, source, base) as Background);
      }),
    );
    await db.backgrounds.bulkPut(rows);
    counts.backgrounds = rows.length;
  }
  if (feats) {
    const rows = await Promise.all(
      Object.entries(feats).map(async ([k, v]) => {
        const key = v.key ?? k;
        const base = (await existingBase(db.feats, key, srdCompendium.feats[key])) ?? { description: '' };
        return sanitizeFeat(withDefaults(k, v, source, base) as Feat);
      }),
    );
    await db.feats.bulkPut(rows);
    counts.feats = rows.length;
  }
  if (spells) {
    const rows = await Promise.all(
      Object.entries(spells).map(async ([k, v]) => {
        const key = v.key ?? k;
        const base = (await existingBase(db.spells, key, srdCompendium.spells[key])) ?? {
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
        };
        return sanitizeSpell(withDefaults(k, v, source, base) as Spell, warnings);
      }),
    );
    await db.spells.bulkPut(rows);
    counts.spells = rows.length;
  }
  if (items) {
    const rows = await Promise.all(
      Object.entries(items).map(async ([k, v]) => {
        const key = v.key ?? k;
        const base = (await existingBase(db.items, key, srdCompendium.items[key])) ?? { type: 'gear' };
        return sanitizeItem(withDefaults(k, v, source, base) as Item, warnings);
      }),
    );
    await db.items.bulkPut(rows);
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
