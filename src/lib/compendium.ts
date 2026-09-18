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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

const REMOTE: SourceInfo = { origin: 'remote', label: 'dnd5eapi.co (synced)' };

/**
 * Pulls the full SRD spell and equipment lists from the public dnd5eapi.co
 * REST API and stores them as "remote" compendium entries, which take
 * precedence over the bundled starter data. Safe to re-run; it's an upsert.
 */
export async function syncCompendiumFromInternet(
  onProgress?: (p: SyncProgress) => void,
): Promise<{ spells: number; items: number; errors: string[] }> {
  const errors: string[] = [];
  let spellCount = 0;
  let itemCount = 0;

  const report = (stage: string, fetched: number) => onProgress?.({ stage, fetched, errors });

  // --- Spells ---
  try {
    report('Listing spells…', 0);
    const list = await fetchJson<D5eApiListResponse>(`${DND5E_API}/spells`);
    const spellsToSave: Spell[] = [];
    for (const entry of list.results) {
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
          components: [
            ...(detail.components ?? []),
            detail.material ? `(${detail.material})` : '',
          ]
            .filter(Boolean)
            .join(', '),
          duration: detail.duration ?? 'Instantaneous',
          concentration: !!detail.concentration,
          ritual: !!detail.ritual,
          classes: (detail.classes ?? []).map((c: { index: string }) => c.index),
          description: Array.isArray(detail.desc) ? detail.desc.join('\n\n') : String(detail.desc ?? ''),
        };
        spellsToSave.push(spell);
      } catch (err) {
        errors.push(`Spell "${entry.name}": ${(err as Error).message}`);
      }
      spellCount++;
      if (spellCount % 15 === 0) report('Fetching spells…', spellCount);
    }
    await db.spells.bulkPut(spellsToSave);
    report('Fetching spells…', spellCount);
  } catch (err) {
    errors.push(`Spell list: ${(err as Error).message}`);
  }

  // --- Equipment (weapons, armor, adventuring gear) ---
  try {
    report('Listing equipment…', 0);
    const list = await fetchJson<D5eApiListResponse>(`${DND5E_API}/equipment`);
    const itemsToSave: Item[] = [];
    for (const entry of list.results) {
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
        itemsToSave.push(item);
      } catch (err) {
        errors.push(`Item "${entry.name}": ${(err as Error).message}`);
      }
      itemCount++;
      if (itemCount % 15 === 0) report('Fetching equipment…', itemCount);
    }
    await db.items.bulkPut(itemsToSave);
    report('Fetching equipment…', itemCount);
  } catch (err) {
    errors.push(`Equipment list: ${(err as Error).message}`);
  }

  await setSyncMeta('lastRemoteSync', new Date().toISOString());
  await setSyncMeta('lastRemoteSyncCounts', JSON.stringify({ spells: spellCount, items: itemCount }));

  return { spells: spellCount, items: itemCount, errors };
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
 */
export async function importCustomCompendium(input: CustomCompendiumInput): Promise<CustomImportResult> {
  const warnings: string[] = [];
  const label = input.label?.trim() || 'Custom Compendium';
  const source: SourceInfo = { origin: 'custom', label };
  const counts: Record<CategoryKey, number> = { races: 0, classes: 0, backgrounds: 0, feats: 0, spells: 0, items: 0 };

  if (input.races) {
    const rows = Object.entries(input.races).map(([k, v]) =>
      withDefaults(k, v, source, { size: 'Medium', speed: 30, abilityBonuses: [], traits: [], languages: [] }),
    );
    await db.races.bulkPut(rows as Race[]);
    counts.races = rows.length;
  }
  if (input.classes) {
    const rows = Object.entries(input.classes).map(([k, v]) => {
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
  if (input.backgrounds) {
    const rows = Object.entries(input.backgrounds).map(([k, v]) =>
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
  if (input.feats) {
    const rows = Object.entries(input.feats).map(([k, v]) => withDefaults(k, v, source, { description: '' }));
    await db.feats.bulkPut(rows as Feat[]);
    counts.feats = rows.length;
  }
  if (input.spells) {
    const rows = Object.entries(input.spells).map(([k, v]) =>
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
  if (input.items) {
    const rows = Object.entries(input.items).map(([k, v]) => withDefaults(k, v, source, { type: 'gear' }));
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
