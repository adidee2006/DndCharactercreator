import type { AbilityKey, SkillKey } from './compendium';

export type GenerationMethod = 'standardArray' | 'pointBuy' | 'roll' | 'manual';

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  wis: number;
  int: number;
  cha: number;
}

export interface ClassLevel {
  classKey: string;
  level: number;
  subclassKey?: string;
}

export interface InventoryEntry {
  id: string;
  itemKey?: string; // reference into compendium.items
  customName?: string; // for freeform / not-in-compendium items
  quantity: number;
  equipped: boolean;
  attuned: boolean;
  notes?: string;
}

export interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface DeathSaves {
  successes: number;
  failures: number;
}

export interface SpellSlotUsage {
  [spellLevel: number]: number; // number of slots expended
}

export interface CustomFeature {
  id: string;
  name: string;
  description: string;
  source?: string;
}

export interface Character {
  id: string;
  name: string;
  playerName?: string;
  createdAt: string;
  updatedAt: string;

  race: { key: string; subraceKey?: string };
  classes: ClassLevel[];
  background: string;
  alignment?: string;

  abilityGenerationMethod: GenerationMethod;
  baseAbilityScores: AbilityScores;
  /** Manual ability score bonuses chosen by the player (e.g. feat ASIs, race "choose any" bonuses). */
  bonusAbilityScores: Partial<AbilityScores>;

  skillProficiencies: SkillKey[];
  skillExpertise: SkillKey[];
  savingThrowProficiencies: AbilityKey[];
  languages: string[];
  toolProficiencies: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  feats: string[];
  /** Key into fightingStyles, for classes that grant a Fighting Style choice (Fighter, Paladin, Ranger). */
  fightingStyle?: string;

  hpMax: number;
  hpCurrent: number;
  hpTemp: number;
  /** Manual override for max HP; when set, this wins over the calculated value. */
  hpMaxOverride?: number;
  hitDiceUsed: number;

  deathSaves: DeathSaves;
  inspiration: boolean;
  conditions: string[];
  exhaustion: number;

  acOverride?: number;
  initiativeBonus: number;
  speedOverride?: number;

  inventory: InventoryEntry[];
  currency: Currency;

  spellsKnown: string[];
  spellsPrepared: string[];
  spellSlotsUsed: SpellSlotUsage;
  pactSlotsUsed: number;

  customFeatures: CustomFeature[];

  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  backstory?: string;
  appearance?: string;
  notes?: string;

  avatarDataUrl?: string;
}

export function createBlankCharacter(id: string): Character {
  const now = new Date().toISOString();
  return {
    id,
    name: 'New Adventurer',
    createdAt: now,
    updatedAt: now,
    race: { key: '' },
    classes: [{ classKey: '', level: 1 }],
    background: '',
    abilityGenerationMethod: 'standardArray',
    baseAbilityScores: { str: 10, dex: 10, con: 10, wis: 10, int: 10, cha: 10 },
    bonusAbilityScores: {},
    skillProficiencies: [],
    skillExpertise: [],
    savingThrowProficiencies: [],
    languages: ['Common'],
    toolProficiencies: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    feats: [],
    hpMax: 0,
    hpCurrent: 0,
    hpTemp: 0,
    hitDiceUsed: 0,
    deathSaves: { successes: 0, failures: 0 },
    inspiration: false,
    conditions: [],
    exhaustion: 0,
    initiativeBonus: 0,
    inventory: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    spellsKnown: [],
    spellsPrepared: [],
    spellSlotsUsed: {},
    pactSlotsUsed: 0,
    customFeatures: [],
  };
}
