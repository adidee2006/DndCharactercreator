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
  getExhaustionPenalty,
  getWeaponAttacks,
  getClassResources,
  isVersatileWeapon,
  getVersatileDamage,
} from '../lib/calc';
import { toggleInventoryEquipped, setInventoryTwoHanded } from '../lib/equipment';
import { knownConditionEffect, CONDITION_NAMES } from '../data/conditions';
import { generateCharacterSheetPdf } from '../lib/pdfExport';
import { characterToExportFile, downloadJson, slugFilename } from '../lib/jsonExport';
import { totalValueInGp, autoExchange, formatGp, parseMoneyItem } from '../lib/currency';
import { itemDescription } from '../lib/itemSummary';
import { sourceCitation } from '../lib/sourceCitation';
import { isProficientWithItem, isEligibleForFeat, getMaxAvailableSpellLevel, getSpellCounts, getSubclassBonusSpells } from '../lib/eligibility';
import { availableFightingStyles, fightingStylesByKey } from '../data/srd/fightingStyles';
import { SearchableSelect } from '../components/SearchableSelect';
import { MultiSelectChips } from '../components/MultiSelectChips';
import { v4 as uuid } from 'uuid';

const TABS = ['Main', 'Combat', 'Spells', 'Inventory', 'Features', 'Bio'] as const;

/** A visual HP bar (green → amber → red as HP drops), with a temp-HP badge alongside it. */
function HealthBar({ current, max, temp }: { current: number; max: number; temp: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const color = pct <= 25 ? 'bg-red-600' : pct <= 50 ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white [text-shadow:0_1px_2px_rgb(0_0_0_/_0.6)]">
          {current} / {max}
        </span>
      </div>
      {temp > 0 && (
        <span className="whitespace-nowrap rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          +{temp} temp
        </span>
      )}
    </div>
  );
}

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
          <Link to={`/character/${character.id}/level-up`} className="btn-primary">
            ⬆︎ Level Up
          </Link>
          <Link to={`/character/${character.id}/edit`} className="btn-secondary">
            Edit
          </Link>
          <button className="btn-secondary" onClick={handleExportJson}>
            Export JSON
          </button>
          <button className="btn-secondary" onClick={handleExportPdf} disabled={exporting}>
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
  const totalHitDice = hitDice.reduce((sum, hd) => sum + hd.count, 0);
  const hitDiceRemaining = Math.max(0, totalHitDice - character.hitDiceUsed);
  const mods = getAbilityModifiers(character, compendium);
  const [hitDiceToSpend, setHitDiceToSpend] = useState(1);

  function takeShortRest() {
    const spend = Math.max(0, Math.min(hitDiceToSpend, hitDiceRemaining));
    // Average roll per die (rounded up) + Constitution modifier, floored at 0 per die spent.
    // hitDiceUsed is a flat count rather than per-die-size, so this uses the character's
    // first (most common) hit die as the representative size for multiclass characters.
    const primaryDie = hitDice[0]?.die ?? 8;
    const perDie = Math.max(0, Math.ceil((primaryDie + 1) / 2) + mods.con);
    const healed = perDie * spend;
    const resourcesUsed = { ...(character.resourcesUsed ?? {}) };
    for (const res of getClassResources(character, compendium)) {
      if (res.reset === 'short') resourcesUsed[res.key] = 0;
      else if (res.reset === 'short-partial') resourcesUsed[res.key] = Math.max(0, (resourcesUsed[res.key] ?? 0) - 1);
    }
    update({
      hitDiceUsed: character.hitDiceUsed + spend,
      hpCurrent: Math.min(hpMax, character.hpCurrent + healed),
      pactSlotsUsed: 0,
      resourcesUsed,
    });
  }

  function takeLongRest() {
    const recoveredDice = Math.max(1, Math.floor(totalHitDice / 2));
    update({
      hpCurrent: hpMax,
      hpTemp: 0,
      spellSlotsUsed: {},
      pactSlotsUsed: 0,
      hitDiceUsed: Math.max(0, character.hitDiceUsed - recoveredDice),
      exhaustion: Math.max(0, character.exhaustion - 1),
      deathSaves: { successes: 0, failures: 0 },
      resourcesUsed: {},
    });
  }

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

  const weaponAttacks = getWeaponAttacks(character, compendium);
  const classResources = getClassResources(character, compendium);

  function setResourceUsed(key: string, used: number, max: number) {
    update({ resourcesUsed: { ...(character.resourcesUsed ?? {}), [key]: Math.min(max, Math.max(0, used)) } });
  }

  return (
    <div className="space-y-6">
      {classResources.length > 0 && (
        <div>
          <h3 className="section-title">Resources</h3>
          <p className="mb-2 text-xs text-stone-500">
            Channel Divinity, Rage, Lay on Hands, and other limited-use class features — spend/restore uses here, or let
            Short/Long Rest reset them automatically.
          </p>
          <div className="flex flex-wrap gap-3">
            {classResources.map((res) => (
              <div key={`${res.classKey}-${res.key}`} className="stat-box px-3">
                <span className="text-xs uppercase text-stone-500">{res.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    className="stepper-btn"
                    title="Spend a use"
                    disabled={res.used >= res.max}
                    onClick={() => setResourceUsed(res.key, res.used + 1, res.max)}
                  >
                    −
                  </button>
                  <span className="w-12 text-center tabular-nums">
                    {res.max - res.used}/{res.max}
                  </span>
                  <button
                    className="stepper-btn"
                    title="Restore a use"
                    disabled={res.used <= 0}
                    onClick={() => setResourceUsed(res.key, res.used - 1, res.max)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {weaponAttacks.length > 0 && (
        <div>
          <h3 className="section-title">Attacks</h3>
          <p className="mb-2 text-xs text-stone-500">
            {character.inventory.some((inv) => inv.equipped && compendium.items[inv.itemKey ?? '']?.type === 'weapon')
              ? 'Equipped weapons.'
              : 'No weapons marked Equipped in Inventory — showing everything you’re carrying instead.'}
          </p>
          <div className="overflow-x-auto rounded-lg border border-stone-300 dark:border-stone-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left text-xs uppercase text-stone-500 dark:border-stone-700">
                  <th className="px-3 py-2">Weapon</th>
                  <th className="px-3 py-2">Attack Bonus</th>
                  <th className="px-3 py-2">Damage / Type</th>
                </tr>
              </thead>
              <tbody>
                {weaponAttacks.map((wa) => (
                  <tr key={wa.item.key} className="border-b border-stone-200 last:border-0 dark:border-stone-800">
                    <td className="px-3 py-1.5 font-medium">{wa.item.name}</td>
                    <td className="px-3 py-1.5">{formatModifier(wa.attackBonus)}</td>
                    <td className="px-3 py-1.5">{wa.damageText || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
        <div>
          <label className="label">Fighting Style</label>
          <select
            className="input"
            value={character.fightingStyle ?? ''}
            onChange={(e) => update({ fightingStyle: e.target.value || undefined })}
          >
            <option value="">None</option>
            {Array.from(
              new Map(character.classes.flatMap((cl) => availableFightingStyles(cl.classKey)).map((fs) => [fs.key, fs])).values(),
            ).map((fs) => (
              <option key={fs.key} value={fs.key}>
                {fs.name}
              </option>
            ))}
          </select>
          {character.fightingStyle && (
            <p className="mt-1 text-xs text-stone-500">{fightingStylesByKey[character.fightingStyle]?.description}</p>
          )}
        </div>
        {character.fightingStyle && fightingStylesByKey[character.fightingStyle]?.grantsCantripsFrom && (
          <FightingStyleCantripPicker character={character} update={update} compendium={compendium} />
        )}
        {(() => {
          const grantEntry = character.classes
            .map((cl) => ({ cl, subclass: compendium.classes[cl.classKey]?.subclasses.find((s) => s.key === cl.subclassKey) }))
            .find(({ cl, subclass }) => subclass?.grantsSecondFightingStyle && cl.level >= subclass.grantsSecondFightingStyle);
          if (!grantEntry) return null;
          const options = availableFightingStyles(grantEntry.cl.classKey);
          return (
            <div>
              <label className="label">Second Fighting Style ({grantEntry.subclass!.name})</label>
              <select
                className="input"
                value={character.secondFightingStyle ?? ''}
                onChange={(e) => update({ secondFightingStyle: e.target.value || undefined })}
              >
                <option value="">None</option>
                {options
                  .filter((fs) => fs.key !== character.fightingStyle)
                  .map((fs) => (
                    <option key={fs.key} value={fs.key}>
                      {fs.name}
                    </option>
                  ))}
              </select>
              {character.secondFightingStyle && (
                <p className="mt-1 text-xs text-stone-500">{fightingStylesByKey[character.secondFightingStyle]?.description}</p>
              )}
            </div>
          );
        })()}
      </div>

      <div className="space-y-3">
        <h3 className="section-title">Hit Points</h3>
        <HealthBar current={character.hpCurrent} max={hpMax} temp={character.hpTemp} />
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

        <div className="money-card">
          <h3 className="section-title mb-2">Rest</h3>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-sm text-stone-500">Spend</label>
            <input
              type="number"
              min={1}
              max={Math.max(1, hitDiceRemaining)}
              className="coin-input"
              value={hitDiceToSpend}
              onChange={(e) => setHitDiceToSpend(Math.max(1, Number(e.target.value) || 1))}
            />
            <label className="text-sm text-stone-500">hit {hitDiceToSpend === 1 ? 'die' : 'dice'} to heal</label>
            <button className="btn-secondary" onClick={takeShortRest} disabled={hitDiceRemaining === 0}>
              Take Short Rest
            </button>
          </div>
          <button className="btn-primary" onClick={takeLongRest}>
            Take Long Rest
          </button>
          <p className="mt-2 text-xs text-stone-500">
            Short rest: heals average roll per hit die spent + Con modifier, and restores pact magic slots. Long rest:
            restores HP and all spell slots, clears temp HP, recovers half your hit dice (min 1), reduces exhaustion
            by 1, and resets death saves.
          </p>
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
          <label className="label">Conditions</label>
          <MultiSelectChips
            options={CONDITION_NAMES}
            values={character.conditions}
            onChange={(conditions) => update({ conditions })}
            placeholder="Add conditions…"
          />
        </div>
        {(character.exhaustion > 0 || character.conditions.length > 0) && (
          <div className="rounded-lg border border-stone-300 p-3 text-xs dark:border-stone-700">
            <p className="mb-1.5 font-semibold text-stone-600 dark:text-stone-300">Active Effects</p>
            <ul className="space-y-1.5">
              {character.exhaustion > 0 && (
                <li>
                  <strong>Exhaustion ({character.exhaustion}).</strong>{' '}
                  <span className="text-stone-500">
                    {formatModifier(getExhaustionPenalty(character))} to ability checks, attack rolls, and saving throws; speed
                    reduced by {5 * character.exhaustion} ft — both already applied above.
                    {character.exhaustion >= 6 ? ' At level 6 you die.' : ''}
                  </span>
                </li>
              )}
              {character.conditions.map((c) => {
                const effect = knownConditionEffect(c);
                return (
                  <li key={c}>
                    <strong>{c}.</strong>{' '}
                    <span className="text-stone-500">
                      {effect ?? 'Not a recognized condition name — no rules reminder available, but it’s still noted above.'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="text-xs text-stone-500">
          Carrying Capacity: {carry.carryCapacity} lb • Encumbered at {carry.encumbered} lb
        </p>
      </div>
      </div>
    </div>
  );
}

function FightingStyleCantripPicker({
  character,
  update,
  compendium,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
}) {
  const style = fightingStylesByKey[character.fightingStyle!];
  const grantClass = style.grantsCantripsFrom!;
  const options = Object.values(compendium.spells)
    .filter((sp) => sp.level === 0 && sp.classes.includes(grantClass))
    .sort((a, b) => a.name.localeCompare(b.name));
  const current = character.fightingStyleCantrips ?? [];

  function setChoice(index: 0 | 1, key: string) {
    const next = [current[0] ?? '', current[1] ?? ''];
    next[index] = key;
    const cleaned = next.filter(Boolean);
    const spellsKnown = new Set(character.spellsKnown);
    for (const old of current) if (old && !cleaned.includes(old)) spellsKnown.delete(old);
    for (const k of cleaned) spellsKnown.add(k);
    update({ fightingStyleCantrips: cleaned, spellsKnown: [...spellsKnown] });
  }

  return (
    <div className="rounded-lg border border-stone-300 p-3 dark:border-stone-700">
      <label className="label">
        {style.name} Cantrips ({compendium.classes[grantClass]?.name ?? grantClass} list)
      </label>
      <p className="mt-1 text-xs text-stone-500">
        Choose 2 cantrips from the {compendium.classes[grantClass]?.name ?? grantClass} spell list. They're added to your
        known spells below.
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {([0, 1] as const).map((i) => (
          <select key={i} className="input" value={current[i] ?? ''} onChange={(e) => setChoice(i, e.target.value)}>
            <option value="">Choose…</option>
            {options.map((sp) => (
              <option key={sp.key} value={sp.key} disabled={current.includes(sp.key) && current[i] !== sp.key}>
                {sp.name}
              </option>
            ))}
          </select>
        ))}
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAllLevels, setShowAllLevels] = useState(false);
  const [showAnyClass, setShowAnyClass] = useState(false);

  if (spellcasting.length === 0) {
    return <p className="text-stone-500">This character has no spellcasting classes.</p>;
  }

  function setSlotUsed(level: number, used: number, total: number) {
    update({ spellSlotsUsed: { ...character.spellSlotsUsed, [level]: Math.min(total, Math.max(0, used)) } });
  }

  const known = character.spellsKnown.map((k) => compendium.spells[k]).filter(Boolean);
  const byLevel = new Map<number, typeof known>();
  for (const sp of known) byLevel.set(sp.level, [...(byLevel.get(sp.level) ?? []), sp]);

  const bonusSpells = getSubclassBonusSpells(character, compendium)
    .map((k) => compendium.spells[k])
    .filter(Boolean)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const classKeys = character.classes.map((c) => c.classKey);
  const { maxLevel } = getMaxAvailableSpellLevel(character, compendium);
  const { cantripLimit, spellLimit } = getSpellCounts(character, compendium);
  const cantripsUsed = known.filter((sp) => sp.level === 0).length;
  const spellsUsed = known.filter((sp) => sp.level > 0).length;
  const learnableSpells = Object.values(compendium.spells)
    .filter((sp) => showAnyClass || sp.classes.some((c) => classKeys.includes(c)))
    .filter((sp) => !character.spellsKnown.includes(sp.key))
    .filter((sp) => showAllLevels || sp.level === 0 || sp.level <= maxLevel)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  function learnSpell(key: string) {
    if (!key) return;
    update({ spellsKnown: [...character.spellsKnown, key] });
  }

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

      <div className="money-card mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title mb-0">Learn a New Spell</h3>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1 text-xs text-stone-500">
              <input type="checkbox" checked={showAllLevels} onChange={(e) => setShowAllLevels(e.target.checked)} />
              Show levels above what I can cast yet
            </label>
            <label className="flex items-center gap-1 text-xs text-stone-500">
              <input type="checkbox" checked={showAnyClass} onChange={(e) => setShowAnyClass(e.target.checked)} />
              Show spells from any class
            </label>
          </div>
        </div>
        <SearchableSelect
          placeholder="Search spells to add…"
          onSelect={learnSpell}
          options={learnableSpells.map((sp) => ({
            value: sp.key,
            label:
              `${sp.name} (${sp.level === 0 ? 'Cantrip' : `Lv ${sp.level}`})` +
              (showAnyClass && !sp.classes.some((c) => classKeys.includes(c))
                ? ` — ${sp.classes.map((c) => compendium.classes[c]?.name ?? c).join('/')}`
                : ''),
          }))}
        />
        {showAnyClass && (
          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
            Homebrew/off-list spells are included here for flexibility — your DM may not allow spells outside your
            class's list.
          </p>
        )}
        <p className="mt-1.5 text-xs text-stone-500">
          <span className={cantripsUsed > cantripLimit ? 'font-semibold text-red-700 dark:text-red-400' : ''}>
            Cantrips known: {cantripsUsed}/{cantripLimit}
          </span>
          {'  •  '}
          <span className={spellsUsed > spellLimit ? 'font-semibold text-red-700 dark:text-red-400' : ''}>
            Spells known: {spellsUsed}/{spellLimit}
          </span>
        </p>
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
                    <button
                      className="stepper-btn"
                      title="Spend a slot"
                      onClick={() => setSlotUsed(level, used + 1, total)}
                    >
                      −
                    </button>
                    <span className="w-12 text-center tabular-nums">
                      {total - used}/{total}
                    </span>
                    <button
                      className="stepper-btn"
                      title="Restore a slot"
                      onClick={() => setSlotUsed(level, used - 1, total)}
                    >
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
              <button
                className="stepper-btn"
                title="Spend a slot"
                onClick={() => update({ pactSlotsUsed: Math.min(pact.slots, character.pactSlotsUsed + 1) })}
              >
                −
              </button>
              <span className="w-12 text-center tabular-nums">
                {pact.slots - character.pactSlotsUsed}/{pact.slots}
              </span>
              <button
                className="stepper-btn"
                title="Restore a slot"
                onClick={() => update({ pactSlotsUsed: Math.max(0, character.pactSlotsUsed - 1) })}
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {bonusSpells.length > 0 && (
        <div className="mb-4">
          <h3 className="section-title">Bonus Spells (Always Prepared)</h3>
          <p className="mb-2 text-xs text-stone-500">Granted free by your subclass — these don't count against your known/prepared limits above.</p>
          <div className="space-y-1.5">
            {bonusSpells.map((sp) => {
              const isOpen = !!expanded[`bonus-${sp.key}`];
              return (
                <div key={sp.key} className="item-row">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
                    <button
                      className="flex flex-1 items-center gap-2 text-left"
                      onClick={() => setExpanded((e) => ({ ...e, [`bonus-${sp.key}`]: !e[`bonus-${sp.key}`] }))}
                    >
                      <span className="item-expand-btn">{isOpen ? '▾' : '▸'}</span>
                      <span className="font-medium">{sp.name}</span>
                    </button>
                    <span className="pill">{sp.level === 0 ? 'Cantrip' : `Lv ${sp.level}`}</span>
                    <span className="pill">{sp.school}</span>
                  </div>
                  {isOpen && (
                    <div className="border-t border-stone-200 px-3 py-3 text-sm dark:border-stone-800">
                      <p className="mb-2 text-xs text-stone-500">
                        {sp.castingTime} • {sp.range} • {sp.components} • {sp.duration}
                      </p>
                      <p className="text-stone-600 dark:text-stone-300">{sp.description || 'No description available.'}</p>
                      {sourceCitation(sp.source) && <p className="mt-2 text-xs italic text-stone-400">{sourceCitation(sp.source)}</p>}
                    </div>
                  )}
                </div>
              );
            })}
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
              <div className="space-y-1.5">
                {byLevel.get(level)!.map((sp) => {
                  const isOpen = !!expanded[sp.key];
                  return (
                    <div key={sp.key} className="item-row">
                      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
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
                        <button
                          className="flex flex-1 items-center gap-2 text-left"
                          onClick={() => setExpanded((e) => ({ ...e, [sp.key]: !e[sp.key] }))}
                        >
                          <span className="item-expand-btn">{isOpen ? '▾' : '▸'}</span>
                          <span className="font-medium">{sp.name}</span>
                        </button>
                        <span className="pill">{sp.school}</span>
                        {sp.concentration && <span className="pill">Concentration</span>}
                        {sp.ritual && <span className="pill">Ritual</span>}
                      </div>
                      {isOpen && (
                        <div className="border-t border-stone-200 px-3 py-3 text-sm dark:border-stone-800">
                          <p className="mb-2 text-xs text-stone-500">
                            {sp.castingTime} • {sp.range} • {sp.components} • {sp.duration}
                          </p>
                          <p className="text-stone-600 dark:text-stone-300">{sp.description || 'No description available.'}</p>
                          {sourceCitation(sp.source) && (
                            <p className="mt-2 text-xs italic text-stone-400">{sourceCitation(sp.source)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function patchItem(id: string, patch: Partial<InventoryEntry>) {
    update({ inventory: character.inventory.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  }
  function toggleEquipped(inv: InventoryEntry) {
    update({ inventory: toggleInventoryEquipped(character.inventory, compendium, inv.id) });
  }
  function setTwoHanded(inv: InventoryEntry, twoHanded: boolean) {
    update({ inventory: setInventoryTwoHanded(character.inventory, compendium, inv.id, twoHanded) });
  }
  function removeItem(id: string) {
    update({ inventory: character.inventory.filter((i) => i.id !== id) });
  }
  function addItem(itemKey: string) {
    if (!itemKey) return;
    const item = compendium.items[itemKey];
    const money = item ? parseMoneyItem(item) : null;
    if (money) {
      update({ currency: { ...character.currency, [money.denom]: character.currency[money.denom] + money.amount } });
      return;
    }
    update({ inventory: [...character.inventory, { id: uuid(), itemKey, quantity: 1, equipped: false, attuned: false }] });
  }
  function toggleExpanded(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  const [showAllItems, setShowAllItems] = useState(false);

  const totalWeight = character.inventory.reduce((sum, inv) => {
    const item = inv.itemKey ? compendium.items[inv.itemKey] : undefined;
    return sum + (item?.weight ?? 0) * inv.quantity;
  }, 0);

  return (
    <div>
      <MoneyManager character={character} update={update} />

      <div className="mb-4 mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="section-title">Items</h3>
          <p className="text-sm text-stone-500">Total weight: {totalWeight} lb</p>
        </div>
        <div className="w-full sm:w-72">
          <div className="flex items-center justify-between">
            <label className="label">Add Item</label>
            <label className="mb-1 flex items-center gap-1 text-xs text-stone-500">
              <input type="checkbox" checked={showAllItems} onChange={(e) => setShowAllItems(e.target.checked)} />
              Show all
            </label>
          </div>
          <SearchableSelect
            placeholder="Search items…"
            onSelect={addItem}
            options={Object.values(compendium.items)
              .filter((item) => showAllItems || isProficientWithItem(character, compendium, item))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item) => ({ value: item.key, label: item.name }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        {character.inventory.map((inv) => {
          const item = inv.itemKey ? compendium.items[inv.itemKey] : undefined;
          const isOpen = !!expanded[inv.id];
          return (
            <div key={inv.id} className="item-row">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <button
                  className="item-expand-btn"
                  onClick={() => toggleExpanded(inv.id)}
                  aria-label={isOpen ? 'Collapse details' : 'Expand details'}
                  title="Description & notes"
                >
                  {isOpen ? '▾' : '▸'}
                </button>
                <span className="min-w-40 flex-1 font-medium">{item?.name ?? inv.customName}</span>
                {item?.type && <span className="pill">{item.type}</span>}
                <input
                  type="number"
                  min={1}
                  className="input w-16"
                  value={inv.quantity}
                  onChange={(e) => patchItem(inv.id, { quantity: Number(e.target.value) || 1 })}
                />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={inv.equipped} onChange={() => toggleEquipped(inv)} />
                  Equipped
                </label>
                {item && isVersatileWeapon(item) && (
                  <label className="flex items-center gap-1 text-xs" title={`One-handed: ${item.damage}. Two-handed: ${getVersatileDamage(item)}.`}>
                    <input type="checkbox" checked={!!inv.twoHanded} onChange={(e) => setTwoHanded(inv, e.target.checked)} />
                    Two-handed
                  </label>
                )}
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
              {isOpen && (
                <div className="border-t border-stone-200 px-3 py-3 text-sm dark:border-stone-800">
                  {item ? (
                    Array.isArray(item.contains) && item.contains.length > 0 ? (
                      <div className="mb-3">
                        <p className="mb-1 text-stone-500">Contains:</p>
                        <ul className="ml-4 list-disc space-y-0.5 text-stone-500">
                          {item.contains.map((c, i) => (
                            <li key={i}>{String(c)}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <>
                        <p className="mb-1 text-stone-500">{itemDescription(item)}</p>
                        {sourceCitation(item.source) && (
                          <p className="mb-3 text-xs italic text-stone-400">{sourceCitation(item.source)}</p>
                        )}
                      </>
                    )
                  ) : (
                    <p className="mb-3 text-stone-500">Custom item — no compendium entry.</p>
                  )}
                  <label className="label">Notes</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="e.g. found in the dragon's hoard, +1 once identified…"
                    value={inv.notes ?? ''}
                    onChange={(e) => patchItem(inv.id, { notes: e.target.value })}
                  />
                </div>
              )}
            </div>
          );
        })}
        {character.inventory.length === 0 && <p className="text-stone-500">No items yet.</p>}
      </div>
    </div>
  );
}

function MoneyManager({ character, update }: { character: Character; update: (p: Partial<Character>) => void }) {
  const denominations = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;
  const totalGp = totalValueInGp(character.currency);

  function step(coin: (typeof denominations)[number], delta: number) {
    update({ currency: { ...character.currency, [coin]: Math.max(0, character.currency[coin] + delta) } });
  }

  return (
    <div className="money-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title mb-0">Money</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-500">
            ≈ <strong className="text-stone-700 dark:text-stone-200">{formatGp(totalGp)} gp</strong> total
          </span>
          <button
            className="btn-secondary"
            title="Convert 10 cp → 1 sp, 10 sp → 1 gp, 10 gp → 1 pp"
            onClick={() => update({ currency: autoExchange(character.currency) })}
          >
            Auto-Exchange
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {denominations.map((coin) => (
          <div key={coin} className="coin-box">
            <span className="coin-label">{coin.toUpperCase()}</span>
            <div className="flex items-center justify-center gap-1.5">
              <button className="stepper-btn" title={`Remove 1 ${coin}`} onClick={() => step(coin, -1)}>
                −
              </button>
              <input
                type="number"
                min={0}
                className="coin-input"
                value={character.currency[coin]}
                onChange={(e) => update({ currency: { ...character.currency, [coin]: Math.max(0, Number(e.target.value) || 0) } })}
              />
              <button className="stepper-btn" title={`Add 1 ${coin}`} onClick={() => step(coin, 1)}>
                +
              </button>
            </div>
          </div>
        ))}
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
                      : <span className="text-stone-500">{f.description}</span>
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
            .filter((f) => !character.feats.includes(f.key) && isEligibleForFeat(character, compendium, f))
            .map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
        </select>
        <p className="mt-1 text-xs text-stone-400">Feats with prerequisites this character doesn't meet are hidden.</p>
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
                {feat.prerequisite && <p className="text-xs italic text-stone-400">Prerequisite: {feat.prerequisite}</p>}
                <p className="text-stone-500">{feat.description}</p>
                {sourceCitation(feat.source) && <p className="text-xs italic text-stone-400">{sourceCitation(feat.source)}</p>}
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
