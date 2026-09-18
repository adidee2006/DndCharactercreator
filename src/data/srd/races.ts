import type { Race } from '../../types/compendium';

const PHB24 = { origin: 'srd' as const, label: "Player's Handbook (2024)", book: "Player's Handbook (2024)" };

/**
 * 2024 Player's Handbook species. Unlike the 2014 rules, species no longer
 * grant fixed ability score increases — those come from your Background
 * instead (see backgrounds.ts + the wizard's ability-choice step). A
 * species' `subraces` field is repurposed here for "lineage" choices
 * (Elf, Gnome, Tiefling) where the 2024 rules offer a small pick-one
 * flavor/mechanical option instead of a separate named subrace.
 */
export const races: Record<string, Race> = {
  aasimar: {
    key: 'aasimar',
    name: 'Aasimar',
    source: PHB24,
    size: 'Medium',
    speed: 30,
    darkvision: 60,
    abilityBonuses: [],
    languages: ['Common', 'Celestial'],
    languageChoices: 1,
    traits: [
      { name: 'Celestial Resistance', description: 'You have resistance to necrotic damage and radiant damage.' },
      {
        name: 'Healing Hands',
        description:
          'As an action, touch a creature and roll a number of d4s equal to your proficiency bonus; the creature regains that many hit points. Once used, you can\'t use this again until you finish a long rest.',
      },
      { name: 'Light Bearer', description: 'You know the Light cantrip. Charisma is your spellcasting ability for it.' },
      {
        name: 'Celestial Revelation',
        description:
          'At level 3, once per long rest as a bonus action you can call on your celestial nature for 1 minute, gaining one benefit of your choice: Necrotic Shroud (spectral wings, frighten creatures within 10 feet that fail a Wisdom save, and your melee attacks deal extra necrotic damage), Radiant Consumption (shed bright light and deal extra radiant damage, taking a small amount of damage yourself each turn), or Radiant Soul (spectral wings grant a flying speed and your attacks deal extra radiant damage).',
      },
    ],
  },
  dragonborn: {
    key: 'dragonborn',
    name: 'Dragonborn',
    source: PHB24,
    size: 'Medium',
    speed: 30,
    darkvision: 60,
    abilityBonuses: [],
    languages: ['Common', 'Draconic'],
    traits: [
      {
        name: 'Draconic Ancestry',
        description: 'Choose a kind of dragon; it determines the damage type of your Breath Weapon and Damage Resistance (e.g. Red = fire, Blue = lightning, White = cold, Black = acid, Green = poison).',
      },
      {
        name: 'Breath Weapon',
        description:
          'As an action, exhale destructive energy in a 15-foot cone (or 30-foot line for some ancestries); each creature in the area makes a saving throw, taking damage (scaling with your level) on a failure and half as much on a success. Usable a number of times equal to your proficiency bonus per long rest.',
      },
      { name: 'Damage Resistance', description: 'You have resistance to the damage type associated with your Draconic Ancestry.' },
      { name: 'Draconic Flight', description: 'At level 5, as a bonus action you can sprout spectral wings for 10 minutes, gaining a flying speed equal to your walking speed. Usable once per long rest (or by spending a spell slot).' },
    ],
  },
  dwarf: {
    key: 'dwarf',
    name: 'Dwarf',
    source: PHB24,
    size: 'Medium',
    speed: 30,
    darkvision: 120,
    abilityBonuses: [],
    languages: ['Common', 'Dwarvish'],
    traits: [
      { name: 'Dwarven Resilience', description: 'You have resistance to poison damage, and advantage on saving throws against being poisoned.' },
      { name: 'Dwarven Toughness', description: 'Your hit point maximum increases by 1, and increases by 1 again every time you gain a level.' },
      {
        name: 'Stonecunning',
        description:
          'As a bonus action, you can gain tremorsense with a range of 60 feet for 10 minutes if you are on ground made of stone/earth; you know the distance/direction of anything moving on that ground. Usable a number of times equal to your proficiency bonus per long rest, and you have this benefit automatically underground without expending a use.',
      },
    ],
  },
  elf: {
    key: 'elf',
    name: 'Elf',
    source: PHB24,
    size: 'Medium',
    speed: 30,
    darkvision: 60,
    abilityBonuses: [],
    languages: ['Common', 'Elvish'],
    traits: [
      { name: 'Fey Ancestry', description: 'You have advantage on saving throws against being charmed, and magic can’t put you to sleep.' },
      { name: 'Keen Senses', description: 'You gain proficiency in one of the following skills of your choice: Insight, Perception, or Survival.' },
      { name: 'Trance', description: 'Elves don’t need to sleep. Instead, they meditate deeply for 4 hours a day, gaining the same benefit a human does from 8 hours of sleep.' },
    ],
    subraces: [
      {
        key: 'drow-lineage',
        name: 'Elven Lineage: Drow',
        abilityBonuses: [],
        traits: [
          { name: 'Superior Darkvision', description: 'Your darkvision has a radius of 120 feet.' },
          { name: 'Drow Magic', description: 'You know the Dancing Lights cantrip. At level 3 you can cast Faerie Fire, and at level 5 Darkness, each once per long rest (Charisma is your spellcasting ability).' },
        ],
      },
      {
        key: 'high-elf-lineage',
        name: 'Elven Lineage: High Elf',
        abilityBonuses: [],
        traits: [{ name: 'Cantrip', description: 'You know the Prestidigitation cantrip. Intelligence is your spellcasting ability for it, and you can change the cantrip you know for it whenever you finish a long rest.' }],
      },
      {
        key: 'wood-elf-lineage',
        name: 'Elven Lineage: Wood Elf',
        abilityBonuses: [],
        speed: 35,
        traits: [{ name: 'Cantrip', description: 'You know the Druidcraft cantrip. Wisdom is your spellcasting ability for it.' }],
      },
    ],
  },
  gnome: {
    key: 'gnome',
    name: 'Gnome',
    source: PHB24,
    size: 'Small',
    speed: 30,
    darkvision: 60,
    abilityBonuses: [],
    languages: ['Common', 'Gnomish'],
    traits: [
      { name: 'Gnomish Cunning', description: 'You have advantage on Intelligence, Wisdom, and Charisma saving throws against being magically charmed, frightened, or having your thoughts read.' },
    ],
    subraces: [
      {
        key: 'forest-gnome-lineage',
        name: 'Gnomish Lineage: Forest Gnome',
        abilityBonuses: [],
        traits: [{ name: 'Cantrip', description: 'You know the Minor Illusion cantrip. Intelligence is your spellcasting ability for it.' }],
      },
      {
        key: 'rock-gnome-lineage',
        name: 'Gnomish Lineage: Rock Gnome',
        abilityBonuses: [],
        traits: [
          {
            name: "Tinker's Gift",
            description:
              "You gain proficiency with tinker's tools. Using them, you can cast Mending or Prestidigitation (chosen each time) without a spell slot; once used, you must finish a long rest (or spend a spell slot of level 1+) to do so again.",
          },
        ],
      },
    ],
  },
  goliath: {
    key: 'goliath',
    name: 'Goliath',
    source: PHB24,
    size: 'Medium',
    speed: 35,
    abilityBonuses: [],
    languages: ['Common', 'Giant'],
    traits: [
      {
        name: 'Giant Ancestry',
        description:
          "As a bonus action once per long rest (regained by expending a spell slot), you call on an inherited titan blessing of your choice: Cloud's Jaunt (teleport 30 feet to a spot you can see), Fire's Burn (deal extra fire damage and ignite a hit target), Frost's Chill (deal extra cold damage and reduce the target's speed), Hill's Tumble (knock a hit creature prone), Stone's Endurance (reduce incoming damage), or Storm's Thunder (deal extra thunder damage back to an attacker).",
      },
      { name: 'Large Form', description: 'At level 5, as a bonus action you can grow one size larger (to Large) for 10 minutes, along with your gear, once per long rest.' },
      { name: 'Powerful Build', description: 'You count as one size larger when determining carrying capacity and the weight you can push, drag, or lift, and you have advantage on checks made to escape a grapple.' },
    ],
  },
  halfling: {
    key: 'halfling',
    name: 'Halfling',
    source: PHB24,
    size: 'Small',
    speed: 30,
    abilityBonuses: [],
    languages: ['Common', 'Halfling'],
    traits: [
      { name: 'Brave', description: 'You have advantage on saving throws against being frightened.' },
      { name: 'Halfling Nimbleness', description: 'You can move through the space of any creature that is of a size larger than yours.' },
      { name: 'Luck', description: 'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die, and you must use the new roll.' },
      { name: 'Naturally Stealthy', description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.' },
    ],
  },
  human: {
    key: 'human',
    name: 'Human',
    source: PHB24,
    size: 'Medium',
    speed: 30,
    abilityBonuses: [],
    languages: ['Common'],
    languageChoices: 1,
    traits: [
      { name: 'Resourceful', description: 'You gain Heroic Inspiration whenever you finish a long rest.' },
      { name: 'Skillful', description: 'You gain proficiency in one skill of your choice.' },
      { name: 'Versatile', description: 'You gain an Origin feat of your choice, in addition to the one granted by your Background.' },
    ],
  },
  orc: {
    key: 'orc',
    name: 'Orc',
    source: PHB24,
    size: 'Medium',
    speed: 30,
    darkvision: 120,
    abilityBonuses: [],
    languages: ['Common', 'Orc'],
    traits: [
      {
        name: 'Adrenaline Rush',
        description:
          'As a bonus action you can take the Dash action and gain temporary hit points equal to your proficiency bonus. Usable a number of times equal to your proficiency bonus per long rest; you also regain a use when you roll initiative and have none left.',
      },
      { name: 'Relentless Endurance', description: 'When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Once used, you can’t use this again until you finish a long rest.' },
    ],
  },
  tiefling: {
    key: 'tiefling',
    name: 'Tiefling',
    source: PHB24,
    size: 'Medium',
    speed: 30,
    darkvision: 60,
    abilityBonuses: [],
    languages: ['Common', 'Infernal'],
    traits: [{ name: 'Otherworldly Presence', description: 'You know the Thaumaturgy cantrip. Charisma is your spellcasting ability for it.' }],
    subraces: [
      {
        key: 'abyssal-legacy',
        name: 'Fiendish Legacy: Abyssal',
        abilityBonuses: [],
        traits: [
          { name: 'Resistance', description: 'You have resistance to poison damage.' },
          { name: 'Legacy Spells', description: 'You know Poison Spray. At level 3 you can cast Ray of Sickness once per long rest (or by spending a spell slot).' },
        ],
      },
      {
        key: 'chthonic-legacy',
        name: 'Fiendish Legacy: Chthonic',
        abilityBonuses: [],
        traits: [
          { name: 'Resistance', description: 'You have resistance to necrotic damage.' },
          { name: 'Legacy Spells', description: 'You know Chill Touch. At level 3 you can cast False Life once per long rest (or by spending a spell slot).' },
        ],
      },
      {
        key: 'infernal-legacy',
        name: 'Fiendish Legacy: Infernal',
        abilityBonuses: [],
        traits: [
          { name: 'Resistance', description: 'You have resistance to fire damage.' },
          { name: 'Legacy Spells', description: 'You know Fire Bolt. At level 3 you can cast Hellish Rebuke once per long rest (or by spending a spell slot).' },
        ],
      },
    ],
  },
};
