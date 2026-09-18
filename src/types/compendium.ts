// Core rules types shared across the compendium (bundled SRD data, data pulled
// from the internet, and user-supplied custom/homebrew compendiums).

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ABILITY_NAMES: Record<AbilityKey, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

export type SkillKey =
  | 'acrobatics'
  | 'animalHandling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleightOfHand'
  | 'stealth'
  | 'survival';

export const SKILLS: Record<SkillKey, { name: string; ability: AbilityKey }> = {
  acrobatics: { name: 'Acrobatics', ability: 'dex' },
  animalHandling: { name: 'Animal Handling', ability: 'wis' },
  arcana: { name: 'Arcana', ability: 'int' },
  athletics: { name: 'Athletics', ability: 'str' },
  deception: { name: 'Deception', ability: 'cha' },
  history: { name: 'History', ability: 'int' },
  insight: { name: 'Insight', ability: 'wis' },
  intimidation: { name: 'Intimidation', ability: 'cha' },
  investigation: { name: 'Investigation', ability: 'int' },
  medicine: { name: 'Medicine', ability: 'wis' },
  nature: { name: 'Nature', ability: 'int' },
  perception: { name: 'Perception', ability: 'wis' },
  performance: { name: 'Performance', ability: 'cha' },
  persuasion: { name: 'Persuasion', ability: 'cha' },
  religion: { name: 'Religion', ability: 'int' },
  sleightOfHand: { name: 'Sleight of Hand', ability: 'dex' },
  stealth: { name: 'Stealth', ability: 'dex' },
  survival: { name: 'Survival', ability: 'wis' },
};

export interface SourceInfo {
  /** Where this entry came from: bundled SRD data, a remote sync, or a custom/homebrew import. */
  origin: 'srd' | 'remote' | 'custom';
  /** Human readable source label, e.g. "SRD 5.1", "Open5e", "My Homebrew Compendium". */
  label: string;
}

export interface AbilityBonus {
  ability: AbilityKey;
  bonus: number;
}

export interface Trait {
  name: string;
  description: string;
}

export interface Subrace {
  key: string;
  name: string;
  abilityBonuses: AbilityBonus[];
  traits: Trait[];
  speed?: number;
}

export interface Race {
  key: string;
  name: string;
  source: SourceInfo;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large';
  speed: number;
  abilityBonuses: AbilityBonus[];
  /** Ability score increase the player may assign freely (e.g. "choose any +2/+1" variants). */
  freeAbilityBonus?: { count: number; amount: number }[];
  traits: Trait[];
  languages: string[];
  languageChoices?: number;
  subraces?: Subrace[];
  darkvision?: number;
}

export interface ClassFeature {
  level: number;
  name: string;
  description: string;
}

export type SpellcastingAbility = AbilityKey;

export interface SpellSlotTable {
  // slots[level][spellLevel-1] = number of slots
  [classLevel: number]: number[];
}

export interface Spellcasting {
  ability: SpellcastingAbility;
  /** 'full' (wizard), 'half' (paladin/ranger), 'third' (eldritch knight), 'pact' (warlock), 'none' */
  progression: 'full' | 'half' | 'third' | 'pact';
  cantripsKnown?: number[]; // indexed by class level 1-20
  spellsKnownTable?: number[]; // for "known" casters (indexed by class level), undefined = prepared caster
  slotTable: SpellSlotTable;
  preparedCasterAbilityMod?: boolean;
}

export interface Subclass {
  key: string;
  name: string;
  features: ClassFeature[];
}

export interface DndClass {
  key: string;
  name: string;
  source: SourceInfo;
  hitDie: 6 | 8 | 10 | 12;
  primaryAbility: AbilityKey[];
  savingThrowProficiencies: AbilityKey[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  skillChoices: { count: number; options: SkillKey[] | 'any' };
  startingEquipment: string[];
  features: ClassFeature[];
  subclassLevel: number;
  subclasses: Subclass[];
  spellcasting?: Spellcasting;
}

export interface Background {
  key: string;
  name: string;
  source: SourceInfo;
  skillProficiencies: SkillKey[];
  toolProficiencies: string[];
  languages: number;
  equipment: string[];
  feature: { name: string; description: string };
  personalityTraits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
}

export interface Feat {
  key: string;
  name: string;
  source: SourceInfo;
  prerequisite?: string;
  description: string;
  abilityBonusChoice?: { abilities: AbilityKey[]; amount: number };
}

export type SpellSchool =
  | 'Abjuration'
  | 'Conjuration'
  | 'Divination'
  | 'Enchantment'
  | 'Evocation'
  | 'Illusion'
  | 'Necromancy'
  | 'Transmutation';

export interface Spell {
  key: string;
  name: string;
  source: SourceInfo;
  level: number; // 0 = cantrip
  school: SpellSchool;
  castingTime: string;
  range: string;
  components: string; // "V, S, M (a pinch of...)"
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: string[]; // class keys that can learn/prepare this
  description: string;
}

export type ItemType =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'gear'
  | 'tool'
  | 'consumable'
  | 'magic'
  | 'mount'
  | 'treasure';

export interface Item {
  key: string;
  name: string;
  source: SourceInfo;
  type: ItemType;
  cost?: string; // "15 gp"
  weight?: number; // lbs
  description?: string;
  // weapon-specific
  damage?: string; // "1d8"
  damageType?: string;
  weaponProperties?: string[];
  // armor-specific
  armorClassBase?: number;
  armorClassAddDex?: boolean;
  armorClassMaxDex?: number;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
  rarity?: 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary' | 'Artifact';
  requiresAttunement?: boolean;
}

export interface Compendium {
  races: Record<string, Race>;
  classes: Record<string, DndClass>;
  backgrounds: Record<string, Background>;
  feats: Record<string, Feat>;
  spells: Record<string, Spell>;
  items: Record<string, Item>;
}

export function emptyCompendium(): Compendium {
  return { races: {}, classes: {}, backgrounds: {}, feats: {}, spells: {}, items: {} };
}
