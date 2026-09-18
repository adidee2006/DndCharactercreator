import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { deleteCharacter, duplicateCharacter, importCharacterFromJson } from '../lib/characters';
import { parseCharacterImport } from '../lib/jsonExport';
import { useCompendium } from '../store/useCompendium';
import { getTotalLevel, getHitPointsMax, getArmorClass } from '../lib/calc';

export default function Dashboard() {
  const characters = useLiveQuery(() => db.characters.orderBy('updatedAt').reverse().toArray(), []);
  const { compendium, loading } = useCompendium();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const character = await importCharacterFromJson(parseCharacterImport(json));
      navigate(`/character/${character.id}`);
    } catch (err) {
      alert(`Couldn't import that file: ${(err as Error).message}`);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteCharacter(id);
  }

  if (!characters || loading) {
    return <p className="text-stone-500">Loading your characters…</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Characters</h1>
          <p className="text-sm text-stone-500">
            {characters.length} character{characters.length === 1 ? '' : 's'} stored locally in this browser.
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <Link to="/new" className="btn-primary">
            + New Character
          </Link>
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="mb-4 text-stone-500">You haven’t created any characters yet.</p>
          <Link to="/new" className="btn-primary">
            Create your first character
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => {
            const classLine = c.classes
              .filter((cl) => cl.classKey)
              .map((cl) => compendium.classes[cl.classKey]?.name ?? cl.classKey)
              .join(' / ');
            const race = compendium.races[c.race.key]?.name;
            return (
              <div
                key={c.id}
                className="card group flex flex-col justify-between overflow-hidden p-4 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="-mx-4 -mt-4 mb-3 h-1 bg-gradient-to-r from-red-700 via-red-500 to-amber-500 opacity-80" />
                <Link to={`/character/${c.id}`}>
                  <h2 className="text-lg font-bold transition-colors group-hover:text-red-800 dark:group-hover:text-red-400">
                    {c.name}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="pill">{race ?? 'No race'}</span>
                    {classLine && <span className="pill">{classLine}</span>}
                    <span className="pill">Lvl {getTotalLevel(c)}</span>
                  </div>
                  <p className="mt-2 text-xs text-stone-400">
                    AC {getArmorClass(c, compendium)} • HP {getHitPointsMax(c, compendium)}
                  </p>
                </Link>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/character/${c.id}`} className="btn-secondary">
                    Open
                  </Link>
                  <Link to={`/character/${c.id}/edit`} className="btn-ghost">
                    Edit
                  </Link>
                  <button className="btn-ghost" onClick={() => duplicateCharacter(c.id)}>
                    Duplicate
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(c.id, c.name)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
