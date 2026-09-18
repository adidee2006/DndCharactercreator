import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCompendium } from '../store/useCompendium';
import { getCharacter, saveCharacter } from '../lib/characters';
import type { Character } from '../types/character';
import { ABILITY_KEYS, ABILITY_NAMES } from '../types/compendium';
import type { AbilityKey } from '../types/compendium';
import { getAbilityModifiers, getHitPointsMax, formatModifier } from '../lib/calc';
import { asiLevelsForClass } from '../data/tables';
import { fightingStyles, fightingStylesByKey } from '../data/srd/fightingStyles';
import { getSpellCounts } from '../lib/eligibility';

type AsiMode = 'none' | 'two-one' | 'one-two' | 'feat';

export default function LevelUp() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { compendium, loading } = useCompendium();
  const [character, setCharacter] = useState<Character | null>(null);
  const [classKey, setClassKey] = useState<string>('');
  const [hpMethod, setHpMethod] = useState<'average' | 'manual'>('average');
  const [manualRoll, setManualRoll] = useState(1);
  const [subclassKey, setSubclassKey] = useState('');
  const [asiMode, setAsiMode] = useState<AsiMode>('none');
  const [asiAbility, setAsiAbility] = useState<AbilityKey>('str');
  const [asiAbility2, setAsiAbility2] = useState<AbilityKey>('dex');
  const [featKey, setFeatKey] = useState('');
  const [featAbility, setFeatAbility] = useState<AbilityKey>('str');
  const [newSpells, setNewSpells] = useState<string[]>([]);
  const [fightingStyleChoice, setFightingStyleChoice] = useState('');

  useEffect(() => {
    if (!id) return;
    getCharacter(id).then((c) => {
      if (c) {
        setCharacter(c);
        setClassKey(c.classes[0]?.classKey ?? '');
      }
    });
  }, [id]);

  if (loading || !character) return <p className="text-stone-500">Loading…</p>;

  const classIndex = character.classes.findIndex((c) => c.classKey === classKey);
  const current = character.classes[classIndex];
  if (!current) return <p className="text-stone-500">This character has no class to level up yet — use Edit first.</p>;

  const cls = compendium.classes[current.classKey];
  if (!cls) return <p className="text-stone-500">Unknown class.</p>;

  const newLevel = current.level + 1;
  const totalLevel = character.classes.reduce((s, c) => s + c.level, 0) + 1;
  const needsSubclass = cls.subclassLevel === newLevel && !current.subclassKey;
  const asiLevels = asiLevelsForClass(current.classKey);
  const grantsAsi = asiLevels.includes(newLevel);
  const newClassFeatures = cls.features.filter((f) => f.level === newLevel);
  const chosenSubclassObj = cls.subclasses.find((s) => s.key === (current.subclassKey || subclassKey));
  const newSubclassFeatures = chosenSubclassObj?.features.filter((f) => f.level === newLevel) ?? [];

  const needsFightingStyle = !character.fightingStyle && newClassFeatures.some((f) => f.name.includes('Fighting Style'));

  const mods = getAbilityModifiers(character, compendium);
  const conMod = mods.con;
  const avgGain = Math.floor(cls.hitDie / 2) + 1 + conMod;
  const manualGain = manualRoll + conMod;
  const currentMaxHp = getHitPointsMax(character, compendium);

  // Spells: how many additional cantrips/spells this level grants, for both
  // "known spell" casters (fixed table) and "prepared" casters (Cleric,
  // Druid, Paladin, Wizard — level + ability modifier formula), computed by
  // diffing getSpellCounts before vs. after the level change so both caster
  // types are handled the same way the creation wizard enforces them.
  const spellcasting = cls.spellcasting;
  const countsBefore = getSpellCounts(character, compendium);
  const hypotheticalClasses = character.classes.map((c, i) => (i === classIndex ? { ...c, level: newLevel } : c));
  const countsAfter = getSpellCounts({ ...character, classes: hypotheticalClasses }, compendium);
  const newSpellsAllowed = Math.max(0, countsAfter.spellLimit - countsBefore.spellLimit);
  const newCantripsAllowed = Math.max(0, countsAfter.cantripLimit - countsBefore.cantripLimit);
  const availableSpells = spellcasting
    ? Object.values(compendium.spells)
        .filter((sp) => sp.classes.includes(current.classKey) && !character.spellsKnown.includes(sp.key))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    : [];

  const feat = compendium.feats[featKey];

  function toggleSpell(key: string, max: number) {
    setNewSpells((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= max) return prev;
      return [...prev, key];
    });
  }

  async function commit() {
    if (!character) return;
    const hpGain = hpMethod === 'average' ? avgGain : manualGain;
    const nextClasses = character.classes.map((c, i) =>
      i === classIndex ? { ...c, level: newLevel, subclassKey: c.subclassKey || subclassKey || undefined } : c,
    );

    const patch: Partial<Character> = {
      classes: nextClasses,
      hpMaxOverride: currentMaxHp + hpGain,
      hpCurrent: character.hpCurrent + hpGain,
      spellsKnown: newSpells.length ? [...character.spellsKnown, ...newSpells] : character.spellsKnown,
      fightingStyle: character.fightingStyle || fightingStyleChoice || undefined,
    };

    if (grantsAsi) {
      if (asiMode === 'two-one') {
        patch.bonusAbilityScores = { ...character.bonusAbilityScores, [asiAbility]: (character.bonusAbilityScores[asiAbility] ?? 0) + 2 };
      } else if (asiMode === 'one-two') {
        patch.bonusAbilityScores = {
          ...character.bonusAbilityScores,
          [asiAbility]: (character.bonusAbilityScores[asiAbility] ?? 0) + 1,
          [asiAbility2]: (character.bonusAbilityScores[asiAbility2] ?? 0) + 1,
        };
      } else if (asiMode === 'feat' && featKey) {
        patch.feats = character.feats.includes(featKey) ? character.feats : [...character.feats, featKey];
        if (feat?.abilityBonusChoice) {
          patch.bonusAbilityScores = {
            ...character.bonusAbilityScores,
            [featAbility]: (character.bonusAbilityScores[featAbility] ?? 0) + feat.abilityBonusChoice.amount,
          };
        }
      }
    }

    const updated: Character = { ...character, ...patch };
    await saveCharacter(updated);
    navigate(`/character/${character.id}`);
  }

  const canCommit = (!needsSubclass || !!subclassKey) && (!needsFightingStyle || !!fightingStyleChoice);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Level Up: {character.name}</h1>
      <p className="mb-6 text-sm text-stone-500">
        <Link to={`/character/${character.id}`} className="underline">
          {character.name}
        </Link>{' '}
        is about to become a level {totalLevel} character.
      </p>

      <div className="card space-y-6 p-5">
        {character.classes.length > 1 && (
          <div>
            <label className="label">Which class is leveling up?</label>
            <select className="input" value={classKey} onChange={(e) => setClassKey(e.target.value)}>
              {character.classes.map((c) => (
                <option key={c.classKey} value={c.classKey}>
                  {compendium.classes[c.classKey]?.name ?? c.classKey} (currently {c.level})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="stat-box mx-auto w-full max-w-xs">
          <span className="text-xs uppercase text-stone-500">{cls.name}</span>
          <span className="text-2xl font-bold">
            {current.level} <span className="text-stone-400">→</span> {newLevel}
          </span>
        </div>

        <div>
          <h3 className="section-title">Hit Points</h3>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={hpMethod === 'average'} onChange={() => setHpMethod('average')} />
              Take the average (+{avgGain} hp: {Math.floor(cls.hitDie / 2) + 1} + {formatModifier(conMod)} Con)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={hpMethod === 'manual'} onChange={() => setHpMethod('manual')} />
              Roll it myself (d{cls.hitDie})
            </label>
            {hpMethod === 'manual' && (
              <input
                type="number"
                min={1}
                max={cls.hitDie}
                className="input w-20"
                value={manualRoll}
                onChange={(e) => setManualRoll(Math.min(cls.hitDie, Math.max(1, Number(e.target.value) || 1)))}
              />
            )}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            New max HP will be {currentMaxHp + (hpMethod === 'average' ? avgGain : manualGain)} (currently {currentMaxHp}).
          </p>
        </div>

        {needsSubclass && (
          <div>
            <h3 className="section-title">Choose a Subclass</h3>
            <select className="input" value={subclassKey} onChange={(e) => setSubclassKey(e.target.value)}>
              <option value="">Choose…</option>
              {cls.subclasses.map((sc) => (
                <option key={sc.key} value={sc.key}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {needsFightingStyle && (
          <div>
            <h3 className="section-title">Fighting Style</h3>
            <select className="input" value={fightingStyleChoice} onChange={(e) => setFightingStyleChoice(e.target.value)}>
              <option value="">Choose…</option>
              {fightingStyles.map((fs) => (
                <option key={fs.key} value={fs.key}>
                  {fs.name}
                </option>
              ))}
            </select>
            {fightingStyleChoice && <p className="mt-1 text-xs text-stone-500">{fightingStylesByKey[fightingStyleChoice]?.description}</p>}
          </div>
        )}

        {(newClassFeatures.length > 0 || newSubclassFeatures.length > 0) && (
          <div>
            <h3 className="section-title">New Features at Level {newLevel}</h3>
            <ul className="space-y-2 text-sm">
              {newClassFeatures.map((f) => (
                <li key={f.name}>
                  <strong>{f.name}.</strong> <span className="text-stone-500">{f.description}</span>
                </li>
              ))}
              {newSubclassFeatures.map((f) => (
                <li key={f.name}>
                  <strong>{f.name}.</strong> <span className="text-stone-500">{f.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {grantsAsi && (
          <div>
            <h3 className="section-title">Ability Score Improvement</h3>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={asiMode === 'two-one'} onChange={() => setAsiMode('two-one')} />
                +2 to one ability
              </label>
              {asiMode === 'two-one' && (
                <select className="input ml-6 w-40" value={asiAbility} onChange={(e) => setAsiAbility(e.target.value as AbilityKey)}>
                  {ABILITY_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {ABILITY_NAMES[k]}
                    </option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" checked={asiMode === 'one-two'} onChange={() => setAsiMode('one-two')} />
                +1 to two abilities
              </label>
              {asiMode === 'one-two' && (
                <div className="ml-6 flex gap-2">
                  <select className="input w-40" value={asiAbility} onChange={(e) => setAsiAbility(e.target.value as AbilityKey)}>
                    {ABILITY_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {ABILITY_NAMES[k]}
                      </option>
                    ))}
                  </select>
                  <select className="input w-40" value={asiAbility2} onChange={(e) => setAsiAbility2(e.target.value as AbilityKey)}>
                    {ABILITY_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {ABILITY_NAMES[k]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" checked={asiMode === 'feat'} onChange={() => setAsiMode('feat')} />
                Take a feat instead
              </label>
              {asiMode === 'feat' && (
                <div className="ml-6 space-y-2">
                  <select className="input w-64" value={featKey} onChange={(e) => setFeatKey(e.target.value)}>
                    <option value="">Choose a feat…</option>
                    {Object.values(compendium.feats)
                      .filter((f) => !character.feats.includes(f.key))
                      .map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                  {feat && <p className="max-w-lg text-xs text-stone-500">{feat.description}</p>}
                  {feat?.abilityBonusChoice && (
                    <select className="input w-40" value={featAbility} onChange={(e) => setFeatAbility(e.target.value as AbilityKey)}>
                      {feat.abilityBonusChoice.abilities.map((k) => (
                        <option key={k} value={k}>
                          {ABILITY_NAMES[k]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" checked={asiMode === 'none'} onChange={() => setAsiMode('none')} />
                Skip for now
              </label>
            </div>
          </div>
        )}

        {(newSpellsAllowed > 0 || newCantripsAllowed > 0) && (
          <div>
            <h3 className="section-title">New Spells</h3>
            <p className="mb-2 text-sm text-stone-500">
              You can learn {newCantripsAllowed > 0 ? `${newCantripsAllowed} new cantrip${newCantripsAllowed === 1 ? '' : 's'}` : ''}
              {newCantripsAllowed > 0 && newSpellsAllowed > 0 ? ' and ' : ''}
              {newSpellsAllowed > 0 ? `${newSpellsAllowed} new spell${newSpellsAllowed === 1 ? '' : 's'}` : ''}.
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {availableSpells.map((sp) => {
                const max = sp.level === 0 ? newCantripsAllowed : newSpellsAllowed;
                const countOfLevel = newSpells.filter((k) => (compendium.spells[k]?.level === 0) === (sp.level === 0)).length;
                const disabled = !newSpells.includes(sp.key) && countOfLevel >= max;
                return (
                  <label key={sp.key} className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-40' : ''}`}>
                    <input type="checkbox" disabled={disabled} checked={newSpells.includes(sp.key)} onChange={() => toggleSpell(sp.key, max)} />
                    {sp.name} <span className="text-xs text-stone-500">{sp.level === 0 ? 'Cantrip' : `Lv ${sp.level}`}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <Link to={`/character/${character.id}`} className="btn-secondary">
          Cancel
        </Link>
        <button className="btn-primary" onClick={commit} disabled={!canCommit}>
          Confirm Level Up
        </button>
      </div>
      {!canCommit && (
        <p className="mt-2 text-right text-xs text-amber-600">
          {needsSubclass && !subclassKey ? 'Choose a subclass to continue. ' : ''}
          {needsFightingStyle && !fightingStyleChoice ? 'Choose a fighting style to continue.' : ''}
        </p>
      )}
    </div>
  );
}
