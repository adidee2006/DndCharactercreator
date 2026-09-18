import type { Character, AbilityScores } from '../types/character';
import type { AbilityKey, Compendium, Item, SkillKey } from '../types/compendium';
import { ABILITY_KEYS, SKILLS } from '../types/compendium';
import { proficiencyBonusForLevel, FULL_CASTER_SLOTS, encumbranceThresholds } from '../data/tables';

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function getTotalLevel(character: Character): number {
  return character.classes.reduce((sum, c) => sum + (c.level || 0), 0) || 1;
}

export function getProficiencyBonus(character: Character): number {
  return proficiencyBonusForLevel(getTotalLevel(character));
}

/** 2024 rules: each level of exhaustion gives a flat -2 penalty to ability checks, attack rolls, and saving throws. */
export function getExhaustionPenalty(character: Character): number {
  return -2 * Math.max(0, Math.min(6, character.exhaustion));
}

/** Conditions that override speed to 0 outright, regardless of the character's base speed. */
const SPEED_ZERO_CONDITIONS = ['grappled', 'restrained', 'paralyzed', 'petrified', 'stunned', 'unconscious'];

export function hasCondition(character: Character, name: string): boolean {
  return character.conditions.some((c) => c.trim().toLowerCase() === name);
}

/** Final ability scores: base scores + racial bonuses + manual/feat bonuses. */
export function getFinalAbilityScores(character: Character, compendium: Compendium): AbilityScores {
  const scores: AbilityScores = { ...character.baseAbilityScores };
  const race = compendium.races[character.race.key];

  if (race) {
    for (const b of race.abilityBonuses) scores[b.ability] += b.bonus;
    if (character.race.subraceKey) {
      const subrace = race.subraces?.find((sr) => sr.key === character.race.subraceKey);
      if (subrace) for (const b of subrace.abilityBonuses) scores[b.ability] += b.bonus;
    }
  }

  const bgChoice = character.backgroundAbilityChoice;
  if (bgChoice?.mode === 'twoOne') {
    scores[bgChoice.plusTwo] += 2;
    scores[bgChoice.plusOne] += 1;
  } else if (bgChoice?.mode === 'oneOneOne') {
    for (const a of bgChoice.abilities) scores[a] += 1;
  }

  for (const key of ABILITY_KEYS) {
    const bonus = character.bonusAbilityScores[key];
    if (bonus) scores[key] += bonus;
  }

  return scores;
}

export function getAbilityModifiers(character: Character, compendium: Compendium): AbilityScores {
  const scores = getFinalAbilityScores(character, compendium);
  const mods = {} as AbilityScores;
  for (const key of ABILITY_KEYS) mods[key] = abilityModifier(scores[key]);
  return mods;
}

export function getSavingThrowModifier(
  character: Character,
  compendium: Compendium,
  ability: AbilityKey,
): number {
  const mods = getAbilityModifiers(character, compendium);
  const proficient = character.savingThrowProficiencies.includes(ability);
  return mods[ability] + (proficient ? getProficiencyBonus(character) : 0) + getExhaustionPenalty(character);
}

export function getSkillModifier(character: Character, compendium: Compendium, skill: SkillKey): number {
  const mods = getAbilityModifiers(character, compendium);
  const ability = SKILLS[skill].ability;
  const prof = getProficiencyBonus(character);
  const isExpert = character.skillExpertise.includes(skill);
  const isProficient = character.skillProficiencies.includes(skill) || isExpert;
  const bonus = isExpert ? prof * 2 : isProficient ? prof : 0;
  return mods[ability] + bonus + getExhaustionPenalty(character);
}

export function getPassiveSkill(character: Character, compendium: Compendium, skill: SkillKey): number {
  return 10 + getSkillModifier(character, compendium, skill);
}

export function getInitiative(character: Character, compendium: Compendium): number {
  const mods = getAbilityModifiers(character, compendium);
  return mods.dex + character.initiativeBonus + getExhaustionPenalty(character);
}

function hasUnarmoredDefense(character: Character, compendium: Compendium): 'con' | 'wis' | null {
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    if (!cls) continue;
    if (cls.features.some((f) => f.name === 'Unarmored Defense' && f.level <= cl.level)) {
      return cls.key === 'monk' ? 'wis' : 'con';
    }
  }
  return null;
}

export function getEquippedArmor(character: Character, compendium: Compendium) {
  const armorEntry = character.inventory.find((inv) => {
    if (!inv.equipped || !inv.itemKey) return false;
    const item = compendium.items[inv.itemKey];
    return item?.type === 'armor';
  });
  const shieldEntry = character.inventory.find((inv) => {
    if (!inv.equipped || !inv.itemKey) return false;
    const item = compendium.items[inv.itemKey];
    return item?.type === 'shield';
  });
  return {
    armor: armorEntry ? compendium.items[armorEntry.itemKey!] : undefined,
    shield: shieldEntry ? compendium.items[shieldEntry.itemKey!] : undefined,
  };
}

export function getArmorClass(character: Character, compendium: Compendium): number {
  if (character.acOverride != null) return character.acOverride;

  const mods = getAbilityModifiers(character, compendium);
  const { armor, shield } = getEquippedArmor(character, compendium);
  let base: number;

  if (armor) {
    base = armor.armorClassBase ?? 10;
    if (armor.armorClassAddDex) {
      const cap = armor.armorClassMaxDex;
      base += cap != null ? Math.min(mods.dex, cap) : mods.dex;
    }
  } else {
    const unarmoredAbility = hasUnarmoredDefense(character, compendium);
    base = unarmoredAbility ? 10 + mods.dex + mods[unarmoredAbility] : 10 + mods.dex;
  }

  if (shield) base += shield.armorClassBase ?? 2;

  // Defense fighting style: +1 AC while wearing armor (not while unarmored).
  if (armor && character.fightingStyle === 'defense') base += 1;

  return base;
}

export function isRangedWeapon(item: Item): boolean {
  return !!item.weaponProperties?.some((p) => p.startsWith('Ammunition'));
}

/** True if this weapon has the Versatile property (can be wielded one- or two-handed for a different damage die). */
export function isVersatileWeapon(item: Item): boolean {
  return !!item.weaponProperties?.some((p) => p.startsWith('Versatile'));
}

/** The higher damage die a Versatile weapon deals when wielded two-handed, e.g. "1d8" for a "Versatile (1d8)" property. Null if not versatile. */
export function getVersatileDamage(item: Item): string | null {
  const prop = item.weaponProperties?.find((p) => p.startsWith('Versatile'));
  const match = prop?.match(/\(([^)]+)\)/);
  return match?.[1] ?? null;
}

/** Whether this weapon is actually being wielded two-handed right now — inherently Two-Handed, or Versatile with the player's two-handed toggle on. */
export function isWieldedTwoHanded(item: Item, twoHanded?: boolean): boolean {
  return !!item.weaponProperties?.includes('Two-Handed') || (isVersatileWeapon(item) && !!twoHanded);
}

/** Attack roll bonus granted by the character's chosen Fighting Style for a specific weapon (e.g. Archery). */
export function getFightingStyleAttackBonus(character: Character, item: Item): number {
  if (character.fightingStyle === 'archery' && item.type === 'weapon' && isRangedWeapon(item)) return 2;
  return 0;
}

/** Damage roll bonus granted by the character's chosen Fighting Style for a specific weapon (e.g. Dueling — one-handed melee weapon only). */
export function getFightingStyleDamageBonus(character: Character, item: Item, twoHanded?: boolean): number {
  if (character.fightingStyle !== 'dueling' || item.type !== 'weapon' || isRangedWeapon(item)) return 0;
  if (isWieldedTwoHanded(item, twoHanded)) return 0;
  return 2;
}

export interface WeaponAttack {
  item: Item;
  attackBonus: number;
  damageText: string;
}

/** Attack bonus + damage line for a weapon, using Str/Dex/Finesse rules, proficiency, fighting style, and exhaustion. `twoHanded` matters only for a Versatile weapon (uses its higher damage die and loses the Dueling bonus). */
export function getWeaponAttack(character: Character, compendium: Compendium, item: Item, twoHanded?: boolean): WeaponAttack {
  const mods = getAbilityModifiers(character, compendium);
  const prof = getProficiencyBonus(character);
  const ranged = isRangedWeapon(item);
  const hasFinesse = item.weaponProperties?.some((p) => p.startsWith('Finesse'));
  const abilityMod = ranged ? mods.dex : hasFinesse ? Math.max(mods.str, mods.dex) : mods.str;
  const attackBonus = abilityMod + prof + getFightingStyleAttackBonus(character, item) + getExhaustionPenalty(character);
  const damageBonus = abilityMod + getFightingStyleDamageBonus(character, item, twoHanded);
  const damageDie = (isVersatileWeapon(item) && twoHanded && getVersatileDamage(item)) || item.damage;
  const damageText = damageDie ? `${damageDie}${damageBonus !== 0 ? formatModifier(damageBonus) : ''} ${item.damageType ?? ''}`.trim() : '';
  return { item, attackBonus, damageText };
}

/** All equipped weapons in the character's inventory, with attack/damage computed. Falls back to all carried weapons if none are marked equipped. */
export function getWeaponAttacks(character: Character, compendium: Compendium): WeaponAttack[] {
  const weaponEntries = character.inventory.filter((inv) => {
    const item = inv.itemKey ? compendium.items[inv.itemKey] : undefined;
    return item?.type === 'weapon';
  });
  const equipped = weaponEntries.filter((inv) => inv.equipped);
  const source = equipped.length > 0 ? equipped : weaponEntries;
  return source
    .map((inv) => ({ item: compendium.items[inv.itemKey!], twoHanded: inv.twoHanded }))
    .filter((x): x is { item: Item; twoHanded: boolean | undefined } => !!x.item)
    .map(({ item, twoHanded }) => getWeaponAttack(character, compendium, item, twoHanded));
}

export function getSpeed(character: Character, compendium: Compendium): number {
  if (SPEED_ZERO_CONDITIONS.some((c) => hasCondition(character, c))) return 0;
  const base =
    character.speedOverride ??
    (() => {
      const race = compendium.races[character.race.key];
      if (!race) return 30;
      const subrace = race.subraces?.find((sr) => sr.key === character.race.subraceKey);
      return subrace?.speed ?? race.speed;
    })();
  const exhaustionPenalty = 5 * Math.max(0, Math.min(6, character.exhaustion));
  return Math.max(0, base - exhaustionPenalty);
}

export interface HitDiceEntry {
  die: number;
  count: number;
}

export function getHitDice(character: Character, compendium: Compendium): HitDiceEntry[] {
  const byDie = new Map<number, number>();
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    if (!cls) continue;
    byDie.set(cls.hitDie, (byDie.get(cls.hitDie) ?? 0) + cl.level);
  }
  return [...byDie.entries()].map(([die, count]) => ({ die, count }));
}

/** Hit points using the standard "max at level 1, average thereafter" method. */
export function getHitPointsMax(character: Character, compendium: Compendium): number {
  if (character.hpMaxOverride != null) return character.hpMaxOverride;

  const conMod = getAbilityModifiers(character, compendium).con;
  let total = 0;
  let firstClassLevelConsumed = false;

  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    if (!cls || cl.level <= 0) continue;
    const avgPerLevel = Math.floor(cls.hitDie / 2) + 1;
    for (let lvl = 1; lvl <= cl.level; lvl++) {
      if (!firstClassLevelConsumed) {
        total += cls.hitDie + conMod;
        firstClassLevelConsumed = true;
      } else {
        total += avgPerLevel + conMod;
      }
    }
  }
  return Math.max(1, total);
}

export function getCarryingCapacity(character: Character, compendium: Compendium) {
  const str = getFinalAbilityScores(character, compendium).str;
  return encumbranceThresholds(str);
}

// --------------------------------------------------------------------------
// Class/subclass resources (Channel Divinity, Lay on Hands, Rage, Bardic
// Inspiration, Ki/Focus Points, Sorcery Points, Wild Shape, Second Wind,
// Action Surge, Indomitable, Superiority Dice, Psionic Energy Dice,
// Arcane Recovery, and anything else with the same "N uses, recovers on a
// rest" shape).
// --------------------------------------------------------------------------

export interface ActiveClassResource {
  key: string;
  name: string;
  classKey: string;
  reset: 'long' | 'short' | 'short-partial';
  max: number;
  used: number;
  pool?: boolean;
}

/** Every class/subclass resource the character currently has access to, with its level-scaled max and current used count. */
export function getClassResources(character: Character, compendium: Compendium): ActiveClassResource[] {
  const used = character.resourcesUsed ?? {};
  const result: ActiveClassResource[] = [];
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    if (!cls || cl.level <= 0) continue;
    const levelIndex = Math.min(20, cl.level) - 1;
    for (const res of cls.resources ?? []) {
      const max = res.max[levelIndex] ?? 0;
      if (max <= 0) continue;
      result.push({ key: res.key, name: res.name, classKey: cl.classKey, reset: res.reset, max, used: used[res.key] ?? 0, pool: res.pool });
    }
    const subclass = cl.subclassKey ? cls.subclasses.find((s) => s.key === cl.subclassKey) : undefined;
    for (const res of subclass?.resources ?? []) {
      const max = res.max[levelIndex] ?? 0;
      if (max <= 0) continue;
      result.push({ key: res.key, name: res.name, classKey: cl.classKey, reset: res.reset, max, used: used[res.key] ?? 0, pool: res.pool });
    }
  }
  return result;
}

// --------------------------------------------------------------------------
// Spellcasting
// --------------------------------------------------------------------------

export interface SpellcastingSummary {
  classKey: string;
  ability: AbilityKey;
  saveDC: number;
  attackBonus: number;
  isPactMagic: boolean;
}

export function getSpellcastingClasses(character: Character, compendium: Compendium): SpellcastingSummary[] {
  const prof = getProficiencyBonus(character);
  const mods = getAbilityModifiers(character, compendium);
  const result: SpellcastingSummary[] = [];
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    if (!cls?.spellcasting) continue;
    const ability = cls.spellcasting.ability;
    result.push({
      classKey: cl.classKey,
      ability,
      saveDC: 8 + prof + mods[ability],
      attackBonus: prof + mods[ability] + getExhaustionPenalty(character),
      isPactMagic: cls.spellcasting.progression === 'pact',
    });
  }
  return result;
}

/** Combined spell slots per spell level (1-9), following the multiclass spellcaster rules. */
export function getSpellSlots(character: Character, compendium: Compendium): number[] {
  let casterLevel = 0;
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    const sc = cls?.spellcasting;
    if (!sc || sc.progression === 'pact') continue;
    if (sc.progression === 'full') casterLevel += cl.level;
    else if (sc.progression === 'half') casterLevel += Math.floor(cl.level / 2);
    else if (sc.progression === 'third') casterLevel += Math.floor(cl.level / 3);
  }
  if (casterLevel <= 0) return [];
  return FULL_CASTER_SLOTS[Math.min(casterLevel, 20)] ?? [];
}

export function getPactMagicSlots(character: Character, compendium: Compendium): { slots: number; slotLevel: number } | null {
  const warlockLevel = character.classes.find((c) => c.classKey === 'warlock')?.level;
  if (!warlockLevel) return null;
  const cls = compendium.classes.warlock;
  const row = cls?.spellcasting?.slotTable[warlockLevel];
  if (!row) return null;
  const slotLevel = row.length;
  const slots = row[slotLevel - 1] ?? 0;
  return { slots, slotLevel };
}

export function getKnownCantrips(character: Character, compendium: Compendium): number {
  let total = 0;
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    const table = cls?.spellcasting?.cantripsKnown;
    if (table) total += table[Math.min(cl.level, 20) - 1] ?? 0;
  }
  return total;
}

// --------------------------------------------------------------------------
// XP / proficiency helpers for the UI
// --------------------------------------------------------------------------

export function getAllSkills(): SkillKey[] {
  return Object.keys(SKILLS) as SkillKey[];
}
