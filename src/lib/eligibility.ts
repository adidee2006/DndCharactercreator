import type { Character } from '../types/character';
import type { Compendium, Item, Feat } from '../types/compendium';
import { getSpellSlots, getPactMagicSlots, getSpellcastingClasses, getAbilityModifiers } from './calc';

/**
 * Weapon/armor/tool proficiencies from the character's classes, merged with
 * whatever is already stored on the character. Recomputing from classes here
 * (rather than trusting only the stored arrays) keeps this correct even for
 * characters saved before those arrays were populated, or edited outside the
 * wizard's class step.
 */
export function effectiveProficiencies(character: Character, compendium: Compendium) {
  const weapon = new Set(character.weaponProficiencies);
  const armor = new Set(character.armorProficiencies);
  const tools = new Set(character.toolProficiencies);
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    if (!cls) continue;
    cls.weaponProficiencies.forEach((p) => weapon.add(p));
    cls.armorProficiencies.forEach((p) => armor.add(p));
    cls.toolProficiencies.forEach((p) => tools.add(p));
  }
  return { weaponProficiencies: [...weapon], armorProficiencies: [...armor], toolProficiencies: [...tools] };
}

function normalizeWords(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && w !== 'the' && w !== 'and')
      .map((w) => (w.endsWith('s') ? w.slice(0, -1) : w)),
  );
}

function proficiencyMatchesName(proficiency: string, itemName: string): boolean {
  const profWords = normalizeWords(proficiency);
  const nameWords = normalizeWords(itemName);
  if (profWords.size === 0) return false;
  for (const w of profWords) if (!nameWords.has(w)) return false;
  return true;
}

/**
 * Whether the character has proficiency with this item, based on their
 * class/race/background-granted weapon, armor, and tool proficiencies.
 * Gear, consumables, and other non-proficiency-gated items always pass.
 */
export function isProficientWithItem(character: Character, compendium: Compendium, item: Item): boolean {
  // Homebrew/custom items rarely match a standard proficiency string by name
  // (that's the whole point of homebrew), so the filter would otherwise hide
  // a player's own custom content by default right after they add it.
  if (item.source.origin === 'custom') return true;
  const profs = effectiveProficiencies(character, compendium);
  if (item.type === 'weapon') {
    return profs.weaponProficiencies.some((p) => {
      const pl = p.toLowerCase();
      if (item.weaponCategory === 'simple' && pl.includes('simple weapon')) return true;
      if (item.weaponCategory === 'martial' && pl.includes('martial weapon')) return true;
      return proficiencyMatchesName(p, item.name);
    });
  }
  if (item.type === 'armor') {
    return profs.armorProficiencies.some((p) => {
      const pl = p.toLowerCase();
      return item.armorCategory != null && pl.includes(`${item.armorCategory} armor`);
    });
  }
  if (item.type === 'shield') {
    return profs.armorProficiencies.some((p) => p.toLowerCase().includes('shield'));
  }
  if (item.type === 'tool') {
    return profs.toolProficiencies.some((p) => proficiencyMatchesName(p, item.name));
  }
  return true;
}

/**
 * Only a couple of SRD feats have a hard prerequisite, and it's always "can
 * cast at least one spell" in practice, so this checks that specific case
 * rather than trying to parse arbitrary prerequisite text.
 */
export function isEligibleForFeat(character: Character, compendium: Compendium, feat: Feat): boolean {
  if (!feat.prerequisite) return true;
  if (/spell/i.test(feat.prerequisite)) return getSpellcastingClasses(character, compendium).length > 0;
  return true;
}

export interface MaxSpellLevelInfo {
  maxLevel: number;
  hasCantrips: boolean;
}

/** Highest spell level the character can currently know/prepare/cast, across all their classes. */
export function getMaxAvailableSpellLevel(character: Character, compendium: Compendium): MaxSpellLevelInfo {
  const slots = getSpellSlots(character, compendium);
  let maxLevel = 0;
  slots.forEach((count, i) => {
    if (count > 0) maxLevel = Math.max(maxLevel, i + 1);
  });
  const pact = getPactMagicSlots(character, compendium);
  if (pact && pact.slots > 0) maxLevel = Math.max(maxLevel, pact.slotLevel);

  const hasCantrips = character.classes.some((cl) => {
    const cls = compendium.classes[cl.classKey];
    return !!cls?.spellcasting;
  });

  return { maxLevel, hasCantrips };
}

export interface SpellCounts {
  cantripLimit: number;
  spellLimit: number;
}

/**
 * How many cantrips and leveled spells the character is actually allowed to
 * know right now, summed across every spellcasting class they have. "Known"
 * casters (Bard/Ranger/Sorcerer/Warlock) use their fixed known-spells table;
 * prepared casters (Cleric/Druid/Paladin/Wizard) use the standard "level +
 * ability modifier" prepared-spell formula as the equivalent cap here, since
 * this app tracks a single flat "spells known" list rather than a separate
 * prepared-each-day mechanic.
 */
export function getSpellCounts(character: Character, compendium: Compendium): SpellCounts {
  const mods = getAbilityModifiers(character, compendium);
  let cantripLimit = 0;
  let spellLimit = 0;
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    const sc = cls?.spellcasting;
    if (!sc) continue;
    cantripLimit += sc.cantripsKnown?.[cl.level - 1] ?? 0;
    if (sc.spellsKnownTable) {
      spellLimit += sc.spellsKnownTable[cl.level - 1] ?? 0;
    } else if (sc.preparedCasterAbilityMod) {
      spellLimit += Math.max(1, cl.level + mods[sc.ability]);
    }
  }
  return { cantripLimit, spellLimit };
}
