import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCompendium } from '../store/useCompendium';
import { getCharacter, saveCharacter, deleteCharacter } from '../lib/characters';
import type { AbilityScores, Character, InventoryEntry } from '../types/character';
import { ABILITY_KEYS, ABILITY_NAMES, SKILLS } from '../types/compendium';
import type { SkillKey } from '../types/compendium';
import {
  getAbilityModifiers,
  getFinalAbilityScores,
  getArmorClass,
  getInitiative,
  getSpeed,
  getHitPointsMax,
  getHitDice,
  getProficiencyBonus,
  getSkillModifier,
  getSavingThrowModifier,
  getPassiveSkill,
  getSpellcastingClasses,
  getSpellSlots,
  getPactMagicSlots,
  getCarryingCapacity,
  formatModifier,
} from '../lib/calc';
import { generateCharacterSheetPdf } from '../lib/pdfExport';
import { characterToExportFile, downloadJson, slugFilename } from '../lib/jsonExport';
import { v4 as uuid } from 'uuid';

const TABS = ['Main', 'Combat', 'Spells', 'Inventory', 'Features', 'Bio'] as const;

export default function CharacterSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { compendium, loading } = useCompendium();
  const [character, setCharacter] = useState<Character | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Main');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCharacter(id).then((c) => setCharacter(c ?? null));
  }, [id]);

  async function update(patch: Partial<Character>) {
    setCharacter((c) => {
      if (!c) return c;
      const next = { ...c, ...patch };
      saveCharacter(next);
      return next;
    });
  }

  async function handleDelete() {
    if (!character) return;
    if (!confirm(`Delete "${character.name}"? This cannot be undone.`)) return;
    await deleteCharacter(character.id);
    navigate('/');
  }

  async function handleExportPdf() {
    if (!character) return;
    setExporting(true);
    try {
      const bytes = await generateCharacterSheetPdf(character, compendium);
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = slugFilename(character.name, 'pdf');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleExportJson() {
    if (!character) return;
    downloadJson(slugFilename(character.name, 'json'), characterToExportFile(character));
  }

  if (loading || !character) {
    return <p className="text-stone-500">Loading…</p>;
  }

  const mods = getAbilityModifiers(character, compendium);
  const scores = getFinalAbilityScores(character, compendium);
  const prof = getProficiencyBonus(character);
  const hpMax = getHitPointsMax(character, compendium);
  const race = compendium.races[character.race.key];
  const subrace = race?.subraces?.find((sr) => sr.key === character.race.subraceKey);
  const background = compendium.backgrounds[character.background];
  const classLine = character.classes
    .filter((c) => c.classKey)
    .map((c) => {
      const cls = compendium.classes[c.classKey];
      const subclass = cls?.subclasses.find((s) => s.key === c.subclassKey);
      return `${cls?.name ?? c.classKey}${subclass ? ` (${subclass.name})` : ''} ${c.level}`;
    })
    .join(' / ');

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{character.name}</h1>
          <p className="text-sm text-stone-500">
            {subrace ? `${race?.name} (${subrace.name})` : race?.name} • {classLine} • {background?.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/character/${character.id}/edit`} className="btn-secondary">
            Edit / Level Up
          </Link>
          <button className="btn-secondary" onClick={handleExportJson}>
            Export JSON
          </button>
          <button className="btn-primary" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? 'Generating…' : 'Export PDF'}
          </button>
          <button className="btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? 'tab-btn-active' : 'tab-btn-inactive'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {tab === 'Main' && (
          <MainTab character={character} update={update} compendium={compendium} mods={mods} scores={scores} prof={prof} />
        )}
        {tab === 'Combat' && (
          <CombatTab character={character} update={update} compendium={compendium} hpMax={hpMax} />
        )}
        {tab === 'Spells' && <SpellsTab character={character} update={update} compendium={compendium} />}
        {tab === 'Inventory' && <InventoryTab character={character} update={update} compendium={compendium} />}
        {tab === 'Features' && <FeaturesTab character={character} update={update} compendium={compendium} />}
        {tab === 'Bio' && <BioTab character={character} update={update} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MainTab({
  character,
  update,
  compendium,
  mods,
  scores,
  prof,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
  mods: AbilityScores;
  scores: AbilityScores;
  prof: number;
}) {
  function toggleSaveProf(ability: (typeof ABILITY_KEYS)[number]) {
    const has = character.savingThrowProficiencies.includes(ability);
    update({
      savingThrowProficiencies: has
        ? character.savingThrowProficiencies.filter((a) => a !== ability)
        : [...character.savingThrowProficiencies, ability],
    });
  }
  function toggleSkillProf(skill: SkillKey) {
    const has = character.skillProficiencies.includes(skill);
    update({
      skillProficiencies: has ? character.skillProficiencies.filter((s) => s !== skill) : [...character.skillProficiencies, skill],
      skillExpertise: has ? character.skillExpertise.filter((s) => s !== skill) : character.skillExpertise,
    });
  }
  function toggleExpertise(skill: SkillKey) {
    const has = character.skillExpertise.includes(skill);
    update({ skillExpertise: has ? character.skillExpertise.filter((s) => s !== skill) : [...character.skillExpertise, skill] });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div>
        <h3 className="section-title">Ability Scores</h3>
        <div className="grid grid-cols-3 gap-2">
          {ABILITY_KEYS.map((key) => (
            <div key={key} className="stat-box">
              <span className="text-xs font-semibold uppercase text-stone-500">{key}</span>
              <span className="text-xl font-bold">{scores[key]}</span>
              <span className="text-sm text-stone-500">{formatModifier(mods[key])}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-stone-300 p-3 dark:border-stone-700">
          <p className="text-sm">
            Proficiency Bonus: <strong>{formatModifier(prof)}</strong>
          </p>
        </div>
      </div>

      <div>
        <h3 className="section-title">Saving Throws</h3>
        <div className="space-y-1">
          {ABILITY_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={character.savingThrowProficiencies.includes(key)} onChange={() => toggleSaveProf(key)} />
              <span className="w-24">{ABILITY_NAMES[key]}</span>
              <span className="font-semibold">{formatModifier(getSavingThrowModifier(character, compendium, key))}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="section-title">Skills</h3>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {(Object.keys(SKILLS) as SkillKey[]).map((skill) => (
            <div key={skill} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={character.skillProficiencies.includes(skill)} onChange={() => toggleSkillProf(skill)} />
              <input
                type="checkbox"
                title="Expertise"
                checked={character.skillExpertise.includes(skill)}
                disabled={!character.skillProficiencies.includes(skill)}
                onChange={() => toggleExpertise(skill)}
              />
              <span className="flex-1">{SKILLS[skill].name}</span>
              <span className="font-semibold">{formatModifier(getSkillModifier(character, compendium, skill))}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">First checkbox = proficient, second = expertise.</p>
        <p className="mt-1 text-sm">Passive Perception: <strong>{getPassiveSkill(character, compendium, 'perception')}</strong></p>
      </div>
    </div>
  );
}

function CombatTab({
  character,
  update,
  compendium,
  hpMax,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
  hpMax: number;
}) {
  const [damageAmount, setDamageAmount] = useState(0);
  const hitDice = getHitDice(character, compendium);
  const carry = getCarryingCapacity(character, compendium);

  function applyDamage() {
    let temp = character.hpTemp;
    let current = character.hpCurrent;
    let remaining = damageAmount;
    if (temp > 0) {
      const absorbed = Math.min(temp, remaining);
      temp -= absorbed;
      remaining -= absorbed;
    }
    current = Math.max(0, current - remaining);
    update({ hpCurrent: current, hpTemp: temp });
  }
  function applyHeal() {
    update({ hpCurrent: Math.min(hpMax, character.hpCurrent + damageAmount) });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-3">
        <h3 className="section-title">Vitals</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="stat-box">
            <span className="text-xs uppercase text-stone-500">AC</span>
            <span className="text-xl font-bold">{getArmorClass(character, compendium)}</span>
          </div>
          <div className="stat-box">
            <span className="text-xs uppercase text-stone-500">Initiative</span>
            <span className="text-xl font-bold">{formatModifier(getInitiative(character, compendium))}</span>
          </div>
          <div className="stat-box">
            <span className="text-xs uppercase text-stone-500">Speed</span>
            <span className="text-xl font-bold">{getSpeed(character, compendium)}</span>
          </div>
        </div>
        <div>
          <label className="label">AC Override (optional)</label>
          <input
            type="number"
            className="input"
            value={character.acOverride ?? ''}
            placeholder="Auto"
            onChange={(e) => update({ acOverride: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="section-title">Hit Points</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <label className="label">Current</label>
            <input
              type="number"
              className="input"
              value={character.hpCurrent}
              onChange={(e) => update({ hpCurrent: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="label">Max</label>
            <input className="input" value={hpMax} readOnly />
          </div>
          <div>
            <label className="label">Temp</label>
            <input
              type="number"
              className="input"
              value={character.hpTemp}
              onChange={(e) => update({ hpTemp: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Amount</label>
            <input type="number" className="input" value={damageAmount} onChange={(e) => setDamageAmount(Number(e.target.value) || 0)} />
          </div>
          <button className="btn-danger" onClick={applyDamage}>
            Damage
          </button>
          <button className="btn-primary" onClick={applyHeal}>
            Heal
          </button>
        </div>
        <div>
          <label className="label">HP Max Override (optional)</label>
          <input
            type="number"
            className="input"
            value={character.hpMaxOverride ?? ''}
            placeholder="Auto"
            onChange={(e) => update({ hpMaxOverride: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </div>
        <p className="text-sm text-stone-500">Hit Dice: {hitDice.map((hd) => `${hd.count - character.hitDiceUsed > 0 ? hd.count : 0}d${hd.die}`).join(' + ')}</p>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => update({ hitDiceUsed: Math.max(0, character.hitDiceUsed - 1) })}>
            Regain Hit Die
          </button>
          <button className="btn-secondary" onClick={() => update({ hitDiceUsed: character.hitDiceUsed + 1 })}>
            Spend Hit Die
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="section-title">Death Saves &amp; Status</h3>
        <div className="flex gap-4">
          <div>
            <span className="label">Successes</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  type="checkbox"
                  checked={i < character.deathSaves.successes}
                  onChange={() =>
                    update({ deathSaves: { ...character.deathSaves, successes: i < character.deathSaves.successes ? i : i + 1 } })
                  }
                />
              ))}
            </div>
          </div>
          <div>
            <span className="label">Failures</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  type="checkbox"
                  checked={i < character.deathSaves.failures}
                  onChange={() =>
                    update({ deathSaves: { ...character.deathSaves, failures: i < character.deathSaves.failures ? i : i + 1 } })
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={character.inspiration} onChange={() => update({ inspiration: !character.inspiration })} />
          Inspiration
        </label>
        <div>
          <label className="label">Exhaustion Level (0-6)</label>
          <input
            type="number"
            min={0}
            max={6}
            className="input"
            value={character.exhaustion}
            onChange={(e) => update({ exhaustion: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })}
          />
        </div>
        <div>
          <label className="label">Conditions (comma separated)</label>
          <input
            className="input"
            value={character.conditions.join(', ')}
            onChange={(e) => update({ conditions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
        <p className="text-xs text-stone-500">
          Carrying Capacity: {carry.carryCapacity} lb • Encumbered at {carry.encumbered} lb
        </p>
      </div>
    </div>
  );
}

function SpellsTab({
  character,
  update,
  compendium,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
}) {
  const spellcasting = getSpellcastingClasses(character, compendium);
  const slots = getSpellSlots(character, compendium);
  const pact = getPactMagicSlots(character, compendium);

  if (spellcasting.length === 0) {
    return <p className="text-stone-500">This character has no spellcasting classes.</p>;
  }

  function setSlotUsed(level: number, used: number) {
    update({ spellSlotsUsed: { ...character.spellSlotsUsed, [level]: Math.max(0, used) } });
  }

  const known = character.spellsKnown.map((k) => compendium.spells[k]).filter(Boolean);
  const byLevel = new Map<number, typeof known>();
  for (const sp of known) byLevel.set(sp.level, [...(byLevel.get(sp.level) ?? []), sp]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        {spellcasting.map((sc) => (
          <div key={sc.classKey} className="stat-box px-4">
            <span className="text-xs uppercase text-stone-500">{compendium.classes[sc.classKey]?.name}</span>
            <span className="text-sm">Save DC {sc.saveDC}</span>
            <span className="text-sm">Attack {formatModifier(sc.attackBonus)}</span>
          </div>
        ))}
      </div>

      {slots.length > 0 && (
        <div className="mb-4">
          <h3 className="section-title">Spell Slots</h3>
          <div className="flex flex-wrap gap-3">
            {slots.map((total, i) => {
              const level = i + 1;
              if (!total) return null;
              const used = character.spellSlotsUsed[level] ?? 0;
              return (
                <div key={level} className="stat-box px-3">
                  <span className="text-xs uppercase text-stone-500">Level {level}</span>
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost px-2" onClick={() => setSlotUsed(level, used - 1)}>
                      −
                    </button>
                    <span>
                      {total - used}/{total}
                    </span>
                    <button className="btn-ghost px-2" onClick={() => setSlotUsed(level, used + 1)}>
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pact && (
        <div className="mb-4">
          <h3 className="section-title">Pact Magic</h3>
          <div className="stat-box inline-flex px-3">
            <span className="text-xs uppercase text-stone-500">Level {pact.slotLevel} Slots</span>
            <div className="flex items-center gap-1">
              <button className="btn-ghost px-2" onClick={() => update({ pactSlotsUsed: Math.max(0, character.pactSlotsUsed - 1) })}>
                −
              </button>
              <span>
                {pact.slots - character.pactSlotsUsed}/{pact.slots}
              </span>
              <button className="btn-ghost px-2" onClick={() => update({ pactSlotsUsed: character.pactSlotsUsed + 1 })}>
                +
              </button>
            </div>
          </div>
        </div>
      )}

      <h3 className="section-title">Known Spells</h3>
      <div className="space-y-3">
        {[...byLevel.keys()]
          .sort((a, b) => a - b)
          .map((level) => (
            <div key={level}>
              <p className="mb-1 text-sm font-bold">{level === 0 ? 'Cantrips' : `Level ${level}`}</p>
              <div className="space-y-1">
                {byLevel.get(level)!.map((sp) => (
                  <label key={sp.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={character.spellsPrepared.includes(sp.key)}
                      onChange={() =>
                        update({
                          spellsPrepared: character.spellsPrepared.includes(sp.key)
                            ? character.spellsPrepared.filter((k) => k !== sp.key)
                            : [...character.spellsPrepared, sp.key],
                        })
                      }
                    />
                    <span className="font-medium">{sp.name}</span>
                    <span className="text-xs text-stone-500">{sp.concentration ? 'Concentration' : ''}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function InventoryTab({
  character,
  update,
  compendium,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
}) {
  function patchItem(id: string, patch: Partial<InventoryEntry>) {
    update({ inventory: character.inventory.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  }
  function removeItem(id: string) {
    update({ inventory: character.inventory.filter((i) => i.id !== id) });
  }
  function addItem(itemKey: string) {
    if (!itemKey) return;
    update({ inventory: [...character.inventory, { id: uuid(), itemKey, quantity: 1, equipped: false, attuned: false }] });
  }

  const totalWeight = character.inventory.reduce((sum, inv) => {
    const item = inv.itemKey ? compendium.items[inv.itemKey] : undefined;
    return sum + (item?.weight ?? 0) * inv.quantity;
  }, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="label">Add Item</label>
          <select className="input" value="" onChange={(e) => addItem(e.target.value)}>
            <option value="">Choose an item…</option>
            {Object.values(compendium.items)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name}
                </option>
              ))}
          </select>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((c) => (
            <div key={c}>
              <label className="label">{c.toUpperCase()}</label>
              <input
                type="number"
                className="input w-16"
                value={character.currency[c]}
                onChange={(e) => update({ currency: { ...character.currency, [c]: Number(e.target.value) || 0 } })}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="mb-2 text-sm text-stone-500">Total weight: {totalWeight} lb</p>

      <div className="space-y-1">
        {character.inventory.map((inv) => {
          const item = inv.itemKey ? compendium.items[inv.itemKey] : undefined;
          return (
            <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 px-2 py-1.5 text-sm dark:border-stone-700">
              <span className="min-w-40 flex-1 font-medium">{item?.name ?? inv.customName}</span>
              {item?.type && <span className="text-xs text-stone-500">{item.type}</span>}
              <input
                type="number"
                min={1}
                className="input w-16"
                value={inv.quantity}
                onChange={(e) => patchItem(inv.id, { quantity: Number(e.target.value) || 1 })}
              />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={inv.equipped} onChange={() => patchItem(inv.id, { equipped: !inv.equipped })} />
                Equipped
              </label>
              {item?.requiresAttunement && (
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={inv.attuned} onChange={() => patchItem(inv.id, { attuned: !inv.attuned })} />
                  Attuned
                </label>
              )}
              <button className="btn-danger" onClick={() => removeItem(inv.id)}>
                Remove
              </button>
            </div>
          );
        })}
        {character.inventory.length === 0 && <p className="text-stone-500">No items yet.</p>}
      </div>
    </div>
  );
}

function FeaturesTab({
  character,
  update,
  compendium,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
}) {
  function addCustomFeature() {
    update({ customFeatures: [...character.customFeatures, { id: uuid(), name: 'New Feature', description: '' }] });
  }
  function patchFeature(id: string, patch: Partial<Character['customFeatures'][number]>) {
    update({ customFeatures: character.customFeatures.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  }
  function removeFeature(id: string) {
    update({ customFeatures: character.customFeatures.filter((f) => f.id !== id) });
  }

  const race = compendium.races[character.race.key];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="section-title">Class &amp; Race Features</h3>
        <div className="space-y-2 text-sm">
          {character.classes.map((cl) => {
            const cls = compendium.classes[cl.classKey];
            if (!cls) return null;
            const subclass = cls.subclasses.find((s) => s.key === cl.subclassKey);
            return (
              <div key={cl.classKey}>
                {cls.features
                  .filter((f) => f.level <= cl.level)
                  .map((f) => (
                    <p key={f.name}>
                      <strong>
                        {f.name} ({cls.name} {f.level})
                      </strong>
                      : <span className="text-stone-500">{f.description}</span>
                    </p>
                  ))}
                {subclass?.features
                  .filter((f) => f.level <= cl.level)
                  .map((f) => (
                    <p key={f.name}>
                      <strong>
                        {f.name} ({subclass.name} {f.level})
                      </strong>
                    </p>
                  ))}
              </div>
            );
          })}
          {race?.traits.map((t) => (
            <p key={t.name}>
              <strong>{t.name}</strong>: <span className="text-stone-500">{t.description}</span>
            </p>
          ))}
        </div>
      </div>

      <div>
        <h3 className="section-title">Custom Features</h3>
        <div className="space-y-2">
          {character.customFeatures.map((f) => (
            <div key={f.id} className="rounded-lg border border-stone-300 p-2 dark:border-stone-700">
              <input
                className="input mb-1 font-semibold"
                value={f.name}
                onChange={(e) => patchFeature(f.id, { name: e.target.value })}
              />
              <textarea
                className="input"
                rows={2}
                value={f.description}
                onChange={(e) => patchFeature(f.id, { description: e.target.value })}
              />
              <button className="btn-danger mt-1" onClick={() => removeFeature(f.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button className="btn-secondary mt-2" onClick={addCustomFeature}>
          + Add Custom Feature
        </button>

        <h3 className="section-title mt-6">Feats</h3>
        <select
          className="input"
          value=""
          onChange={(e) => e.target.value && update({ feats: [...character.feats, e.target.value] })}
        >
          <option value="">Add a feat…</option>
          {Object.values(compendium.feats)
            .filter((f) => !character.feats.includes(f.key))
            .map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
        </select>
        <div className="mt-2 space-y-1">
          {character.feats.map((key) => {
            const feat = compendium.feats[key];
            if (!feat) return null;
            return (
              <div key={key} className="rounded-lg border border-stone-300 p-2 text-sm dark:border-stone-700">
                <div className="flex items-center justify-between">
                  <strong>{feat.name}</strong>
                  <button className="btn-danger" onClick={() => update({ feats: character.feats.filter((k) => k !== key) })}>
                    Remove
                  </button>
                </div>
                <p className="text-stone-500">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BioTab({ character, update }: { character: Character; update: (p: Partial<Character>) => void }) {
  const fields: [keyof Character, string][] = [
    ['personalityTraits', 'Personality Traits'],
    ['ideals', 'Ideals'],
    ['bonds', 'Bonds'],
    ['flaws', 'Flaws'],
    ['appearance', 'Appearance'],
    ['backstory', 'Backstory'],
    ['notes', 'Notes'],
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map(([key, label]) => (
        <div key={key} className={key === 'backstory' || key === 'notes' ? 'sm:col-span-2' : ''}>
          <label className="label">{label}</label>
          <textarea
            className="input"
            rows={key === 'backstory' || key === 'notes' ? 6 : 3}
            value={(character[key] as string) ?? ''}
            onChange={(e) => update({ [key]: e.target.value } as Partial<Character>)}
          />
        </div>
      ))}
    </div>
  );
}
