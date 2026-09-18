import { useEffect, useRef, useState } from 'react';
import {
  getCompendiumStats,
  getSyncMeta,
  syncCompendiumFromInternet,
  clearRemoteData,
  clearCustomData,
  importCustomCompendium,
  exportCustomCompendium,
  type SyncProgress,
  type CustomCompendiumInput,
} from '../lib/compendium';
import { downloadJson } from '../lib/jsonExport';
import { useCompendiumVersion } from '../store/compendiumStore';
import { useCompendium } from '../store/useCompendium';
import type { ItemType, SpellSchool } from '../types/compendium';

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'entry'
  );
}

type Stats = Awaited<ReturnType<typeof getCompendiumStats>>;

const CATEGORY_LABELS: Record<keyof Omit<Stats, 'bundledVersion'>, string> = {
  races: 'Races',
  classes: 'Classes',
  backgrounds: 'Backgrounds',
  feats: 'Feats',
  spells: 'Spells',
  items: 'Items & Equipment',
};

interface SyncResult {
  spellsFetched: number;
  spellsSaved: number;
  itemsFetched: number;
  itemsSaved: number;
  errors: string[];
  fatal?: string;
}

export default function CompendiumManager() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastSync, setLastSync] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [packLoading, setPackLoading] = useState(false);
  const [packStatus, setPackStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bump = useCompendiumVersion((s) => s.bump);

  async function refresh() {
    setStats(await getCompendiumStats());
    setLastSync(await getSyncMeta('lastRemoteSync'));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setProgress(null);
    setSyncResult(null);
    try {
      const result = await syncCompendiumFromInternet((p) => setProgress(p));
      setSyncResult(result);
      // Only bump/refresh if something actually landed in the DB — bumping on a
      // fully-failed sync makes every screen refetch for no visible change,
      // which is exactly the "sync doesn't show anything" symptom.
      if (result.spellsSaved > 0 || result.itemsSaved > 0) {
        bump();
        await refresh();
      }
    } catch (err) {
      setSyncResult({ spellsFetched: 0, spellsSaved: 0, itemsFetched: 0, itemsSaved: 0, errors: [], fatal: (err as Error).message });
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearRemote() {
    if (!confirm('Remove all internet-synced content? Bundled SRD data and custom imports are kept.')) return;
    await clearRemoteData();
    bump();
    refresh();
  }

  async function handleClearCustom() {
    if (!confirm('Remove all custom/homebrew content?')) return;
    await clearCustomData();
    bump();
    refresh();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text()) as CustomCompendiumInput;
      const result = await importCustomCompendium(json);
      bump();
      await refresh();
      const summary = Object.entries(result.counts)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ');
      setImportResult(`Imported: ${summary || 'nothing found'}.${result.warnings.length ? ` Warnings: ${result.warnings.join(' ')}` : ''}`);
    } catch (err) {
      alert(`Couldn’t import that file: ${(err as Error).message}`);
    }
  }

  async function handleLoadCommunityPack() {
    setPackLoading(true);
    setPackStatus(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/dnd-data-pack.json`);
      if (!res.ok) throw new Error(`Couldn't load the pack (${res.status} ${res.statusText}).`);
      const json = await res.json();
      const result = await importCustomCompendium(json);
      bump();
      await refresh();
      const summary = Object.entries(result.counts)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ');
      setPackStatus(`Loaded: ${summary}.`);
    } catch (err) {
      setPackStatus(`Couldn't load the community pack: ${(err as Error).message}`);
    } finally {
      setPackLoading(false);
    }
  }

  async function handleExportCustom() {
    const data = await exportCustomCompendium();
    downloadJson('my-custom-compendium.json', data);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Compendium</h1>
      <p className="mb-6 max-w-3xl text-sm text-stone-500">
        Every character is built from this rules library. It ships with a bundled SRD-based starter set, can be
        refreshed from a free public D&amp;D 5e API, and can be extended or overridden with your own homebrew content.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="section-title">Update from the Internet</h2>
          <p className="mb-3 text-sm text-stone-500">
            Pulls the full SRD spell list and equipment list from{' '}
            <span className="font-mono text-xs">dnd5eapi.co</span> and merges them into your local compendium. Requires
            an internet connection; your existing bundled data and homebrew content are never deleted by this.
          </p>
          <button className="btn-primary" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <button className="btn-ghost ml-2" onClick={handleClearRemote}>
            Clear Synced Data
          </button>
          {syncing && progress && (
            <p className="mt-2 text-xs text-stone-500">
              {progress.stage} ({progress.fetched} fetched)
            </p>
          )}

          {!syncing && syncResult && (
            <div className="mt-3 rounded-lg border border-stone-300 p-3 text-sm dark:border-stone-700">
              {syncResult.fatal ? (
                <p className="text-red-700 dark:text-red-400">
                  Sync couldn’t run at all: {syncResult.fatal}. This usually means this device is offline or the
                  network is blocking requests to dnd5eapi.co.
                </p>
              ) : syncResult.spellsSaved === 0 && syncResult.itemsSaved === 0 ? (
                <p className="text-red-700 dark:text-red-400">
                  Sync ran but nothing was saved ({syncResult.errors.length} error
                  {syncResult.errors.length === 1 ? '' : 's'}). Nothing in your compendium changed.
                </p>
              ) : (
                <p className="text-emerald-700 dark:text-emerald-400">
                  Saved {syncResult.spellsSaved} of {syncResult.spellsFetched} spells and {syncResult.itemsSaved} of{' '}
                  {syncResult.itemsFetched} equipment entries to your local compendium.
                </p>
              )}
              {syncResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-stone-500">
                    {syncResult.errors.length} error{syncResult.errors.length === 1 ? '' : 's'} — click to view
                  </summary>
                  <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs text-stone-500">
                    {syncResult.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {lastSync && <p className="mt-2 text-xs text-stone-500">Last successful sync: {new Date(lastSync).toLocaleString()}</p>}
        </div>

        <div className="card p-5">
          <h2 className="section-title">Custom / Homebrew Compendium</h2>
          <p className="mb-3 text-sm text-stone-500">
            Import a JSON file with your own races, classes, backgrounds, feats, spells, or items. Entries use the same
            key as an existing entry to override it, or a new key to add new content.
          </p>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
          <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
            Import Custom Compendium
          </button>
          <button className="btn-secondary ml-2" onClick={handleExportCustom}>
            Export My Custom Content
          </button>
          <button className="btn-ghost ml-2" onClick={handleClearCustom}>
            Clear Custom Data
          </button>
          {importResult && <p className="mt-2 text-xs text-stone-500">{importResult}</p>}
          <details className="mt-3 text-xs text-stone-500">
            <summary className="cursor-pointer font-medium">Expected JSON shape</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-stone-100 p-2 dark:bg-stone-800">{`{
  "label": "My Homebrew Pack",
  "items": {
    "flametongue-dagger": {
      "name": "Flametongue Dagger",
      "type": "weapon",
      "damage": "1d4",
      "damageType": "fire",
      "rarity": "Rare"
    }
  },
  "spells": { "my-spell-key": { "name": "...", "level": 2, ... } },
  "races": { ... }, "classes": { ... }, "backgrounds": { ... }, "feats": { ... }
}`}</pre>
          </details>
        </div>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="section-title">Community Content Pack</h2>
        <p className="mb-2 text-sm text-stone-500">
          Adds 319 core Player's Handbook spells and 658 Dungeon Master's Guide magic items, bundled with the app (no
          internet connection needed). Sourced from the{' '}
          <span className="font-mono text-xs">nick-aschenbach/dnd-data</span> project on GitHub, filtered down to
          official Wizards of the Coast, 2014-ruleset content only — everything else in that dataset (homebrew from
          other publishers, the newer 2024 rulebooks, monster stat blocks) is left out, either because it doesn't
          match this app's ruleset or because its structure was too unreliable to convert without risking wrong data.
        </p>
        <p className="mb-3 text-xs text-stone-500">
          Note: none of this app's data sources — including this pack — include real Player's Handbook page numbers;
          that information isn't published in any freely available dataset. Entries show which <em>book</em> they're
          from where known, but not a page number.
        </p>
        <button className="btn-primary" onClick={handleLoadCommunityPack} disabled={packLoading}>
          {packLoading ? 'Loading…' : 'Load Community Pack'}
        </button>
        {packStatus && <p className="mt-2 text-xs text-stone-500">{packStatus}</p>}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="section-title">Create Custom Content</h2>
        <p className="mb-3 text-sm text-stone-500">
          Build a homebrew item, spell, or feat with a form instead of hand-writing JSON. Saved entries show up
          everywhere the built-in compendium does — equipment pickers, spell lists, feat choices.
        </p>
        <CreateCustomContent onSaved={() => { bump(); refresh(); }} />
      </div>

      <div className="card mt-6 p-5">
        <h2 className="section-title">Library Contents</h2>
        {stats ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500">
                <th className="py-1">Category</th>
                <th>Total</th>
                <th>Bundled (SRD)</th>
                <th>Synced</th>
                <th>Custom</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map((key) => (
                <tr key={key} className="border-t border-stone-200 dark:border-stone-800">
                  <td className="py-1.5 font-medium">{CATEGORY_LABELS[key]}</td>
                  <td>{stats[key].total}</td>
                  <td>{stats[key].srd}</td>
                  <td>{stats[key].remote}</td>
                  <td>{stats[key].custom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-stone-500">Loading…</p>
        )}
        <p className="mt-3 text-xs text-stone-500">Bundled data version: {stats?.bundledVersion}</p>
      </div>
    </div>
  );
}

const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'shield', 'gear', 'tool', 'consumable', 'magic', 'mount', 'treasure'];
const SPELL_SCHOOLS: SpellSchool[] = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];

function CreateCustomContent({ onSaved }: { onSaved: () => void }) {
  const [tab, setTab] = useState<'item' | 'spell' | 'feat'>('item');
  return (
    <div>
      <div className="mb-4 flex gap-1">
        {(['item', 'spell', 'feat'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? 'tab-btn-active' : 'tab-btn-inactive'}`}>
            {t === 'item' ? 'Item' : t === 'spell' ? 'Spell' : 'Feat'}
          </button>
        ))}
      </div>
      {tab === 'item' && <CustomItemForm onSaved={onSaved} />}
      {tab === 'spell' && <CustomSpellForm onSaved={onSaved} />}
      {tab === 'feat' && <CustomFeatForm onSaved={onSaved} />}
      <p className="mt-3 text-xs text-stone-400">
        Need a custom race, class, or background too? Those have too many moving parts for a quick form — use "Import
        Custom Compendium" above with a JSON file instead.
      </p>
    </div>
  );
}

function CustomItemForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ItemType>('gear');
  const [cost, setCost] = useState('');
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [damage, setDamage] = useState('');
  const [damageType, setDamageType] = useState('');
  const [weaponCategory, setWeaponCategory] = useState<'simple' | 'martial'>('simple');
  const [weaponProperties, setWeaponProperties] = useState('');
  const [armorClassBase, setArmorClassBase] = useState('');
  const [armorClassAddDex, setArmorClassAddDex] = useState(false);
  const [armorCategory, setArmorCategory] = useState<'light' | 'medium' | 'heavy'>('light');
  const [rarity, setRarity] = useState('');
  const [requiresAttunement, setRequiresAttunement] = useState(false);
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    const key = slugify(name);
    const entry: Record<string, unknown> = {
      name: name.trim(),
      type,
      cost: cost.trim() || undefined,
      weight: weight ? Number(weight) : undefined,
      description: description.trim() || undefined,
      source: book.trim() ? { book: book.trim(), page: page ? Number(page) : undefined } : undefined,
    };
    if (type === 'weapon') {
      entry.damage = damage.trim() || undefined;
      entry.damageType = damageType.trim() || undefined;
      entry.weaponCategory = weaponCategory;
      entry.weaponProperties = weaponProperties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (type === 'armor' || type === 'shield') {
      entry.armorClassBase = armorClassBase ? Number(armorClassBase) : undefined;
      entry.armorClassAddDex = type === 'armor' ? armorClassAddDex : undefined;
      entry.armorCategory = type === 'armor' ? armorCategory : undefined;
    }
    if (type === 'magic') {
      entry.rarity = rarity.trim() || undefined;
      entry.requiresAttunement = requiresAttunement;
    }
    await importCustomCompendium({ label: 'My Custom Content', items: { [key]: entry as never } });
    setSaved(`Saved "${name.trim()}" to your compendium.`);
    setName('');
    setCost('');
    setWeight('');
    setDescription('');
    setDamage('');
    setDamageType('');
    setWeaponProperties('');
    setArmorClassBase('');
    setRarity('');
    setBook('');
    setPage('');
    onSaved();
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Flametongue Dagger" />
      </div>
      <div>
        <label className="label">Type</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value as ItemType)}>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Cost</label>
        <input className="input" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="50 gp" />
      </div>
      <div>
        <label className="label">Weight (lb)</label>
        <input type="number" className="input" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </div>

      {type === 'weapon' && (
        <>
          <div>
            <label className="label">Damage</label>
            <input className="input" value={damage} onChange={(e) => setDamage(e.target.value)} placeholder="1d8" />
          </div>
          <div>
            <label className="label">Damage Type</label>
            <input className="input" value={damageType} onChange={(e) => setDamageType(e.target.value)} placeholder="fire" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={weaponCategory} onChange={(e) => setWeaponCategory(e.target.value as 'simple' | 'martial')}>
              <option value="simple">Simple</option>
              <option value="martial">Martial</option>
            </select>
          </div>
          <div>
            <label className="label">Properties (comma separated)</label>
            <input className="input" value={weaponProperties} onChange={(e) => setWeaponProperties(e.target.value)} placeholder="Finesse, Light" />
          </div>
        </>
      )}

      {(type === 'armor' || type === 'shield') && (
        <>
          <div>
            <label className="label">{type === 'shield' ? 'AC Bonus' : 'Base AC'}</label>
            <input type="number" className="input" value={armorClassBase} onChange={(e) => setArmorClassBase(e.target.value)} />
          </div>
          {type === 'armor' && (
            <>
              <div>
                <label className="label">Category</label>
                <select className="input" value={armorCategory} onChange={(e) => setArmorCategory(e.target.value as 'light' | 'medium' | 'heavy')}>
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="heavy">Heavy</option>
                </select>
              </div>
              <label className="mt-5 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={armorClassAddDex} onChange={(e) => setArmorClassAddDex(e.target.checked)} />
                Add Dexterity modifier to AC
              </label>
            </>
          )}
        </>
      )}

      {type === 'magic' && (
        <>
          <div>
            <label className="label">Rarity</label>
            <input className="input" value={rarity} onChange={(e) => setRarity(e.target.value)} placeholder="Rare" />
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requiresAttunement} onChange={(e) => setRequiresAttunement(e.target.checked)} />
            Requires attunement
          </label>
        </>
      )}

      <div className="sm:col-span-2">
        <label className="label">Description</label>
        <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label">Source Book (optional)</label>
        <input className="input" value={book} onChange={(e) => setBook(e.target.value)} placeholder="e.g. My Homebrew Pack" />
      </div>
      <div>
        <label className="label">Page (optional)</label>
        <input type="number" className="input" value={page} onChange={(e) => setPage(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
          Save Item
        </button>
        {saved && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">{saved}</span>}
      </div>
    </div>
  );
}

function CustomSpellForm({ onSaved }: { onSaved: () => void }) {
  const { compendium } = useCompendium();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [school, setSchool] = useState<SpellSchool>('Evocation');
  const [castingTime, setCastingTime] = useState('1 action');
  const [range, setRange] = useState('60 feet');
  const [components, setComponents] = useState('V, S');
  const [duration, setDuration] = useState('Instantaneous');
  const [concentration, setConcentration] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  function toggleClass(key: string) {
    setClasses((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSave() {
    if (!name.trim()) return;
    const key = slugify(name);
    await importCustomCompendium({
      label: 'My Custom Content',
      spells: {
        [key]: {
          name: name.trim(),
          level,
          school,
          castingTime,
          range,
          components,
          duration,
          concentration,
          ritual,
          classes,
          description,
          source: book.trim() ? { book: book.trim(), page: page ? Number(page) : undefined } : undefined,
        },
      },
    });
    setSaved(`Saved "${name.trim()}" to your compendium.`);
    setName('');
    setDescription('');
    setBook('');
    setPage('');
    onSaved();
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Stardust Bolt" />
      </div>
      <div>
        <label className="label">Level (0 = cantrip)</label>
        <input type="number" min={0} max={9} className="input" value={level} onChange={(e) => setLevel(Math.max(0, Math.min(9, Number(e.target.value) || 0)))} />
      </div>
      <div>
        <label className="label">School</label>
        <select className="input" value={school} onChange={(e) => setSchool(e.target.value as SpellSchool)}>
          {SPELL_SCHOOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Casting Time</label>
        <input className="input" value={castingTime} onChange={(e) => setCastingTime(e.target.value)} />
      </div>
      <div>
        <label className="label">Range</label>
        <input className="input" value={range} onChange={(e) => setRange(e.target.value)} />
      </div>
      <div>
        <label className="label">Components</label>
        <input className="input" value={components} onChange={(e) => setComponents(e.target.value)} />
      </div>
      <div>
        <label className="label">Duration</label>
        <input className="input" value={duration} onChange={(e) => setDuration(e.target.value)} />
      </div>
      <div className="flex items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={concentration} onChange={(e) => setConcentration(e.target.checked)} />
          Concentration
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ritual} onChange={(e) => setRitual(e.target.checked)} />
          Ritual
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Classes that can learn it</label>
        <div className="flex flex-wrap gap-2">
          {Object.values(compendium.classes)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <label key={c.key} className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={classes.includes(c.key)} onChange={() => toggleClass(c.key)} />
                {c.name}
              </label>
            ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Description</label>
        <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label">Source Book (optional)</label>
        <input className="input" value={book} onChange={(e) => setBook(e.target.value)} placeholder="e.g. My Homebrew Pack" />
      </div>
      <div>
        <label className="label">Page (optional)</label>
        <input type="number" className="input" value={page} onChange={(e) => setPage(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
          Save Spell
        </button>
        {saved && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">{saved}</span>}
      </div>
    </div>
  );
}

function CustomFeatForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [prerequisite, setPrerequisite] = useState('');
  const [description, setDescription] = useState('');
  const [book, setBook] = useState('');
  const [page, setPage] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    const key = slugify(name);
    await importCustomCompendium({
      label: 'My Custom Content',
      feats: {
        [key]: {
          name: name.trim(),
          prerequisite: prerequisite.trim() || undefined,
          description,
          source: book.trim() ? { book: book.trim(), page: page ? Number(page) : undefined } : undefined,
        },
      },
    });
    setSaved(`Saved "${name.trim()}" to your compendium.`);
    setName('');
    setPrerequisite('');
    setDescription('');
    setBook('');
    setPage('');
    onSaved();
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Starborn" />
      </div>
      <div>
        <label className="label">Prerequisite (optional)</label>
        <input className="input" value={prerequisite} onChange={(e) => setPrerequisite(e.target.value)} placeholder="The ability to cast at least one spell" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Source Book (optional)</label>
          <input className="input" value={book} onChange={(e) => setBook(e.target.value)} placeholder="e.g. My Homebrew Pack" />
        </div>
        <div>
          <label className="label">Page (optional)</label>
          <input type="number" className="input" value={page} onChange={(e) => setPage(e.target.value)} />
        </div>
      </div>
      <div>
        <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
          Save Feat
        </button>
        {saved && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">{saved}</span>}
      </div>
    </div>
  );
}
