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

type Stats = Awaited<ReturnType<typeof getCompendiumStats>>;

const CATEGORY_LABELS: Record<keyof Omit<Stats, 'bundledVersion'>, string> = {
  races: 'Races',
  classes: 'Classes',
  backgrounds: 'Backgrounds',
  feats: 'Feats',
  spells: 'Spells',
  items: 'Items & Equipment',
};

export default function CompendiumManager() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastSync, setLastSync] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
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
    try {
      const result = await syncCompendiumFromInternet((p) => setProgress(p));
      bump();
      await refresh();
      if (result.errors.length) {
        alert(`Sync finished with ${result.errors.length} warning(s). ${result.errors.slice(0, 3).join(' | ')}`);
      }
    } catch (err) {
      alert(
        `Couldn’t reach the internet compendium source (dnd5eapi.co). This is expected if this device is offline or the network blocks it. Error: ${(err as Error).message}`,
      );
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
          {progress && (
            <p className="mt-2 text-xs text-stone-500">
              {progress.stage} ({progress.fetched} fetched)
            </p>
          )}
          {lastSync && <p className="mt-2 text-xs text-stone-500">Last synced: {new Date(lastSync).toLocaleString()}</p>}
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
