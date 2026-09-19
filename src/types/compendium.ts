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
  /** The rulebook this entry is printed in, e.g. "Player's Handbook", when known. */
  book?: string;
  /**
   * Page number within `book`, when known. Left unset for the bundled SRD
   * data: the free SRD document doesn't share the Player's Handbook's
   * pagination, so a PHB page number can't be derived from it without
   * risking a wrong citation — only set this from a source that actually
   * carries real page numbers.
   */
  page?: number;
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
  /** Fixed tool proficiencies this lineage grants (no choice), e.g. Rock Gnome's Tinker's Gift (tinker's tools). */
  bonusToolProficiencies?: string[];
}

export interface Race {
  key: string;
  name: string;
  source: SourceInfo;
  /** General physical appearance/flavor blurb — used to seed a character's Appearance field on the Bio tab. */
  description?: string;
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
  /** A bonus skill proficiency this race grants — fixed named skill(s) (no choice) or a player's choice of N, optionally restricted (e.g. Elf's Keen Senses: choose 1 of Insight/Perception/Survival; Human's Skillful: choose any 1). */
  bonusSkills?: { fixed?: SkillKey[]; choose?: number; chooseFrom?: SkillKey[] };
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

/**
 * A limited-use class/subclass resource that recovers on a rest — Channel
 * Divinity, Lay on Hands, Rage, Bardic Inspiration, Ki/Focus Points, Sorcery
 * Points, Wild Shape, Second Wind, Action Surge, Indomitable, Superiority
 * Dice, Psionic Energy Dice, Arcane Recovery, and anything else with the
 * same "N uses, recovers on a rest" shape.
 */
export interface ClassResource {
  key: string;
  name: string;
  /**
   * 'long': only a long rest restores it. 'short': a short OR long rest
   * fully restores it. 'short-partial': a short rest restores exactly one
   * use, a long rest restores all (Channel Divinity's actual rule).
   */
  reset: 'long' | 'short' | 'short-partial';
  /** Max uses (or pool amount, e.g. Lay on Hands' HP pool) at each class level 1-20 (index 0 = level 1). 0 = not yet available at that level. */
  max: number[];
  /** True for a point/HP pool (Lay on Hands, Sorcery Points, Focus Points) rather than discrete "uses" — cosmetic label only. */
  pool?: boolean;
}

export interface Subclass {
  key: string;
  name: string;
  features: ClassFeature[];
  /** Spells automatically prepared/known at the given level (e.g. a Paladin Oath's oath spells, a Cleric Domain's domain spells) — free, and not counted against the character's normal known/prepared limits. */
  bonusSpells?: { level: number; spellKeys: string[] }[];
  /** Limited-use resources this subclass grants (e.g. Battle Master's Superiority Dice, Psi Warrior's Psionic Energy Dice). */
  resources?: ClassResource[];
  /**
   * Bonus skill proficiencies this subclass grants at a given level — either
   * fixed named skills (no choice, e.g. Way of Mercy's Medicine + Insight)
   * or a player's choice of N skills, optionally restricted to a subset
   * (e.g. Fey Wanderer's "a Charisma skill"; College of Lore's 3 with no
   * restriction).
   */
  bonusSkills?: { level: number; fixed?: SkillKey[]; choose?: number; chooseFrom?: SkillKey[] }[];
  /** The class level at which this subclass grants a second Fighting Style pick (Fighter's Champion, "Additional Fighting Style", level 10). */
  grantsSecondFightingStyle?: number;
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
  /** Limited-use resources this class grants (Rage, Channel Divinity, Lay on Hands, Bardic Inspiration, etc.). */
  resources?: ClassResource[];
}

export interface Background {
  key: string;
  name: string;
  source: SourceInfo;
  /** General life-path/flavor blurb — used to seed a character's Backstory field on the Bio tab. */
  description?: string;
  skillProficiencies: SkillKey[];
  toolProficiencies: string[];
  languages: number;
  equipment: string[];
  feature: { name: string; description: string };
  /** The three abilities this background lets you increase (2024 rules: +2/+1 split or +1/+1/+1 across these). */
  abilityScores?: AbilityKey[];
  /** Feat key automatically granted by this background (2024 rules: every background grants an Origin feat). */
  originFeat?: string;
  personalityTraits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
}

export interface Feat {
  key: string;
  name: string;
  source: SourceInfo;
  /** 2024 rules: Origin feats are granted by background/level 1, General feats need level 4+ and an ASI slot, Epic Boons need level 19+. */
  category?: 'origin' | 'general' | 'epic';
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
  /** For kits/packs: the individual items bundled inside, shown as a line-item breakdown. */
  contains?: string[];
  // weapon-specific
  damage?: string; // "1d8"
  damageType?: string;
  weaponProperties?: string[];
  weaponCategory?: 'simple' | 'martial';
  /** 2024 rules: the weapon mastery property this weapon grants access to when a class feature lets you use it (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex). */
  masteryProperty?: 'Cleave' | 'Graze' | 'Nick' | 'Push' | 'Sap' | 'Slow' | 'Topple' | 'Vex';
  // armor-specific
  armorClassBase?: number;
  armorClassAddDex?: boolean;
  armorClassMaxDex?: number;
  armorCategory?: 'light' | 'medium' | 'heavy';
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
