import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompendium } from '../store/useCompendium';
import { getCharacter, saveCharacter } from '../lib/characters';
import { createBlankCharacter, type Character, type GenerationMethod } from '../types/character';
import type { SkillKey } from '../types/compendium';
import { ABILITY_KEYS, ABILITY_NAMES } from '../types/compendium';
import { v4 as uuid } from 'uuid';
import {
  STANDARD_ARRAY,
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  pointBuySpent,
  rollAbilitySet,
  blankAbilityScores,
} from '../lib/abilityGeneration';
import { getFinalAbilityScores, abilityModifier, formatModifier, getSpellcastingClasses, getHitPointsMax } from '../lib/calc';
import { itemDescription } from '../lib/itemSummary';

const STEPS = ['Basics', 'Race', 'Class', 'Abilities', 'Skills', 'Equipment', 'Spells', 'Review'] as const;

export default function CharacterWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { compendium, loading } = useCompendium();
  const [character, setCharacter] = useState<Character | null>(null);
  const [step, setStep] = useState(0);
  const [rolledSet, setRolledSet] = useState<number[]>([]);

  useEffect(() => {
    if (id) {
      getCharacter(id).then((c) => c && setCharacter(c));
    } else {
      setCharacter(createBlankCharacter(uuid()));
    }
  }, [id]);

  function update(patch: Partial<Character>) {
    setCharacter((c) => (c ? { ...c, ...patch } : c));
  }

  async function persist(andNavigate?: string) {
    if (!character) return;
    let toSave = character;
    if (!id && character.hpCurrent <= 0) {
      const max = getHitPointsMax(character, compendium);
      if (max > 0) {
        toSave = { ...character, hpCurrent: max };
        setCharacter(toSave);
      }
    }
    await saveCharacter(toSave);
    if (andNavigate) navigate(andNavigate);
  }

  async function goNext() {
    await persist();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  const primaryClassKey = character?.classes[0]?.classKey;
  const spellcastingClasses = useMemo(
    () => (character ? getSpellcastingClasses(character, compendium) : []),
    [character, compendium],
  );

  if (loading || !character) {
    return <p className="text-stone-500">Loading…</p>;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{id ? `Editing ${character.name}` : 'Create a New Character'}</h1>
      <p className="mb-4 text-sm text-stone-500">Progress is saved automatically as you move between steps.</p>

      <div className="mb-6 flex flex-wrap gap-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`tab-btn ${i === step ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {step === 0 && <BasicsStep character={character} update={update} />}
        {step === 1 && <RaceStep character={character} update={update} compendium={compendium} />}
        {step === 2 && <ClassStep character={character} update={update} compendium={compendium} />}
        {step === 3 && (
          <AbilitiesStep
            character={character}
            update={update}
            compendium={compendium}
            rolledSet={rolledSet}
            setRolledSet={setRolledSet}
          />
        )}
        {step === 4 && <SkillsStep character={character} update={update} compendium={compendium} />}
        {step === 5 && <EquipmentStep character={character} update={update} compendium={compendium} />}
        {step === 6 && (
          <SpellsStep character={character} update={update} compendium={compendium} spellcastingClasses={spellcastingClasses} />
        )}
        {step === 7 && <ReviewStep character={character} compendium={compendium} />}
      </div>

      <div className="mt-4 flex justify-between">
        <button className="btn-secondary" onClick={goBack} disabled={step === 0}>
          Back
        </button>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => persist()}>
            Save Draft
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary" onClick={goNext}>
              Next
            </button>
          ) : (
            <button className="btn-primary" onClick={() => persist(`/character/${character.id}`)}>
              Finish
            </button>
          )}
        </div>
      </div>
      {primaryClassKey === undefined && step > 1 && (
        <p className="mt-2 text-xs text-amber-600">Tip: pick a class in step 3 to unlock skill and spell options.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function BasicsStep({ character, update }: { character: Character; update: (p: Partial<Character>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="label">Character Name</label>
        <input className="input" value={character.name} onChange={(e) => update({ name: e.target.value })} />
      </div>
      <div>
        <label className="label">Player Name</label>
        <input className="input" value={character.playerName ?? ''} onChange={(e) => update({ playerName: e.target.value })} />
      </div>
      <div>
        <label className="label">Alignment</label>
        <select className="input" value={character.alignment ?? ''} onChange={(e) => update({ alignment: e.target.value })}>
          <option value="">Choose…</option>
          {['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'].map(
            (a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ),
          )}
        </select>
      </div>
    </div>
  );
}

function RaceStep({
  character,
  update,
  compendium,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
}) {
  const race = compendium.races[character.race.key];
  return (
    <div>
      <label className="label">Race</label>
      <select
        className="input mb-4"
        value={character.race.key}
        onChange={(e) => update({ race: { key: e.target.value } })}
      >
        <option value="">Choose a race…</option>
        {Object.values(compendium.races)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
      </select>

      {race?.subraces && race.subraces.length > 0 && (
        <div className="mb-4">
          <label className="label">Subrace</label>
          <select
            className="input"
            value={character.race.subraceKey ?? ''}
            onChange={(e) => update({ race: { key: race.key, subraceKey: e.target.value || undefined } })}
          >
            <option value="">Choose…</option>
            {race.subraces.map((sr) => (
              <option key={sr.key} value={sr.key}>
                {sr.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {race && (
        <div className="rounded-lg border border-stone-300 p-3 text-sm dark:border-stone-700">
          <p className="mb-1 text-stone-600 dark:text-stone-300">
            Size {race.size} • Speed {race.speed} ft
            {race.darkvision ? ` • Darkvision ${race.darkvision} ft` : ''}
          </p>
          <p className="mb-2 text-stone-600 dark:text-stone-300">
            Ability Bonuses: {race.abilityBonuses.map((b) => `${ABILITY_NAMES[b.ability]} +${b.bonus}`).join(', ') || 'None'}
          </p>
          <ul className="space-y-1">
            {race.traits.map((t) => (
              <li key={t.name}>
                <strong>{t.name}.</strong> <span className="text-stone-500">{t.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <label className="label">Background</label>
        <select
          className="input"
          value={character.background}
          onChange={(e) => {
            const bg = compendium.backgrounds[e.target.value];
            update({
              background: e.target.value,
              skillProficiencies: Array.from(
                new Set([...character.skillProficiencies, ...(bg?.skillProficiencies ?? [])]),
              ),
              toolProficiencies: Array.from(new Set([...character.toolProficiencies, ...(bg?.toolProficiencies ?? [])])),
            });
          }}
        >
          <option value="">Choose a background…</option>
          {Object.values(compendium.backgrounds)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((bg) => (
              <option key={bg.key} value={bg.key}>
                {bg.name}
              </option>
            ))}
        </select>
        {compendium.backgrounds[character.background] && (
          <p className="mt-2 text-sm text-stone-500">
            <strong>{compendium.backgrounds[character.background].feature.name}.</strong>{' '}
            {compendium.backgrounds[character.background].feature.description}
          </p>
        )}
      </div>
    </div>
  );
}

function ClassStep({
  character,
  update,
  compendium,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
}) {
  const primary = character.classes[0];
  const cls = primary ? compendium.classes[primary.classKey] : undefined;

  function setPrimaryClass(classKey: string) {
    const newCls = compendium.classes[classKey];
    update({
      classes: [{ classKey, level: primary?.level ?? 1 }, ...character.classes.slice(1)],
      savingThrowProficiencies: newCls?.savingThrowProficiencies ?? character.savingThrowProficiencies,
    });
  }

  function addMulticlass() {
    update({ classes: [...character.classes, { classKey: '', level: 1 }] });
  }
  function updateClassAt(index: number, patch: Partial<Character['classes'][number]>) {
    const next = character.classes.map((c, i) => (i === index ? { ...c, ...patch } : c));
    update({ classes: next });
  }
  function removeClassAt(index: number) {
    update({ classes: character.classes.filter((_, i) => i !== index) });
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">Class</label>
          <select className="input" value={primary?.classKey ?? ''} onChange={(e) => setPrimaryClass(e.target.value)}>
            <option value="">Choose a class…</option>
            {Object.values(compendium.classes)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label">Level</label>
          <input
            type="number"
            min={1}
            max={20}
            className="input"
            value={primary?.level ?? 1}
            onChange={(e) => updateClassAt(0, { level: Number(e.target.value) || 1 })}
          />
        </div>
      </div>

      {cls && cls.subclasses.length > 0 && (primary?.level ?? 1) >= cls.subclassLevel && (
        <div className="mb-4">
          <label className="label">Subclass</label>
          <select
            className="input"
            value={primary?.subclassKey ?? ''}
            onChange={(e) => updateClassAt(0, { subclassKey: e.target.value || undefined })}
          >
            <option value="">Choose…</option>
            {cls.subclasses.map((sc) => (
              <option key={sc.key} value={sc.key}>
                {sc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {character.classes.slice(1).map((cl, i) => (
        <div key={i} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select className="input sm:col-span-2" value={cl.classKey} onChange={(e) => updateClassAt(i + 1, { classKey: e.target.value })}>
            <option value="">Multiclass…</option>
            {Object.values(compendium.classes)
              .filter((c) => c.key !== primary?.classKey)
              .map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
          </select>
          <input
            type="number"
            min={1}
            max={19}
            className="input"
            value={cl.level}
            onChange={(e) => updateClassAt(i + 1, { level: Number(e.target.value) || 1 })}
          />
          <button className="btn-danger" onClick={() => removeClassAt(i + 1)}>
            Remove
          </button>
        </div>
      ))}
      <button className="btn-ghost mt-1" onClick={addMulticlass}>
        + Add multiclass level
      </button>

      {cls && (
        <div className="mt-5 rounded-lg border border-stone-300 p-3 text-sm dark:border-stone-700">
          <p className="mb-1 text-stone-600 dark:text-stone-300">
            Hit Die d{cls.hitDie} • Saves: {cls.savingThrowProficiencies.map((a) => a.toUpperCase()).join(', ')}
          </p>
          <ul className="space-y-1">
            {cls.features
              .filter((f) => f.level <= (primary?.level ?? 1))
              .map((f) => (
                <li key={f.name}>
                  <strong>
                    Lv{f.level} {f.name}.
                  </strong>{' '}
                  <span className="text-stone-500">{f.description}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AbilitiesStep({
  character,
  update,
  compendium,
  rolledSet,
  setRolledSet,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
  rolledSet: number[];
  setRolledSet: (n: number[]) => void;
}) {
  const method = character.abilityGenerationMethod;
  const finalScores = getFinalAbilityScores(character, compendium);

  function setMethod(m: GenerationMethod) {
    if (m === 'pointBuy') update({ abilityGenerationMethod: m, baseAbilityScores: blankAbilityScores(8) });
    else update({ abilityGenerationMethod: m, baseAbilityScores: blankAbilityScores(10) });
  }

  function setScore(ability: (typeof ABILITY_KEYS)[number], value: number) {
    update({ baseAbilityScores: { ...character.baseAbilityScores, [ability]: value } });
  }

  const spent = method === 'pointBuy' ? pointBuySpent(character.baseAbilityScores) : 0;
  const availableValues = method === 'standardArray' ? STANDARD_ARRAY : rolledSet;
  const usedValues = ABILITY_KEYS.map((k) => character.baseAbilityScores[k]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(['standardArray', 'pointBuy', 'roll', 'manual'] as GenerationMethod[]).map((m) => (
          <button key={m} onClick={() => setMethod(m)} className={method === m ? 'btn-primary' : 'btn-secondary'}>
            {m === 'standardArray' ? 'Standard Array' : m === 'pointBuy' ? 'Point Buy' : m === 'roll' ? 'Roll 4d6' : 'Manual'}
          </button>
        ))}
      </div>

      {method === 'roll' && (
        <button className="btn-secondary mb-4" onClick={() => setRolledSet(rollAbilitySet())}>
          {rolledSet.length ? 'Reroll All' : 'Roll Scores'}
        </button>
      )}

      {method === 'pointBuy' && (
        <p className="mb-3 text-sm text-stone-500">
          Points spent: <strong>{spent}</strong> / {POINT_BUY_BUDGET}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ABILITY_KEYS.map((key) => {
          const base = character.baseAbilityScores[key];
          const mod = abilityModifier(finalScores[key]);
          return (
            <div key={key} className="stat-box">
              <span className="text-xs font-semibold uppercase text-stone-500">{ABILITY_NAMES[key]}</span>

              {(method === 'standardArray' || method === 'roll') && (
                <select
                  className="input mt-1"
                  value={base}
                  onChange={(e) => setScore(key, Number(e.target.value))}
                >
                  <option value={base}>{base}</option>
                  {availableValues
                    .filter((v) => !usedValues.includes(v) || v === base)
                    .map((v, i) => (
                      <option key={`${v}-${i}`} value={v}>
                        {v}
                      </option>
                    ))}
                </select>
              )}

              {method === 'pointBuy' && (
                <div className="mt-1 flex items-center gap-2">
                  <button
                    className="btn-ghost px-2"
                    onClick={() => base > 8 && setScore(key, base - 1)}
                    disabled={base <= 8}
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold">{base}</span>
                  <button
                    className="btn-ghost px-2"
                    onClick={() => {
                      const nextCost = POINT_BUY_COST[base + 1] - POINT_BUY_COST[base];
                      if (base < 15 && spent + nextCost <= POINT_BUY_BUDGET) setScore(key, base + 1);
                    }}
                    disabled={base >= 15}
                  >
                    +
                  </button>
                </div>
              )}

              {method === 'manual' && (
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="input mt-1"
                  value={base}
                  onChange={(e) => setScore(key, Number(e.target.value) || 0)}
                />
              )}

              <span className="mt-1 text-lg font-bold">{finalScores[key]}</span>
              <span className="text-sm text-stone-500">{formatModifier(mod)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkillsStep({
  character,
  update,
  compendium,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
}) {
  const cls = compendium.classes[character.classes[0]?.classKey];
  const ALL_SKILLS: SkillKey[] = ['acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'];
  const allSkillOptions: SkillKey[] = cls?.skillChoices.options === 'any' ? ALL_SKILLS : cls?.skillChoices.options ?? [];

  const backgroundSkills = compendium.backgrounds[character.background]?.skillProficiencies ?? [];
  const chosenFromClass = character.skillProficiencies.filter((s) => !backgroundSkills.includes(s));

  function toggleSkill(skill: SkillKey) {
    const has = character.skillProficiencies.includes(skill);
    if (has) {
      update({ skillProficiencies: character.skillProficiencies.filter((s) => s !== skill) });
    } else {
      const count = cls?.skillChoices.count ?? 2;
      if (chosenFromClass.length >= count) return;
      update({ skillProficiencies: [...character.skillProficiencies, skill] });
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-stone-500">
        Choose {cls?.skillChoices.count ?? 2} class skill{(cls?.skillChoices.count ?? 2) === 1 ? '' : 's'}. Background skills are
        added automatically.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {allSkillOptions.map((skill) => {
          const fromBackground = backgroundSkills.includes(skill);
          const checked = character.skillProficiencies.includes(skill);
          return (
            <label
              key={skill}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${fromBackground ? 'border-stone-200 bg-stone-100 text-stone-400 dark:border-stone-800 dark:bg-stone-800/40' : 'border-stone-300 dark:border-stone-700'}`}
            >
              <input type="checkbox" checked={checked} disabled={fromBackground} onChange={() => toggleSkill(skill)} />
              {skill.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
              {fromBackground && <span className="text-xs">(background)</span>}
            </label>
          );
        })}
      </div>

      <div className="mt-6">
        <label className="label">Languages (comma separated)</label>
        <input
          className="input"
          value={character.languages.join(', ')}
          onChange={(e) => update({ languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
        />
      </div>
    </div>
  );
}

function EquipmentStep({
  character,
  update,
  compendium,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
}) {
  const cls = compendium.classes[character.classes[0]?.classKey];
  const bg = compendium.backgrounds[character.background];

  function grantStartingEquipment() {
    const names = [...(cls?.startingEquipment ?? []), ...(bg?.equipment ?? [])];
    const newEntries = names.map((n) => {
      const item = compendium.items[n];
      return {
        id: uuid(),
        itemKey: item?.key,
        customName: item ? undefined : n,
        quantity: 1,
        equipped: item?.type === 'weapon' || item?.type === 'armor' || item?.type === 'shield',
        attuned: false,
      };
    });
    update({ inventory: [...character.inventory, ...newEntries] });
  }

  function addItem(itemKey: string) {
    if (!itemKey) return;
    update({
      inventory: [...character.inventory, { id: uuid(), itemKey, quantity: 1, equipped: false, attuned: false }],
    });
  }
  function removeItem(id: string) {
    update({ inventory: character.inventory.filter((i) => i.id !== id) });
  }
  function toggleEquipped(id: string) {
    update({ inventory: character.inventory.map((i) => (i.id === id ? { ...i, equipped: !i.equipped } : i)) });
  }
  function setQty(id: string, qty: number) {
    update({ inventory: character.inventory.map((i) => (i.id === id ? { ...i, quantity: qty } : i)) });
  }

  return (
    <div>
      <button className="btn-secondary mb-4" onClick={grantStartingEquipment}>
        Add Starting Equipment (class + background)
      </button>

      <div className="mb-4">
        <label className="label">Add Item from Compendium</label>
        <select className="input" value="" onChange={(e) => addItem(e.target.value)}>
          <option value="">Choose an item…</option>
          {Object.values(compendium.items)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) => (
              <option key={item.key} value={item.key}>
                {item.name} ({item.type})
              </option>
            ))}
        </select>
      </div>

      <div className="space-y-1">
        {character.inventory.map((inv) => {
          const item = inv.itemKey ? compendium.items[inv.itemKey] : undefined;
          return (
            <div key={inv.id} className="item-row px-2 py-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex-1">{item?.name ?? inv.customName}</span>
                <input
                  type="number"
                  min={1}
                  className="input w-16"
                  value={inv.quantity}
                  onChange={(e) => setQty(inv.id, Number(e.target.value) || 1)}
                />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={inv.equipped} onChange={() => toggleEquipped(inv.id)} />
                  Equipped
                </label>
                <button className="btn-danger" onClick={() => removeItem(inv.id)}>
                  Remove
                </button>
              </div>
              {item && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-stone-500">Description</summary>
                  <p className="mt-1 text-xs text-stone-500">{itemDescription(item)}</p>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-5 gap-2">
        {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((c) => (
          <div key={c}>
            <label className="label">{c.toUpperCase()}</label>
            <input
              type="number"
              className="input"
              value={character.currency[c]}
              onChange={(e) => update({ currency: { ...character.currency, [c]: Number(e.target.value) || 0 } })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SpellsStep({
  character,
  update,
  compendium,
  spellcastingClasses,
}: {
  character: Character;
  update: (p: Partial<Character>) => void;
  compendium: ReturnType<typeof useCompendium>['compendium'];
  spellcastingClasses: ReturnType<typeof getSpellcastingClasses>;
}) {
  if (spellcastingClasses.length === 0) {
    return <p className="text-stone-500">This character has no spellcasting classes yet.</p>;
  }

  const classKeys = character.classes.map((c) => c.classKey);
  const availableSpells = Object.values(compendium.spells)
    .filter((sp) => sp.classes.some((c) => classKeys.includes(c)))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  function toggleKnown(key: string) {
    const known = character.spellsKnown.includes(key);
    update({
      spellsKnown: known ? character.spellsKnown.filter((k) => k !== key) : [...character.spellsKnown, key],
      spellsPrepared: known ? character.spellsPrepared.filter((k) => k !== key) : character.spellsPrepared,
    });
  }
  function togglePrepared(key: string) {
    const prepared = character.spellsPrepared.includes(key);
    update({
      spellsPrepared: prepared ? character.spellsPrepared.filter((k) => k !== key) : [...character.spellsPrepared, key],
    });
  }

  return (
    <div>
      <p className="mb-3 text-sm text-stone-500">
        Select the spells this character knows. Toggle "Prepared" for spells currently readied for casting.
      </p>
      <div className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
        {availableSpells.map((sp) => {
          const known = character.spellsKnown.includes(sp.key);
          const prepared = character.spellsPrepared.includes(sp.key);
          return (
            <div key={sp.key} className="item-row px-2 py-1.5 text-sm">
              <div className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2">
                <input type="checkbox" checked={known} onChange={() => toggleKnown(sp.key)} />
                <span className="font-medium">{sp.name}</span>
                <span className="text-xs text-stone-500">{sp.level === 0 ? 'Cantrip' : `Lv ${sp.level}`}</span>
              </label>
              {known && (
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={prepared} onChange={() => togglePrepared(sp.key)} />
                  Prepared
                </label>
              )}
              </div>
              {sp.description && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-stone-500">Description</summary>
                  <p className="mt-1 text-xs text-stone-500">
                    {sp.castingTime} • {sp.range} • {sp.components} • {sp.duration}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">{sp.description}</p>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStep({ character, compendium }: { character: Character; compendium: ReturnType<typeof useCompendium>['compendium'] }) {
  const finalScores = getFinalAbilityScores(character, compendium);
  return (
    <div>
      <h2 className="mb-2 text-xl font-bold">{character.name}</h2>
      <p className="mb-4 text-sm text-stone-500">
        {compendium.races[character.race.key]?.name} •{' '}
        {character.classes
          .filter((c) => c.classKey)
          .map((c) => `${compendium.classes[c.classKey]?.name} ${c.level}`)
          .join(' / ')}{' '}
        • {compendium.backgrounds[character.background]?.name}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITY_KEYS.map((key) => (
          <div key={key} className="stat-box">
            <span className="text-xs uppercase text-stone-500">{key}</span>
            <span className="text-lg font-bold">{finalScores[key]}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-stone-500">
        Skills: {character.skillProficiencies.join(', ') || 'None chosen yet'}
      </p>
      <p className="mt-1 text-sm text-stone-500">Spells known: {character.spellsKnown.length}</p>
      <p className="mt-1 text-sm text-stone-500">Inventory items: {character.inventory.length}</p>
      <p className="mt-4 text-sm font-medium text-red-800 dark:text-red-400">
        Click Finish to save and open the full character sheet.
      </p>
    </div>
  );
}
