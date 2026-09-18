/** 2024 Player's Handbook language list, split into the Standard/Rare grouping the book uses. */
export const STANDARD_LANGUAGES = [
  'Common',
  'Common Sign Language',
  'Draconic',
  'Dwarvish',
  'Elvish',
  'Giant',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Orc',
] as const;

export const RARE_LANGUAGES = [
  'Abyssal',
  'Celestial',
  'Deep Speech',
  'Druidic',
  'Infernal',
  'Primordial',
  "Thieves' Cant",
  'Sylvan',
  'Undercommon',
] as const;

export const DND_LANGUAGES = [...STANDARD_LANGUAGES, ...RARE_LANGUAGES];
