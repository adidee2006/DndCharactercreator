import type { DndClass, ClassFeature, ClassResource, SpellSlotTable } from '../../types/compendium';
import { FULL_CASTER_SLOTS, HALF_CASTER_SLOTS, PACT_MAGIC } from '../tables';

const SRD = { origin: 'srd' as const, label: "Player's Handbook (2024)", book: "Player's Handbook (2024)" };

function toSlotTable(rows: number[][]): SpellSlotTable {
  const table: SpellSlotTable = {};
  rows.forEach((row, level) => {
    if (level === 0) return;
    table[level] = row;
  });
  return table;
}

function pactSlotTable(): SpellSlotTable {
  const table: SpellSlotTable = {};
  for (let lvl = 1; lvl <= 20; lvl++) {
    const info = PACT_MAGIC[lvl];
    const row = new Array(info.slotLevel).fill(0);
    row[info.slotLevel - 1] = info.slots;
    table[lvl] = row;
  }
  return table;
}

function feat(level: number, name: string, description = ''): ClassFeature {
  return { level, name, description };
}

/**
 * Builds a level-1..20 max-uses array from (startLevel, value) breakpoint
 * pairs, e.g. levelTable(1, 2, 3, 3, 6, 4, 12, 5, 17, 6) means "2 uses at
 * levels 1-2, 3 at 3-5, 4 at 6-11, 5 at 12-16, 6 at 17-20" (Barbarian Rage).
 * Levels before the first breakpoint default to 0 (feature not gained yet).
 */
function levelTable(...pairs: number[]): number[] {
  const table = new Array(20).fill(0);
  for (let i = 0; i < pairs.length; i += 2) {
    const startLevel = pairs[i];
    const value = pairs[i + 1];
    for (let lvl = startLevel; lvl <= 20; lvl++) table[lvl - 1] = value;
  }
  return table;
}

/** A resource whose max equals the character's class level itself from `startLevel` on (Focus Points, Sorcery Points). */
function linearFromLevel(startLevel: number): number[] {
  return Array.from({ length: 20 }, (_, i) => (i + 1 >= startLevel ? i + 1 : 0));
}

/** A resource whose max is `perLevel` × class level from `startLevel` on (Lay on Hands' 5-per-level pool). */
function multipleOfLevel(startLevel: number, perLevel: number): number[] {
  return Array.from({ length: 20 }, (_, i) => (i + 1 >= startLevel ? (i + 1) * perLevel : 0));
}

function resource(
  key: string,
  name: string,
  reset: ClassResource['reset'],
  max: number[],
  pool?: boolean,
): ClassResource {
  return { key, name, reset, max, pool };
}

export const classes: Record<string, DndClass> = {
  barbarian: {
    key: 'barbarian',
    name: 'Barbarian',
    source: SRD,
    hitDie: 12,
    primaryAbility: ['str'],
    savingThrowProficiencies: ['str', 'con'],
    armorProficiencies: ['Light armor', 'Medium armor', 'Shields'],
    weaponProficiencies: ['Simple weapons', 'Martial weapons'],
    toolProficiencies: [],
    skillChoices: { count: 2, options: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
    startingEquipment: ['greataxe', 'handaxe', 'handaxe', 'javelin', 'javelin', 'javelin', 'javelin', 'explorers-pack'],
    subclassLevel: 3,
    resources: [resource('rage', 'Rage', 'long', levelTable(1, 2, 3, 3, 6, 4, 12, 5, 17, 6))],
    features: [
      feat(1, 'Rage', 'Bonus action to enter a rage: melee damage bonus, resistance to bludgeoning/piercing/slashing damage, advantage on Strength checks/saves.'),
      feat(1, 'Unarmored Defense', 'While not wearing armor, AC = 10 + Dex modifier + Con modifier.'),
      feat(1, 'Weapon Mastery', 'You can use the mastery property of two kinds of weapons you are proficient with; you can swap one of those choices whenever you finish a long rest.'),
      feat(2, 'Reckless Attack', 'Attack with advantage on Strength-based melee attacks this turn, but attacks against you have advantage until your next turn.'),
      feat(2, 'Danger Sense', 'Advantage on Dexterity saving throws against effects you can see.'),
      feat(3, 'Primal Path', 'Choose a subclass that grants features at 3rd, 6th, 10th, and 14th level.'),
      feat(5, 'Extra Attack', 'You can attack twice, instead of once, whenever you take the Attack action.'),
      feat(5, 'Fast Movement', 'Your speed increases by 10 feet while not wearing heavy armor.'),
      feat(7, 'Feral Instinct', 'Advantage on initiative rolls; can act normally on a surprise round if you enter a rage first.'),
      feat(9, 'Brutal Critical', 'Roll one additional weapon damage die on a critical hit.'),
      feat(11, 'Relentless Rage', 'When dropped to 0 HP while raging, make a Con save to drop to 1 HP instead.'),
      feat(15, 'Persistent Rage', 'Your rage ends early only if you fall unconscious or choose to end it.'),
      feat(18, 'Indomitable Might', 'If your total for a Strength check is less than your Strength score, use your Strength score instead.'),
      feat(20, 'Primal Champion', 'Your Strength and Constitution scores increase by 4, to a maximum of 24.'),
    ],
    subclasses: [
      {
        key: 'berserker',
        name: 'Path of the Berserker',
        features: [
          feat(3, 'Frenzy', 'While raging, you can make a single melee weapon attack as a bonus action each turn. When the rage ends, you suffer one level of exhaustion.'),
          feat(6, 'Mindless Rage', 'You can’t be charmed or frightened while raging. If you were already charmed or frightened, the effect is suspended.'),
          feat(10, 'Intimidating Presence', 'Use your action to frighten someone within 30 feet (Wisdom save or frightened of you until the end of your next turn).'),
          feat(14, 'Retaliation', 'When you take damage from a creature within 5 feet, you can use your reaction to make a melee weapon attack against it.'),
        ],
      },
      {
        key: 'totem-warrior',
        name: 'Path of the Totem Warrior',
        features: [
          feat(3, 'Totem Spirit', 'Choose a totem animal (Bear, Eagle, or Wolf) that grants a passive benefit while raging — e.g. the Bear grants resistance to all damage but psychic while raging.'),
          feat(6, 'Aspect of the Beast', 'Gain a magical benefit tied to your totem animal, usable even outside of a rage (e.g. the Eagle grants no disadvantage on perception checks in low light and the ability to see 1 mile away clearly).'),
          feat(10, 'Spirit Walker', 'Cast commune with nature as a ritual, communing with a spirit of the land instead of a natural setting.'),
          feat(14, 'Totemic Attunement', 'Gain a further magical benefit tied to your totem animal while raging (e.g. the Bear lets you halve an attacker’s speed on a hit as a bonus action).'),
        ],
      },
      {
        key: 'wild-heart',
        name: 'Path of the Wild Heart',
        features: [
          feat(3, 'Animal Speaker', 'You can cast Beast Sense and Speak with Animals without a spell slot, and choose an animal aspect (Bear, Eagle, or Wolf) that grants a passive benefit while raging.'),
          feat(6, 'Aspect of the Wilds', 'Gain a magical benefit tied to your animal aspect, usable even outside of a rage.'),
          feat(10, 'Nature Speaker', 'You can cast Commune with Nature without a spell slot.'),
          feat(14, 'Power of the Wild Heart', 'Gain a further magical benefit tied to your animal aspect while raging.'),
        ],
      },
      {
        key: 'world-tree',
        name: 'Path of the World Tree',
        features: [
          feat(3, 'Vitality of the Tree', 'While raging, you have resistance to necrotic and radiant damage, and can plant a rooted spirit anchor you can teleport back to.'),
          feat(6, 'Branches of the Tree', 'Teleport to your rooted spirit anchor as a bonus action while raging, and grant nearby allies temporary hit points when you do.'),
          feat(10, 'Battering Roots', 'Your melee weapon attacks while raging can push a target 10 feet away or pull it 10 feet closer.'),
          feat(14, 'Travel Along the Tree', 'You and willing creatures within 10 feet of your spirit anchor can teleport to a location you’ve marked with your anchor before.'),
        ],
      },
      {
        key: 'zealot',
        name: 'Path of the Zealot',
        features: [
          feat(3, 'Divine Fury', 'While raging, your first hit each turn deals extra necrotic or radiant damage; you also gain a bonus to death saves and reduced dying penalties.'),
          feat(6, 'Warrior of the Gods', 'You can be restored to life by any spell that requires only a spell slot of 5th level or lower, without needing costly material components.'),
          feat(10, 'Fanatical Focus', 'If you fail a saving throw while raging, you can reroll it once.'),
          feat(14, 'Zealous Presence', 'Use a bonus action to grant up to ten allies within 60 feet advantage on attack rolls and saving throws until the start of your next turn.'),
        ],
      },
    ],
  },

  bard: {
    key: 'bard',
    name: 'Bard',
    source: SRD,
    hitDie: 8,
    primaryAbility: ['cha'],
    savingThrowProficiencies: ['dex', 'cha'],
    armorProficiencies: ['Light armor'],
    weaponProficiencies: ['Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    toolProficiencies: ['Three musical instruments'],
    skillChoices: { count: 3, options: 'any' },
    startingEquipment: ['rapier', 'diplomats-pack', 'lute', 'leather'],
    subclassLevel: 3,
    // Reset simplified to 'short' throughout: the real rule is long-rest-only
    // until Font of Inspiration (level 5) adds short-rest recovery, but this
    // model's reset field can't vary by level — short-rest recovery below
    // level 5 is a minor, intentionally generous simplification.
    resources: [resource('bardic-inspiration', 'Bardic Inspiration', 'short', levelTable(1, 2, 5, 3, 9, 4, 13, 5, 17, 6))],
    features: [
      feat(1, 'Bardic Inspiration', 'Bonus action to give a creature a d6 (scales with level) they can add to one ability check, attack roll, or saving throw.'),
      feat(1, 'Spellcasting', 'You can cast bard spells using Charisma.'),
      feat(2, 'Jack of All Trades', 'Add half your proficiency bonus to ability checks that don’t already include it.'),
      feat(2, 'Song of Rest', 'Allies who regain hit points during a short rest regain extra hit points.'),
      feat(3, 'Bard College', 'Choose a subclass that grants features at 3rd, 6th, and 14th level.'),
      feat(3, 'Expertise', 'Choose two skill proficiencies; your proficiency bonus is doubled for checks with them.'),
      feat(5, 'Font of Inspiration', 'Regain all uses of Bardic Inspiration on a short or long rest.'),
      feat(6, 'Countercharm', 'Use your action to give allies advantage on saves against being frightened or charmed.'),
      feat(10, 'Expertise', 'Choose two more skill proficiencies to gain expertise in.'),
      feat(10, 'Magical Secrets', 'Choose two spells from any class; they count as bard spells for you.'),
      feat(20, 'Superior Inspiration', 'When you roll initiative and have no uses of Bardic Inspiration left, you regain one use.'),
    ],
    subclasses: [
      {
        key: 'lore',
        name: 'College of Lore',
        features: [
          feat(3, 'Bonus Proficiencies', 'Gain proficiency with three skills of your choice.'),
          feat(3, 'Cutting Words', 'Use your reaction and expend a Bardic Inspiration die to subtract it from an enemy’s attack roll, ability check, or damage roll.'),
          feat(6, 'Additional Magical Secrets', 'Learn two spells of your choice from any class; they count as bard spells for you.'),
          feat(14, 'Peerless Skill', 'Add a Bardic Inspiration die to one of your own ability checks.'),
        ],
      },
      {
        key: 'valor',
        name: 'College of Valor',
        features: [
          feat(3, 'Bonus Proficiencies', 'Gain proficiency with medium armor, shields, and martial weapons.'),
          feat(3, 'Combat Inspiration', 'A creature with your Bardic Inspiration die can add it to a weapon damage roll or to its AC against one attack.'),
          feat(6, 'Extra Attack', 'You can attack twice, instead of once, whenever you take the Attack action.'),
          feat(14, 'Battle Magic', 'When you cast a bard spell, you can make one weapon attack as a bonus action.'),
        ],
      },
      {
        key: 'dance',
        name: 'College of Dance',
        features: [
          feat(3, 'Dazzling Footwork', 'Your unarmored AC can use Dexterity + Charisma, and you can use Bardic Inspiration on your own Dexterity or Constitution saves.'),
          feat(3, 'Inspiring Movement', 'When you spend a Bardic Inspiration die, you or the recipient can move up to their speed without provoking opportunity attacks.'),
          feat(6, 'Tandem Footwork', 'You and a creature that has your Bardic Inspiration can swap places or protect each other with a shared defensive dance.'),
          feat(14, 'Prodigious Leap', 'Your jump distance is greatly increased, and you can grant this benefit to others as part of your dance.'),
        ],
      },
      {
        key: 'glamour',
        name: 'College of Glamour',
        features: [
          feat(3, 'Mantle of Inspiration', 'Use a bonus action and a Bardic Inspiration die to grant temporary hit points and a burst of movement to several allies.'),
          feat(3, 'Enthralling Performance', 'Perform for at least 1 minute to charm listeners who fail a Wisdom save, for up to 1 hour.'),
          feat(6, 'Mantle of Majesty', 'Cast Command at will as a bonus action for 1 minute, without a spell slot, once per long rest.'),
          feat(14, 'Unbreakable Majesty', 'Become strikingly beautiful for 1 minute; any creature that tries to attack you must first make a Charisma save or be unable to.'),
        ],
      },
    ],
    spellcasting: {
      ability: 'cha',
      progression: 'full',
      cantripsKnown: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      spellsKnownTable: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
      slotTable: toSlotTable(FULL_CASTER_SLOTS),
    },
  },

  cleric: {
    key: 'cleric',
    name: 'Cleric',
    source: SRD,
    hitDie: 8,
    primaryAbility: ['wis'],
    savingThrowProficiencies: ['wis', 'cha'],
    armorProficiencies: ['Light armor', 'Medium armor', 'Shields'],
    weaponProficiencies: ['Simple weapons'],
    toolProficiencies: [],
    skillChoices: { count: 2, options: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
    startingEquipment: ['mace', 'scalemail', 'light-crossbow', 'priests-pack', 'shield', 'holy-symbol'],
    subclassLevel: 3,
    resources: [resource('channel-divinity', 'Channel Divinity', 'short-partial', levelTable(2, 2, 6, 3, 18, 4))],
    features: [
      feat(1, 'Spellcasting', 'You can cast cleric spells using Wisdom.'),
      feat(1, 'Divine Order', 'Choose a specialty: Protector (proficiency with martial weapons and heavy armor) or Thaumaturge (an extra cantrip, and add your Wisdom modifier to Arcana/Religion checks).'),
      feat(2, 'Channel Divinity', 'Channel divine energy to fuel Turn Undead and Divine Spark (point your holy symbol at a creature within 30 feet to heal it, or force a Constitution save to deal necrotic/radiant damage). 2 uses starting at level 2 (3 at level 6, 4 at level 18); regain one use on a short rest, all uses on a long rest. The damage/healing die (1d8) increases at levels 7, 13, and 18.'),
      feat(3, 'Divine Domain', 'Choose a domain subclass that grants features at 3rd, 6th, 8th, and 17th level, plus domain spells always prepared for you.'),
      feat(5, 'Sear Undead', 'When you use Turn Undead, any undead that fails its save and can see/hear you also takes radiant damage equal to your cleric level.'),
      feat(10, 'Divine Intervention', 'You can call on your deity to intervene on your behalf, once per long rest.'),
    ],
    subclasses: [
      {
        key: 'life',
        name: 'Life Domain',
        bonusSpells: [
          { level: 3, spellKeys: ['bless', 'cure-wounds'] },
          { level: 5, spellKeys: ['lesser-restoration', 'spiritual-weapon'] },
          { level: 9, spellKeys: ['revivify'] },
          { level: 13, spellKeys: ['freedom-of-movement'] },
          { level: 17, spellKeys: ['mass-cure-wounds'] },
        ],
        features: [
          feat(3, 'Bonus Proficiency', 'Gain proficiency with heavy armor.'),
          feat(3, 'Disciple of Life', 'Whenever you cast a spell that restores hit points, the target regains additional hit points equal to 2 + the spell’s level.'),
          feat(3, 'Channel Divinity: Preserve Life', 'Expend a Channel Divinity to restore a number of hit points equal to 5 × your cleric level, divided among creatures within 30 feet (none can be healed above half their max).'),
          feat(6, 'Blessed Healer', 'When you cast a spell that restores hit points to another creature, you also regain hit points equal to 2 + the spell’s level.'),
          feat(8, 'Divine Strike', 'Once per turn, your weapon attacks deal an extra 1d8 radiant damage (2d8 at 14th level).'),
          feat(17, 'Supreme Healing', 'When you would normally roll dice to restore hit points, use the highest possible result instead.'),
        ],
      },
      {
        key: 'light',
        name: 'Light Domain',
        bonusSpells: [
          { level: 3, spellKeys: ['burning-hands', 'faerie-fire'] },
          { level: 5, spellKeys: ['scorching-ray'] },
          { level: 9, spellKeys: ['fireball'] },
          { level: 13, spellKeys: ['wall-of-fire'] },
          { level: 17, spellKeys: ['scrying'] },
        ],
        features: [
          feat(3, 'Bonus Cantrip', 'Learn the light cantrip if you don’t already know it; it doesn’t count against your number of cantrips known.'),
          feat(3, 'Warding Flare', 'When a creature attacks you, use your reaction to impose disadvantage on the attack roll (limited uses per long rest).'),
          feat(3, 'Channel Divinity: Radiance of the Dawn', 'Expend a Channel Divinity to dispel magical darkness and deal radiant damage to hostile creatures within 30 feet.'),
          feat(6, 'Improved Flare', 'You can also use Warding Flare when a creature you can see within 30 feet attacks a creature other than you.'),
          feat(8, 'Potent Spellcasting', 'Add your Wisdom modifier to the damage you deal with any cleric cantrip.'),
          feat(17, 'Corona of Light', 'Use your action to radiate bright light in a 60-foot radius for 1 minute; enemies in the bright light have disadvantage on saves against your radiant/fire spells.'),
        ],
      },
      {
        key: 'trickery',
        name: 'Trickery Domain',
        bonusSpells: [
          { level: 3, spellKeys: ['charm-person', 'disguise-self'] },
          { level: 5, spellKeys: ['hold-person'] },
          { level: 9, spellKeys: ['pass-without-trace'] },
          { level: 13, spellKeys: ['dimension-door'] },
          { level: 17, spellKeys: ['dominate-person'] },
        ],
        features: [
          feat(3, 'Blessing of the Trickster', 'Touch a willing creature to give it advantage on Stealth checks for up to 1 hour.'),
          feat(3, 'Bonus Cantrip', 'Learn the Minor Illusion cantrip, if you don’t already know it; it doesn’t count against your cantrips known.'),
          feat(3, 'Channel Divinity: Invoke Duplicity', 'Expend a Channel Divinity to create an illusory duplicate of yourself for up to 1 minute, which you can speak and cast spells through, and that grants advantage on attacks against foes adjacent to it.'),
          feat(6, 'Channel Divinity: Cloak of Shadows', 'Expend a Channel Divinity to turn invisible until the end of your next turn or until you attack, deal damage, or cast a spell.'),
          feat(8, 'Divine Strike', 'Once per turn, your weapon attacks deal an extra 1d8 poison damage (2d8 at 14th level).'),
          feat(17, 'Improved Duplicity', 'You can create up to four duplicates of yourself instead of one with Invoke Duplicity.'),
        ],
      },
      {
        key: 'war',
        name: 'War Domain',
        bonusSpells: [
          { level: 3, spellKeys: ['magic-weapon', 'shield-of-faith'] },
          { level: 5, spellKeys: ['spiritual-weapon'] },
          { level: 9, spellKeys: ['haste'] },
          { level: 13, spellKeys: ['freedom-of-movement'] },
          { level: 17, spellKeys: ['flame-strike'] },
        ],
        features: [
          feat(3, 'Bonus Proficiencies', 'Gain proficiency with martial weapons and heavy armor.'),
          feat(3, 'War Priest', 'When you take the Attack action, you can make one weapon attack as a bonus action, a number of times per day equal to your Wisdom modifier.'),
          feat(3, 'Channel Divinity: Guided Strike', 'Expend a Channel Divinity to add +10 to an attack roll you just made.'),
          feat(6, 'Channel Divinity: War God’s Blessing', 'Expend a Channel Divinity to add +10 to an ally’s attack roll made within 30 feet of you.'),
          feat(8, 'Divine Strike', 'Once per turn, your weapon attacks deal an extra 1d8 damage of your deity’s associated type (2d8 at 14th level).'),
          feat(17, 'Avatar of Battle', 'Gain resistance to bludgeoning, piercing, and slashing damage from nonmagical weapons.'),
        ],
      },
    ],
    spellcasting: {
      ability: 'wis',
      progression: 'full',
      cantripsKnown: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      slotTable: toSlotTable(FULL_CASTER_SLOTS),
      preparedCasterAbilityMod: true,
    },
  },

  druid: {
    key: 'druid',
    name: 'Druid',
    source: SRD,
    hitDie: 8,
    primaryAbility: ['wis'],
    savingThrowProficiencies: ['int', 'wis'],
    armorProficiencies: ['Light armor', 'Medium armor', 'Shields (non-metal)'],
    weaponProficiencies: ['Clubs', 'Daggers', 'Darts', 'Javelins', 'Maces', 'Quarterstaffs', 'Scimitars', 'Sickles', 'Slings', 'Spears'],
    toolProficiencies: ['Herbalism kit'],
    skillChoices: { count: 2, options: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    startingEquipment: ['leather', 'scimitar', 'druidic-focus', 'explorers-pack'],
    subclassLevel: 3,
    // Level 20's "unlimited" Archdruid uses is represented as a large flat
    // number (99) rather than a genuinely unbounded value, since max is a
    // plain per-level count table.
    resources: [resource('wild-shape', 'Wild Shape', 'short', levelTable(2, 2, 20, 99))],
    features: [
      feat(1, 'Druidic', 'You know Druidic, the secret language of druids.'),
      feat(1, 'Spellcasting', 'You can cast druid spells using Wisdom.'),
      feat(2, 'Wild Shape', 'Use your action to magically assume the shape of a beast you have seen.'),
      feat(2, 'Wild Companion', 'Expend a use of Wild Shape to cast Find Familiar, without material components, summoning a spirit in a beast form instead of a slot.'),
      feat(3, 'Druid Circle', 'Choose a subclass that grants features at 3rd, 6th, 10th, and 14th level, plus circle spells always prepared for you.'),
      feat(4, 'Wild Shape Improvement', 'Your Wild Shape can now take the form of beasts with a swim speed.'),
      feat(8, 'Wild Shape Improvement', 'Your Wild Shape can now take the form of beasts with a flying speed.'),
      feat(18, 'Timeless Body', 'You age much more slowly; for every 10 years that pass, your body ages only 1 year.'),
      feat(20, 'Archdruid', 'You can use Wild Shape an unlimited number of times, and can cast Wild Shape spells while shape-shifted.'),
    ],
    subclasses: [
      {
        key: 'land',
        name: 'Circle of the Land',
        features: [
          feat(3, 'Bonus Cantrip', 'Learn one additional druid cantrip of your choice.'),
          feat(3, 'Natural Recovery', 'Once per day on a short rest, recover expended spell slots with a combined level up to half your druid level (rounded up, none 6th level or higher).'),
          feat(6, 'Land’s Stride', 'Moving through nonmagical difficult terrain costs no extra movement, and you can pass through nonmagical plants without being slowed or harmed by them.'),
          feat(10, 'Nature’s Ward', 'You can’t be charmed or frightened by elementals or fey, and you are immune to poison and disease.'),
          feat(14, 'Nature’s Sanctuary', 'Beasts and plant creatures must make a Wisdom save to attack you, and if they fail, they must choose a different target or lose the attack.'),
        ],
      },
      {
        key: 'moon',
        name: 'Circle of the Moon',
        features: [
          feat(3, 'Combat Wild Shape', 'Use Wild Shape as a bonus action, and can expend a spell slot while transformed to regain 1d8 hit points per slot level.'),
          feat(3, 'Circle Forms', 'Use Wild Shape to transform into a beast with a challenge rating as high as 1 (instead of the normal limit).'),
          feat(6, 'Primal Strike', 'Your attacks in beast form count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks.'),
          feat(10, 'Elemental Wild Shape', 'Expend two Wild Shape uses at once to transform into an air, earth, fire, or water elemental.'),
          feat(14, 'Thousand Forms', 'Cast the alter self spell at will, without expending a spell slot.'),
        ],
      },
      {
        key: 'sea',
        name: 'Circle of the Sea',
        features: [
          feat(3, 'Wrath of the Sea', 'As a bonus action, surround yourself with churning water for 1 minute, dealing cold damage to nearby creatures and granting yourself a swim speed.'),
          feat(3, 'Aquatic Affinity', 'You gain a swim speed equal to your walking speed, and can breathe underwater.'),
          feat(6, 'Storm Born', 'Wild Shape into aquatic or amphibious beasts more freely, and you gain resistance to cold damage while Wild Shaped.'),
          feat(10, 'Oceanic Gift', 'Grant an ally you can see a swim speed and the ability to breathe water for a short duration.'),
          feat(14, 'Reactive Surge', 'Use your reaction to teleport a short distance through water and unleash a burst of wrath-of-the-sea energy.'),
        ],
      },
      {
        key: 'stars',
        name: 'Circle of the Stars',
        features: [
          feat(3, 'Star Map', 'You gain a star map you can use to cast Guidance or Guiding Bolt without a spell slot, and to recall constellation lore.'),
          feat(3, 'Starry Form', 'Use a bonus action to enter a starry form (Archer, Chalice, or Dragon) for 10 minutes, granting a magical benefit and letting your unarmed strikes deal extra radiant damage.'),
          feat(6, 'Cosmic Omen', 'After a long rest, roll on the Cosmic Omen table (Weal or Woe) to gain a reactive bonus you can apply to an ally’s or enemy’s roll.'),
          feat(10, 'Twinkling Constellations', 'Your Starry Form constellations grow more powerful, granting flight in Dragon form and other upgraded benefits.'),
          feat(14, 'Full of Stars', 'While in Starry Form, you have resistance to bludgeoning, piercing, and slashing damage.'),
        ],
      },
    ],
    spellcasting: {
      ability: 'wis',
      progression: 'full',
      cantripsKnown: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      slotTable: toSlotTable(FULL_CASTER_SLOTS),
      preparedCasterAbilityMod: true,
    },
  },

  fighter: {
    key: 'fighter',
    name: 'Fighter',
    source: SRD,
    hitDie: 10,
    primaryAbility: ['str', 'dex'],
    savingThrowProficiencies: ['str', 'con'],
    armorProficiencies: ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'],
    weaponProficiencies: ['Simple weapons', 'Martial weapons'],
    toolProficiencies: [],
    skillChoices: { count: 2, options: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
    startingEquipment: ['chainmail', 'longsword', 'shield', 'light-crossbow', 'dungeoneers-pack'],
    subclassLevel: 3,
    resources: [
      resource('second-wind', 'Second Wind', 'short-partial', levelTable(1, 2, 4, 3, 10, 4)),
      resource('action-surge', 'Action Surge', 'short', levelTable(2, 1, 17, 2)),
      resource('indomitable', 'Indomitable', 'long', levelTable(9, 1, 13, 2, 17, 3)),
    ],
    features: [
      feat(1, 'Fighting Style', 'Adopt a particular style of fighting as your specialty (Archery, Defense, Dueling, etc).'),
      feat(1, 'Second Wind', 'Bonus action to regain 1d10 + fighter level hit points. 2 uses starting at level 1 (3 at level 4, 4 at level 10); regain one use on a short rest, all uses on a long rest.'),
      feat(1, 'Weapon Mastery', 'You can use the mastery property of three kinds of weapons you are proficient with; you can swap one of those choices whenever you finish a long rest.'),
      feat(2, 'Action Surge', 'Take one additional action on your turn, once per short/long rest (twice, but only once per turn, starting at level 17).'),
      feat(2, 'Tactical Mind', 'When you fail an ability check, you can expend a use of Second Wind (without regaining hit points) to add 1d10 to the check, potentially turning it into a success.'),
      feat(3, 'Martial Archetype', 'Choose a subclass that grants features at 3rd, 7th, 10th, 15th, and 18th level.'),
      feat(5, 'Extra Attack', 'You can attack twice, instead of once, whenever you take the Attack action.'),
      feat(9, 'Indomitable', 'You can reroll a failed saving throw, adding a bonus equal to your fighter level; once per long rest (twice at level 13, three times at level 17).'),
      feat(11, 'Extra Attack (2)', 'You can attack three times whenever you take the Attack action.'),
      feat(20, 'Extra Attack (3)', 'You can attack four times whenever you take the Attack action.'),
    ],
    subclasses: [
      {
        key: 'champion',
        name: 'Champion',
        features: [
          feat(3, 'Improved Critical', 'Your weapon attacks score a critical hit on a roll of 19 or 20.'),
          feat(7, 'Remarkable Athlete', 'Add half your proficiency bonus to Strength/Dexterity/Constitution checks that don’t already use it, and improve your running long jump distance.'),
          feat(10, 'Additional Fighting Style', 'Choose a second Fighting Style option.'),
          feat(15, 'Superior Critical', 'Your weapon attacks score a critical hit on a roll of 18–20.'),
          feat(18, 'Survivor', 'At the start of each of your turns, regain hit points equal to 5 + your Constitution modifier if you have no more than half your hit points left.'),
        ],
      },
      {
        key: 'battle-master',
        name: 'Battle Master',
        resources: [resource('superiority-dice', 'Superiority Dice', 'long', levelTable(3, 4, 7, 5, 15, 6))],
        features: [
          feat(3, 'Combat Superiority', 'Learn maneuvers fueled by superiority dice (d8s) — e.g. Trip Attack, Riposte, Precision Attack — to add extra effects and damage to your attacks. 4 dice at level 3 (5 at level 7, 6 at level 15), regained on a long rest.'),
          feat(3, 'Student of War', 'Gain proficiency with one type of artisan’s tools.'),
          feat(7, 'Know Your Enemy', 'Study a creature for a minute to learn how it compares to you in several categories, such as whether it is stronger or weaker.'),
          feat(10, 'Improved Combat Superiority', 'Your superiority dice become d10s.'),
          feat(15, 'Relentless', 'When you roll initiative and have no superiority dice left, you regain one.'),
          feat(18, 'Improved Combat Superiority', 'Your superiority dice become d12s.'),
        ],
      },
      {
        key: 'eldritch-knight',
        name: 'Eldritch Knight',
        features: [
          feat(3, 'Spellcasting', 'Learn to cast wizard spells (primarily abjuration and evocation), using Intelligence as your spellcasting ability.'),
          feat(3, 'Weapon Bond', 'Magically bond with up to two weapons, letting you summon a bonded weapon to your hand as a bonus action.'),
          feat(7, 'War Magic', 'When you use your action to cast a cantrip, you can make one weapon attack as a bonus action.'),
          feat(10, 'Eldritch Strike', 'When you hit a creature with a weapon attack, it has disadvantage on its next save against a spell you cast before the end of your next turn.'),
          feat(15, 'Arcane Charge', 'When you use Action Surge, you can teleport up to 30 feet as part of that action.'),
          feat(18, 'Improved War Magic', 'You can use War Magic when you cast any wizard spell, not just a cantrip.'),
        ],
      },
      {
        key: 'psi-warrior',
        name: 'Psi Warrior',
        resources: [resource('psionic-energy-dice', 'Psionic Energy Dice', 'long', levelTable(3, 4, 5, 6, 9, 8, 13, 10, 17, 12))],
        features: [
          feat(
            3,
            'Psionic Power',
            'You have a pool of Psionic Energy dice (d6s, equal to twice your proficiency bonus, regained on a long rest). Once on each of your turns after you hit with a weapon attack, you can expend one die and roll it, dealing extra force damage equal to the roll + your Intelligence modifier (Psionic Strike). You can also expend a die as a reaction when you or a creature within 30 feet takes damage to reduce that damage by the roll + your Intelligence modifier (Protective Field), or as a magic action to telekinetically move a Large or smaller object or a willing creature up to 30 feet (Telekinetic Movement).',
          ),
          feat(7, 'Telekinetic Adept', 'Gain new uses for your Psionic Energy dice, including shoving a creature you hit with Psionic Strike and briefly hovering when you land from a telekinetic movement.'),
          feat(10, 'Guarded Mind', 'You have resistance to psychic damage, and can spend a Psionic Energy die to end an effect causing you to be charmed or frightened.'),
          feat(15, 'Bulwark of Force', 'Spend a Psionic Energy die to grant yourself and nearby allies resistance to one damage type for 1 minute.'),
          feat(18, 'Telekinetic Master', 'Cast telekinesis at will without a spell slot, once per turn.'),
        ],
      },
    ],
  },

  monk: {
    key: 'monk',
    name: 'Monk',
    source: SRD,
    hitDie: 8,
    primaryAbility: ['dex', 'wis'],
    savingThrowProficiencies: ['str', 'dex'],
    armorProficiencies: [],
    weaponProficiencies: ['Simple weapons', 'Shortswords'],
    toolProficiencies: ['One artisan’s tool or musical instrument'],
    skillChoices: { count: 2, options: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
    startingEquipment: ['shortsword', 'dungeoneers-pack', '10 darts'],
    subclassLevel: 3,
    // 2024 rules renamed Ki to "Focus Points" (same mechanic: fuels Flurry of
    // Blows, Patient Defense, Step of the Wind, Stunning Strike, etc.), and
    // changed its value from a fixed table to simply "equal to your monk
    // level."
    resources: [resource('focus-points', 'Focus Points', 'short', linearFromLevel(2), true)],
    features: [
      feat(1, 'Unarmored Defense', 'While not wearing armor or shield, AC = 10 + Dex modifier + Wis modifier.'),
      feat(1, 'Martial Arts', 'Use Dex for unarmed strikes/monk weapons; unarmed strike die scales with level; bonus action unarmed strike.'),
      feat(2, 'Focus', 'You have Focus Points (equal to your monk level) to fuel Flurry of Blows, Patient Defense, and Step of the Wind. Regain all expended points on a short or long rest.'),
      feat(2, 'Uncanny Metabolism', 'When you roll Initiative, you can regain all expended Focus Points, and roll your Martial Arts die to regain that many hit points plus your monk level. Usable once per long rest.'),
      feat(2, 'Unarmored Movement', 'Your speed increases while not wearing armor or a shield.'),
      feat(3, 'Monastic Tradition', 'Choose a subclass that grants features at 3rd, 6th, 11th, and 17th level.'),
      feat(3, 'Deflect Missiles', 'Use your reaction to deflect or catch a ranged weapon attack, reducing damage.'),
      feat(4, 'Slow Fall', 'Use your reaction to reduce falling damage.'),
      feat(5, 'Extra Attack', 'You can attack twice, instead of once, whenever you take the Attack action.'),
      feat(5, 'Stunning Strike', 'When you hit with a melee weapon attack, spend 1 Focus Point to attempt to stun the target.'),
      feat(6, 'Ki-Empowered Strikes', 'Your unarmed strikes count as magical for overcoming resistance/immunity.'),
      feat(7, 'Evasion', 'On a Dex save for half damage, take no damage on success and half on failure.'),
      feat(7, 'Stillness of Mind', 'Use your action to end one effect on yourself causing you to be charmed or frightened.'),
      feat(9, 'Unarmored Movement Improvement', 'You can move along vertical surfaces and across liquids without falling.'),
      feat(10, 'Purity of Body', 'You are immune to disease and poison.'),
      feat(13, 'Tongue of the Sun and Moon', 'You understand all spoken languages, and any creature that understands a language understands you.'),
      feat(14, 'Diamond Soul', 'You are proficient in all saving throws; spend 1 Focus Point to reroll a failed save.'),
      feat(15, 'Timeless Body', 'You no longer suffer penalties from aging and don’t need food or water.'),
      feat(18, 'Empty Body', 'Spend 4 Focus Points to become invisible for 1 minute; spend 8 to cast astral projection.'),
      feat(20, 'Perfect Self', 'When you roll initiative with no Focus Points left, you regain 4 Focus Points.'),
    ],
    subclasses: [
      {
        key: 'open-hand',
        name: 'Way of the Open Hand',
        features: [
          feat(3, 'Open Hand Technique', 'When you hit with Flurry of Blows, choose one: the target must save or be knocked prone, pushed 15 feet, or can’t take reactions until your next turn.'),
          feat(6, 'Wholeness of Body', 'Use your action to regain hit points equal to three times your monk level (once per long rest).'),
          feat(11, 'Tranquility', 'At the end of a long rest, you gain the effect of a sanctuary spell until your next long rest.'),
          feat(17, 'Quivering Palm', 'Spend 3 ki to set up lethal vibrations in a creature you hit; later, use an action to force a Constitution save or the target drops to 0 hit points (or takes 10d10 necrotic damage on a success).'),
        ],
      },
      {
        key: 'shadow',
        name: 'Way of Shadow',
        features: [
          feat(3, 'Shadow Arts', 'Spend 2 ki to cast darkness, darkvision, pass without trace, or silence without material components.'),
          feat(6, 'Shadow Step', 'When in dim light or darkness, teleport up to 60 feet to an unoccupied space you can see, and gain advantage on your next melee attack that turn.'),
          feat(11, 'Cloak of Shadows', 'When in dim light or darkness, use your action to become invisible until you take an action, a reaction, or are in bright light.'),
          feat(17, 'Opportunist', 'When a creature within 5 feet is hit by an attack from someone other than you, use your reaction to make a melee attack against that creature.'),
        ],
      },
      {
        key: 'mercy',
        name: 'Way of Mercy',
        features: [
          feat(3, 'Implements of Mercy', 'Gain proficiency with the Medicine and Insight skills (if not already proficient) and a healer’s kit.'),
          feat(3, 'Hand of Healing', 'Spend 1 ki as an action to touch a creature and restore hit points equal to your Martial Arts die + your Wisdom modifier.'),
          feat(3, 'Hand of Harm', 'Spend 1 ki when you hit with an unarmed strike to deal extra necrotic damage.'),
          feat(6, 'Physician’s Touch', 'Your Hand of Healing can also end one disease or condition; your Hand of Harm can also give the target disadvantage on its next save.'),
          feat(11, 'Flurry of Healing and Harm', 'Use Hand of Healing as part of your Flurry of Blows, using ki only once.'),
          feat(17, 'Hand of Ultimate Mercy', 'Once per long rest, spend 5 ki to return a creature that died within the last day to life with a small pool of hit points.'),
        ],
      },
      {
        key: 'elements',
        name: 'Way of the Elements',
        features: [
          feat(3, 'Elemental Attunement', 'Spend ki to create minor elemental effects, and learn to spend ki to manifest an elemental discipline (such as Fangs of the Fire Snake or Rush of the Gale Spirits).'),
          feat(6, 'Elemental Burst', 'Your elemental disciplines can now affect a wider area and deal more damage as you spend more ki.'),
          feat(11, 'Stronger Elemental Attunement', 'Learn an additional elemental discipline, and your existing disciplines grow more potent.'),
          feat(17, 'Master of the Elements', 'Your mastery of the elements lets you manifest two disciplines at once by spending a bonus action alongside your normal ki expenditure.'),
        ],
      },
    ],
  },

  paladin: {
    key: 'paladin',
    name: 'Paladin',
    source: SRD,
    hitDie: 10,
    primaryAbility: ['str', 'cha'],
    savingThrowProficiencies: ['wis', 'cha'],
    armorProficiencies: ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'],
    weaponProficiencies: ['Simple weapons', 'Martial weapons'],
    toolProficiencies: [],
    skillChoices: { count: 2, options: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
    startingEquipment: ['chainmail', 'longsword', 'shield', 'priests-pack', '5 javelins'],
    subclassLevel: 3,
    resources: [
      resource('lay-on-hands', 'Lay on Hands', 'long', multipleOfLevel(1, 5), true),
      resource('channel-divinity', 'Channel Divinity', 'short-partial', levelTable(3, 2, 11, 3)),
    ],
    features: [
      feat(1, 'Divine Sense', 'As a bonus action, open your awareness to detect celestials, fiends, and undead within 60 feet for 10 minutes (or until incapacitated); you also detect consecrated/desecrated places and objects in that radius. Usable 1 + Cha modifier times per long rest.'),
      feat(1, 'Lay on Hands', 'A pool of healing power equal to 5 × paladin level. As a bonus action, touch a creature (including yourself) to restore hit points from the pool, or spend 5 points from it to cure one disease or neutralize one poison affecting it.'),
      feat(1, 'Spellcasting', 'You can cast paladin spells using Charisma; some of your spells (from your Sacred Oath) are always prepared and don’t count against your normal prepared total.'),
      feat(1, 'Weapon Mastery', 'You can use the mastery property of two kinds of weapons you are proficient with; you can swap one of those choices whenever you finish a long rest.'),
      feat(2, 'Fighting Style', 'Adopt a particular style of fighting as your specialty.'),
      feat(2, "Paladin's Smite", 'Divine Smite is now a spell that’s always prepared for you, and you can cast it once without expending a spell slot (regaining that free use on a long rest).'),
      feat(3, 'Divine Health', 'You are immune to disease.'),
      feat(3, 'Channel Divinity', 'Channel divine energy to fuel magical effects granted by your Sacred Oath. 2 uses starting at level 3 (3 at level 11); regain one use on a short rest, all uses on a long rest.'),
      feat(3, 'Sacred Oath', 'Choose a subclass that grants features at 3rd, 7th, 15th, and 20th level, plus oath spells always prepared for you.'),
      feat(5, 'Extra Attack', 'You can attack twice, instead of once, whenever you take the Attack action.'),
      feat(5, 'Faithful Steed', 'You can cast Find Steed without expending a spell slot, once per long rest (or by spending a spell slot).'),
      feat(6, 'Aura of Protection', 'You and friendly creatures within 10 feet add your Cha modifier (minimum +1) to saving throws.'),
      feat(9, 'Abjure Foes', 'As an action, force creatures of your choice within 60 feet to make a Wisdom save or be frightened and have their speed reduced to 0 for 1 minute (repeats save each turn). Usable once per long rest (or by spending a spell slot of 3rd level or higher).'),
      feat(10, 'Aura of Courage', 'You and friendly creatures within 10 feet can’t be frightened while you are conscious.'),
      feat(11, 'Radiant Strikes', 'Your melee weapon and unarmed strike attacks deal an extra 1d8 radiant damage.'),
      feat(14, 'Restoring Touch', 'Your Lay on Hands can also end one condition on the target — Blinded, Charmed, Deafened, Frightened, Paralyzed, or Stunned — for 5 points spent from the pool per condition, on the same touch that restores hit points.'),
      feat(18, 'Aura Expansion', 'The range of your Aura of Protection and Aura of Courage increases to 30 feet.'),
    ],
    subclasses: [
      {
        key: 'devotion',
        name: 'Oath of Devotion',
        bonusSpells: [
          { level: 3, spellKeys: ['protection-from-evil-and-good', 'shield-of-faith'] },
          { level: 5, spellKeys: ['aid', 'zone-of-truth'] },
          { level: 9, spellKeys: ['beacon-of-hope', 'dispel-magic'] },
          { level: 13, spellKeys: ['freedom-of-movement', 'guardian-of-faith'] },
          { level: 17, spellKeys: ['commune', 'flame-strike'] },
        ],
        features: [
          feat(3, 'Channel Divinity: Sacred Weapon', 'Expend a Channel Divinity to add your Charisma modifier to attack rolls with one weapon for 10 minutes, and the weapon emits bright light and counts as magical.'),
          feat(3, 'Channel Divinity: Turn the Unholy', 'Expend a Channel Divinity to force fiends and undead within 30 feet to make a Wisdom save or be turned for 1 minute.'),
          feat(7, 'Aura of Devotion', 'You and friendly creatures within 10 feet (30 feet once you have Aura Expansion) can’t be charmed while you are conscious.'),
          feat(15, 'Purity of Spirit', 'You are always under the effect of a protection from evil and good spell.'),
          feat(20, 'Holy Nimbus', 'As a bonus action, emanate sunlight for 1 minute that deals 10 radiant damage to hostile creatures that start their turn within 30 feet, gives you advantage on saving throws against spells cast by fiends/undead, and sheds bright light. Usable once per long rest.'),
        ],
      },
      {
        key: 'ancients',
        name: 'Oath of the Ancients',
        bonusSpells: [
          { level: 3, spellKeys: ['ensnaring-strike', 'speak-with-animals'] },
          { level: 5, spellKeys: ['misty-step', 'moonbeam'] },
          { level: 9, spellKeys: ['plant-growth', 'protection-from-energy'] },
          { level: 13, spellKeys: ['ice-storm', 'stoneskin'] },
          { level: 17, spellKeys: ['commune-with-nature', 'tree-stride'] },
        ],
        features: [
          feat(3, 'Channel Divinity: Nature’s Wrath', 'Expend a Channel Divinity to summon spectral vines that restrain a creature within 10 feet unless it succeeds on a Strength or Dexterity save.'),
          feat(3, 'Channel Divinity: Turn the Faithless', 'Expend a Channel Divinity to force fey and fiends within 30 feet to make a Wisdom save or be turned for 1 minute.'),
          feat(7, 'Aura of Warding', 'You and friendly creatures within 10 feet (30 feet once you have Aura Expansion) have resistance to damage from spells.'),
          feat(15, 'Undying Sentinel', 'When reduced to 0 hit points and not killed outright, you can drop to 1 hit point instead (once per long rest); you also no longer suffer the frailty of old age and can’t be aged magically.'),
          feat(20, 'Elder Champion', 'As a bonus action, transform for 1 minute into an ancient force of nature: regain 10 hit points at the start of each of your turns, cast your paladin spells as a bonus action, and force enemies within 10 feet of you to have disadvantage on saving throws against your paladin spells and Channel Divinity options. Usable once per long rest.'),
        ],
      },
      {
        key: 'vengeance',
        name: 'Oath of Vengeance',
        bonusSpells: [
          { level: 3, spellKeys: ['bane', 'hunters-mark'] },
          { level: 5, spellKeys: ['hold-person', 'misty-step'] },
          { level: 9, spellKeys: ['haste', 'protection-from-energy'] },
          { level: 13, spellKeys: ['banishment', 'dimension-door'] },
          { level: 17, spellKeys: ['hold-monster', 'scrying'] },
        ],
        features: [
          feat(3, 'Channel Divinity: Abjure Enemy', 'Expend a Channel Divinity to force a creature within 60 feet to make a Wisdom save or be frightened and have its speed reduced to 0 for 1 minute (repeats save each turn).'),
          feat(3, 'Channel Divinity: Vow of Enmity', 'Expend a Channel Divinity as a bonus action to gain advantage on attack rolls against one creature within 10 feet for 1 minute.'),
          feat(7, 'Relentless Avenger', 'When you hit a creature with an opportunity attack, you can move up to half your speed as part of the same reaction, without provoking opportunity attacks from the target.'),
          feat(15, 'Soul of Vengeance', 'When a creature under your Vow of Enmity makes an attack, you can use your reaction to make a melee weapon attack against it, provided it’s within range.'),
          feat(20, 'Avenging Angel', 'As a bonus action, transform for 1 hour, sprouting wings that grant a 60-foot flying speed; enemies of your choice within 30 feet when you transform must succeed a Wisdom save or be frightened of you for the duration. Usable once per long rest.'),
        ],
      },
      {
        key: 'glory',
        name: 'Oath of Glory',
        bonusSpells: [
          { level: 3, spellKeys: ['guiding-bolt', 'heroism'] },
          { level: 5, spellKeys: ['enhance-ability', 'magic-weapon'] },
          { level: 9, spellKeys: ['haste', 'protection-from-energy'] },
          { level: 13, spellKeys: ['compulsion', 'freedom-of-movement'] },
          { level: 17, spellKeys: ['legend-lore'] },
        ],
        features: [
          feat(3, 'Channel Divinity: Peerless Athlete', 'Expend a Channel Divinity as a bonus action to gain advantage on Strength, Dexterity, and Constitution checks, and double your jump distance, for 1 hour.'),
          feat(3, 'Channel Divinity: Inspiring Smite', 'Immediately after you cast Divine Smite, you can expend a Channel Divinity to distribute 2d8 + your paladin level in temporary hit points among creatures of your choice within 30 feet (yourself included), no action required.'),
          feat(7, 'Aura of Alacrity', 'Your walking speed increases by 10 feet. In addition, whenever a friendly creature enters your Aura of Protection for the first time on a turn or starts its turn there, that creature’s speed increases by 10 feet until the end of its next turn.'),
          feat(15, 'Glorious Defense', 'When you or a creature you can see within 10 feet of you is hit by an attack, you can take a reaction to grant a bonus to the target’s AC equal to your Charisma modifier (minimum +1), potentially causing the attack to miss; if it misses, you can make one weapon attack against the attacker if it’s in range. Usable a number of times equal to your Charisma modifier (minimum once) per long rest.'),
          feat(20, 'Living Legend', 'As a bonus action, for 1 minute you gain advantage on all Charisma checks, can turn one missed attack per turn into a hit, and can use your reaction to reroll a failed saving throw. Usable once per long rest.'),
        ],
      },
    ],
    spellcasting: {
      ability: 'cha',
      progression: 'half',
      slotTable: toSlotTable(HALF_CASTER_SLOTS),
      preparedCasterAbilityMod: true,
    },
  },

  ranger: {
    key: 'ranger',
    name: 'Ranger',
    source: SRD,
    hitDie: 10,
    primaryAbility: ['dex', 'wis'],
    savingThrowProficiencies: ['str', 'dex'],
    armorProficiencies: ['Light armor', 'Medium armor', 'Shields'],
    weaponProficiencies: ['Simple weapons', 'Martial weapons'],
    toolProficiencies: [],
    skillChoices: { count: 3, options: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
    startingEquipment: ['scalemail', 'shortsword', 'shortsword', 'longbow', 'dungeoneers-pack'],
    subclassLevel: 3,
    features: [
      feat(1, 'Favored Enemy', 'You have significant experience with a type of enemy: advantage on tracking and recalling information.'),
      feat(1, 'Natural Explorer', 'You are particularly familiar with one type of natural environment.'),
      feat(1, 'Weapon Mastery', 'You can use the mastery property of two kinds of weapons you are proficient with; you can swap one of those choices whenever you finish a long rest.'),
      feat(2, 'Fighting Style', 'Adopt a particular style of fighting as your specialty.'),
      feat(2, 'Spellcasting', 'You can cast ranger spells using Wisdom.'),
      feat(3, 'Ranger Archetype', 'Choose a subclass that grants features at 3rd, 7th, 11th, and 15th level.'),
      feat(3, 'Primeval Awareness', 'Expend a spell slot to sense whether certain types of creatures are present nearby.'),
      feat(5, 'Extra Attack', 'You can attack twice, instead of once, whenever you take the Attack action.'),
      feat(6, 'Favored Enemy Improvement', 'Add a favored enemy, and gain a language of its associated race.'),
      feat(8, 'Land’s Stride', 'Moving through nonmagical difficult terrain costs no extra movement.'),
      feat(10, 'Natural Explorer Improvement', 'Choose an additional favored terrain.'),
      feat(14, 'Vanish', 'You can use the Hide action as a bonus action, and can’t be tracked non-magically.'),
      feat(18, 'Feral Senses', 'You gain preternatural senses that help you fight creatures you can’t see.'),
      feat(20, 'Foe Slayer', 'Add your Wisdom modifier to an attack roll or damage roll against a favored enemy once per turn.'),
    ],
    subclasses: [
      {
        key: 'hunter',
        name: 'Hunter',
        features: [
          feat(3, 'Hunter’s Prey', 'Choose a combat option: Colossus Slayer (extra 1d8 damage once per turn to a wounded target), Giant Killer, or Horde Breaker.'),
          feat(7, 'Defensive Tactics', 'Choose a defensive option: Escape the Horde, Multiattack Defense, or Steel Will.'),
          feat(11, 'Multiattack', 'Choose Volley (attack every creature in a 10-foot radius within range) or Whirlwind Attack (attack every creature within 5 feet).'),
          feat(15, 'Superior Hunter’s Defense', 'Choose Evasion, Stand Against the Tide, or Uncanny Dodge.'),
        ],
      },
      {
        key: 'beast-master',
        name: 'Beast Master',
        features: [
          feat(3, 'Ranger’s Companion', 'Gain a beast companion that fights alongside you and obeys your commands.'),
          feat(7, 'Exceptional Training', 'Your companion can take the Dash, Disengage, Dodge, or Help action on your turn instead of attacking, and its attacks count as magical.'),
          feat(11, 'Bestial Fury', 'Your companion can make two attacks when you command it to attack.'),
          feat(15, 'Share Spells', 'When you cast a spell targeting yourself, you can also affect your companion if it’s within 30 feet.'),
        ],
      },
      {
        key: 'fey-wanderer',
        name: 'Fey Wanderer',
        features: [
          feat(3, 'Dreadful Strikes', 'Once per turn, your weapon attacks deal an extra 1d4 psychic damage.'),
          feat(3, 'Otherworldly Glamour', 'Gain proficiency in a Charisma skill and add your Wisdom modifier to Charisma checks.'),
          feat(7, 'Beguiling Twist', 'You and nearby allies have advantage on saves against being charmed or frightened, and you can turn a failed save into a success for a creature.'),
          feat(11, 'Fey Reinforcements', 'Cast Summon Fey once without a spell slot per long rest.'),
          feat(15, 'Misty Wanderer', 'Cast Misty Step without a spell slot, and can bring a willing creature with you.'),
        ],
      },
      {
        key: 'gloom-stalker',
        name: 'Gloom Stalker',
        features: [
          feat(3, 'Dread Ambusher', 'You gain extra speed and a bonus attack dealing extra damage on the first turn of combat, and you gain darkvision (or increased range).'),
          feat(3, 'Umbral Sight', 'You gain darkvision, or increase your existing darkvision by 30 feet, and you are invisible to darkvision-based sight in darkness.'),
          feat(7, 'Iron Mind', 'Gain proficiency in Wisdom saving throws (or another save if already proficient).'),
          feat(11, 'Stalker’s Flurry', 'Once per turn when you miss with an attack, you can make another weapon attack as part of the same action.'),
          feat(15, 'Shadowy Dodge', 'When a creature you can see attacks you, use your reaction to impose disadvantage on the roll.'),
        ],
      },
    ],
    spellcasting: {
      ability: 'wis',
      progression: 'half',
      spellsKnownTable: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
      slotTable: toSlotTable(HALF_CASTER_SLOTS),
    },
  },

  rogue: {
    key: 'rogue',
    name: 'Rogue',
    source: SRD,
    hitDie: 8,
    primaryAbility: ['dex'],
    savingThrowProficiencies: ['dex', 'int'],
    armorProficiencies: ['Light armor'],
    weaponProficiencies: ['Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    toolProficiencies: ["Thieves' tools"],
    skillChoices: { count: 4, options: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
    startingEquipment: ['rapier', 'shortbow', 'burglars-pack', 'leather', 'dagger', 'dagger', 'thieves-tools'],
    subclassLevel: 3,
    features: [
      feat(1, 'Expertise', 'Choose two skill proficiencies (or one skill and thieves’ tools); double your proficiency bonus for them.'),
      feat(1, 'Sneak Attack', 'Deal extra damage (scales with level) once per turn when you have advantage or an ally is within 5 feet of the target.'),
      feat(1, 'Thieves’ Cant', 'You know thieves’ cant, a secret mix of dialect, jargon, and code.'),
      feat(1, 'Weapon Mastery', 'You can use the mastery property of one kind of weapon you are proficient with (Simple weapons, or a Martial weapon with Finesse or Light); you can swap this choice whenever you finish a long rest.'),
      feat(2, 'Cunning Action', 'Use a bonus action to Dash, Disengage, or Hide.'),
      feat(3, 'Roguish Archetype', 'Choose a subclass that grants features at 3rd, 9th, 13th, and 17th level.'),
      feat(5, 'Uncanny Dodge', 'Use your reaction to halve the damage of an attack that hits you.'),
      feat(7, 'Evasion', 'On a Dex save for half damage, take no damage on success and half on failure.'),
      feat(11, 'Reliable Talent', 'Treat a d20 roll of 9 or lower as a 10 for ability checks with proficiency.'),
      feat(14, 'Blindsense', 'You are aware of the location of hidden or invisible creatures within 10 feet.'),
      feat(15, 'Slippery Mind', 'You gain proficiency in Wisdom saving throws.'),
      feat(18, 'Elusive', 'No attack roll has advantage against you while you aren’t incapacitated.'),
      feat(20, 'Stroke of Luck', 'Turn a missed attack into a hit, or a failed ability check into a 20, once per short/long rest.'),
    ],
    subclasses: [
      {
        key: 'thief',
        name: 'Thief',
        features: [
          feat(3, 'Fast Hands', 'Use the bonus action granted by Cunning Action to make a Sleight of Hand check, use thieves’ tools, or take the Use an Object action.'),
          feat(3, 'Second-Story Work', 'Climbing no longer costs extra movement, and your running jump distance increases by your Dexterity modifier in feet.'),
          feat(9, 'Supreme Sneak', 'Advantage on Stealth checks if you move no more than half your speed on the same turn.'),
          feat(13, 'Use Magic Device', 'Ignore all class, race, and level requirements on the use of magic items.'),
          feat(17, 'Thief’s Reflexes', 'Take two turns during the first round of combat: one at your normal initiative and one at initiative minus 10.'),
        ],
      },
      {
        key: 'assassin',
        name: 'Assassin',
        features: [
          feat(3, 'Bonus Proficiencies', 'Gain proficiency with the disguise kit and poisoner’s kit.'),
          feat(3, 'Assassinate', 'You have advantage on attack rolls against any creature that hasn’t acted yet in combat, and any hit you score against a surprised creature is a critical hit.'),
          feat(9, 'Infiltration Expertise', 'Spend 7 days and 25 gp to establish a false identity, complete with documentation and contacts.'),
          feat(13, 'Impostor', 'Perfectly mimic another person’s speech, writing, and behavior after studying them closely.'),
          feat(17, 'Death Strike', 'When you attack a surprised creature and hit, it must make a Constitution save or take double damage from the attack.'),
        ],
      },
      {
        key: 'arcane-trickster',
        name: 'Arcane Trickster',
        features: [
          feat(3, 'Spellcasting', 'Learn to cast wizard spells (primarily enchantment and illusion), using Intelligence as your spellcasting ability.'),
          feat(3, 'Mage Hand Legerdemain', 'Your mage hand cantrip becomes invisible, and you can use it to stow/retrieve small items, pick locks, and disarm traps at range.'),
          feat(9, 'Magical Ambush', 'If you are hidden from a creature when you cast a spell on it, it has disadvantage on any save against the spell.'),
          feat(13, 'Versatile Trickster', 'Use your mage hand to distract a target, giving you advantage on attack rolls against it this turn.'),
          feat(17, 'Spell Thief', 'When a creature you can see casts a spell targeting you, you can use your reaction to force a save; on a failure, the spell has no effect on you and you steal it, able to cast it once yourself.'),
        ],
      },
      {
        key: 'soulknife',
        name: 'Soulknife',
        features: [
          feat(3, 'Psionic Power', 'Manifest a pair of psychic blades usable as a melee or thrown weapon (1d6 psychic damage), fueled by Psionic Energy dice usable for Psychic Whispers (telepathy) and Psi-Bolstered Knack (reroll a failed check).'),
          feat(3, 'Psychic Whispers', 'Telepathically communicate with creatures you can see within 60 feet for a limited time after a rest.'),
          feat(9, 'Soul Blades', 'Gain the Homing Strikes option (reroll a missed psychic blade attack) and Psychic Teleportation (teleport to where a thrown psychic blade lands).'),
          feat(13, 'Psychic Veil', 'Turn invisible for up to 1 hour, once per long rest (or by spending Psionic Energy dice).'),
          feat(17, 'Rend Mind', 'When you hit a creature with a psychic blade, it must save or be stunned for 1 minute.'),
        ],
      },
    ],
  },

  sorcerer: {
    key: 'sorcerer',
    name: 'Sorcerer',
    source: SRD,
    hitDie: 6,
    primaryAbility: ['cha'],
    savingThrowProficiencies: ['con', 'cha'],
    armorProficiencies: [],
    weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'],
    toolProficiencies: [],
    skillChoices: { count: 2, options: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
    startingEquipment: ['light-crossbow', 'component-pouch', 'dungeoneers-pack', 'dagger', 'dagger'],
    subclassLevel: 3,
    resources: [resource('sorcery-points', 'Sorcery Points', 'long', linearFromLevel(2), true)],
    features: [
      feat(1, 'Spellcasting', 'You can cast sorcerer spells using Charisma.'),
      feat(1, 'Innate Sorcery', 'As a bonus action, you can surge with sorcery for 1 minute, gaining +1 to your spell save DC and advantage on spell attack rolls. Usable twice per long rest.'),
      feat(2, 'Font of Magic', 'You gain sorcery points (equal to your sorcerer level) you can use to create spell slots or fuel metamagic. Regain all expended points on a long rest.'),
      feat(3, 'Metamagic', 'Choose two metamagic options to modify your spells (Twinned, Quickened, Careful, etc).'),
      feat(3, 'Sorcerous Origin', 'Choose a subclass that grants features at 3rd, 6th, 14th, and 18th level.'),
      feat(10, 'Metamagic', 'Choose one additional metamagic option.'),
      feat(17, 'Metamagic', 'Choose one additional metamagic option.'),
      feat(20, 'Sorcerous Restoration', 'Regain 4 expended sorcery points whenever you finish a short rest.'),
    ],
    subclasses: [
      {
        key: 'draconic',
        name: 'Draconic Bloodline',
        features: [
          feat(3, 'Dragon Ancestor', 'Choose a dragon type; you can speak, read, and write Draconic, and creatures find you charming or intimidating based on that dragon’s reputation.'),
          feat(3, 'Draconic Resilience', 'Your hit point maximum increases by 1 per sorcerer level, and your AC becomes 13 + Dex modifier when not wearing armor.'),
          feat(6, 'Elemental Affinity', 'When you cast a spell dealing damage of your draconic type, add your Charisma modifier to one damage roll; you can also spend 1 sorcery point for resistance to that damage type for 1 hour.'),
          feat(14, 'Dragon Wings', 'Sprout dragon wings as a bonus action, granting a flying speed equal to your current speed.'),
          feat(18, 'Draconic Presence', 'Spend 5 sorcery points to exude an aura of awe or fear (your choice) in a 60-foot radius for 1 minute; enemies must save or be charmed/frightened.'),
        ],
      },
      {
        key: 'wild-magic',
        name: 'Wild Magic',
        features: [
          feat(3, 'Wild Magic Surge', 'After you cast a sorcerer spell of 1st level or higher, the DM can have you roll on the Wild Magic Surge table to trigger a random magical effect.'),
          feat(3, 'Tides of Chaos', 'Gain advantage on one attack roll, ability check, or saving throw, at the cost of risking another Wild Magic Surge (recharges on a long rest).'),
          feat(6, 'Bend Luck', 'Spend 2 sorcery points to add or subtract 1d4 from another creature’s attack roll, ability check, or saving throw.'),
          feat(14, 'Controlled Chaos', 'Roll twice on the Wild Magic Surge table and choose which result to apply.'),
          feat(18, 'Spell Bombardment', 'When you roll damage for a spell and roll the maximum on a die, roll that die again and add it to the damage.'),
        ],
      },
      {
        key: 'aberrant-mind',
        name: 'Aberrant Mind',
        features: [
          feat(3, 'Psionic Spells', 'Learn additional spells (such as Mind Sliver, Dissonant Whispers, Detect Thoughts, Telekinesis) that don’t count against your spells known.'),
          feat(3, 'Telepathic Speech', 'Telepathically speak to a creature you can see within 30 feet, and it can reply in kind, for the duration of the conversation.'),
          feat(6, 'Psionic Sorcery', 'Cast your Psionic Spells feature’s spells by spending sorcery points equal to the spell’s level instead of a spell slot, requiring no verbal, somatic, or (unless consumed) material components.'),
          feat(6, 'Psychic Defenses', 'You gain resistance to psychic damage, and advantage on saving throws against being charmed or frightened.'),
          feat(14, 'Revelation in Flesh', 'Spend up to 4 sorcery points to warp your body for 10 minutes; for each point spent, choose one: a flying speed, a swim speed, seeing invisible creatures, or squeezing through narrow spaces and escaping restraints.'),
          feat(18, 'Warping Implosion', 'As an action, teleport up to 120 feet; creatures within 30 feet of the space you left must save or take 3d10 force damage and be pulled toward that space. Usable once per long rest (or for 5 sorcery points).'),
        ],
      },
      {
        key: 'clockwork-soul',
        name: 'Clockwork Soul',
        features: [
          feat(3, 'Clockwork Magic', 'Learn additional spells (such as Alarm, Protection from Evil and Good, Dispel Magic) that don’t count against your spells known.'),
          feat(3, 'Restore Balance', 'When a creature within 60 feet is about to roll with advantage or disadvantage, you can use your reaction to negate that. Usable a number of times equal to your proficiency bonus per long rest.'),
          feat(6, 'Bastion of Law', 'As an action, spend 1-5 sorcery points to grant yourself or a creature within 30 feet a shield of d8s (one per point spent) that can be expended to reduce damage taken.'),
          feat(14, 'Trance of Order', 'As a bonus action, for 1 minute attack rolls against you can’t benefit from advantage, and you can treat a d20 roll of 9 or lower as a 10 for your own attack rolls, ability checks, and saves. Usable once per long rest (or for 5 sorcery points).'),
          feat(18, 'Clockwork Cavalcade', 'Summon a burst of clockwork magic in a 30-foot cube that restores up to 100 hit points (divided as you choose), repairs objects/constructs, and ends spells of 6th level or lower on creatures you choose.'),
        ],
      },
    ],
    spellcasting: {
      ability: 'cha',
      progression: 'full',
      cantripsKnown: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      spellsKnownTable: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
      slotTable: toSlotTable(FULL_CASTER_SLOTS),
    },
  },

  warlock: {
    key: 'warlock',
    name: 'Warlock',
    source: SRD,
    hitDie: 8,
    primaryAbility: ['cha'],
    savingThrowProficiencies: ['wis', 'cha'],
    armorProficiencies: ['Light armor'],
    weaponProficiencies: ['Simple weapons'],
    toolProficiencies: [],
    skillChoices: { count: 2, options: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
    startingEquipment: ['light-crossbow', 'component-pouch', 'scholars-pack', 'leather', 'dagger', 'dagger'],
    subclassLevel: 3,
    features: [
      feat(1, 'Eldritch Invocations', 'Choose invocations that grant you magical abilities; you gain more as you level, and can swap one you know when you gain a warlock level.'),
      feat(1, 'Pact Magic', 'You can cast warlock spells using Charisma; slots recharge on a short rest.'),
      feat(2, 'Magical Cunning', 'As a bonus action, you can regain a small number of expended spell slots by spending 1 minute performing a ritual, once per long rest.'),
      feat(3, 'Otherworldly Patron', 'Choose a subclass that grants features at 3rd, 6th, 10th, and 14th level, plus expanded spells always available for you to learn.'),
      feat(3, 'Pact Boon', 'Choose a boon: Pact of the Chain, Blade, or Tome.'),
      feat(11, 'Mystic Arcanum (6th level)', 'Choose one 6th-level warlock spell you can cast once per long rest without a slot.'),
      feat(13, 'Mystic Arcanum (7th level)', 'Choose one 7th-level warlock spell you can cast once per long rest without a slot.'),
      feat(15, 'Mystic Arcanum (8th level)', 'Choose one 8th-level warlock spell you can cast once per long rest without a slot.'),
      feat(17, 'Mystic Arcanum (9th level)', 'Choose one 9th-level warlock spell you can cast once per long rest without a slot.'),
      feat(20, 'Eldritch Master', 'Regain all expended pact magic spell slots by spending 1 minute entreating your patron.'),
    ],
    subclasses: [
      {
        key: 'fiend',
        name: 'The Fiend',
        features: [
          feat(3, 'Dark One’s Blessing', 'When you reduce a hostile creature to 0 hit points, gain temporary hit points equal to your Charisma modifier + your warlock level.'),
          feat(6, 'Dark One’s Own Luck', 'Add a d10 to one ability check or saving throw you make (limited uses per rest).'),
          feat(10, 'Fiendish Resilience', 'Choose a damage type each short/long rest; you have resistance to it, unless it’s from a magic weapon.'),
          feat(14, 'Hurl Through Hell', 'When you hit a creature with an attack, banish it to the lower planes for a horrifying instant, dealing 10d10 psychic damage (once per long rest).'),
        ],
      },
      {
        key: 'archfey',
        name: 'The Archfey',
        features: [
          feat(3, 'Fey Presence', 'Force each creature in a 10-foot cube to make a Wisdom save or be charmed or frightened until the end of your next turn.'),
          feat(6, 'Misty Escape', 'When you take damage, use your reaction to turn invisible and teleport up to 60 feet away.'),
          feat(10, 'Beguiling Defenses', 'You are immune to being charmed, and can turn the charm effect back on a creature that tries to charm you.'),
          feat(14, 'Dark Delirium', 'Incapacitate a creature with illusion/phantasm, isolating it in a hallucinatory dreamscape for up to 1 minute.'),
        ],
      },
      {
        key: 'great-old-one',
        name: 'The Great Old One',
        features: [
          feat(3, 'Awakened Mind', 'Telepathically communicate with any creature within 30 feet that can understand a language.'),
          feat(6, 'Entropic Ward', 'When a creature attacks you, use your reaction to impose disadvantage on the roll; if it misses, your next attack against it has advantage.'),
          feat(10, 'Thought Shield', 'Your thoughts can’t be read by telepathy unless you allow it, you have resistance to psychic damage, and any creature dealing psychic damage to you takes equal damage back.'),
          feat(14, 'Create Thrall', 'Use your action to charm an incapacitated humanoid indefinitely, and communicate with it telepathically.'),
        ],
      },
      {
        key: 'celestial',
        name: 'The Celestial',
        features: [
          feat(3, 'Bonus Cantrips', 'Learn the Sacred Flame and Light cantrips; they don’t count against your cantrips known.'),
          feat(3, 'Healing Light', 'Gain a pool of d6s you can spend as a bonus action to heal a creature within 60 feet.'),
          feat(6, 'Radiant Soul', 'Add your Charisma modifier to the radiant/fire damage of any spell you cast, and gain resistance to radiant damage.'),
          feat(10, 'Celestial Resilience', 'You and nearby allies gain temporary hit points after a short or long rest.'),
          feat(14, 'Searing Vengeance', 'When reduced to 0 hit points but not killed outright, you can instead rise with half your hit points and unleash radiant energy that damages and blinds nearby enemies.'),
        ],
      },
    ],
    spellcasting: {
      ability: 'cha',
      progression: 'pact',
      cantripsKnown: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      spellsKnownTable: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
      slotTable: pactSlotTable(),
    },
  },

  wizard: {
    key: 'wizard',
    name: 'Wizard',
    source: SRD,
    hitDie: 6,
    primaryAbility: ['int'],
    savingThrowProficiencies: ['int', 'wis'],
    armorProficiencies: [],
    weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'],
    toolProficiencies: [],
    skillChoices: { count: 2, options: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
    startingEquipment: ['quarterstaff', 'component-pouch', 'scholars-pack', 'spellbook'],
    subclassLevel: 3,
    resources: [resource('arcane-recovery', 'Arcane Recovery', 'long', new Array(20).fill(1))],
    features: [
      feat(1, 'Spellcasting', 'You can cast wizard spells using Intelligence, prepared from your spellbook.'),
      feat(1, 'Ritual Adept', 'You can cast any spell in your spellbook that has the ritual tag as a ritual, even if you don’t have it prepared.'),
      feat(1, 'Arcane Recovery', 'Once per day on a short rest, recover expended spell slots with a combined level up to half your wizard level (rounded up).'),
      feat(2, 'Scholar', 'Gain expertise (double proficiency bonus) in one skill of your choice: Arcana, History, Investigation, Medicine, Nature, or Religion.'),
      feat(3, 'Arcane Tradition', 'Choose a subclass that grants features at 3rd, 6th, 10th, and 14th level.'),
      feat(18, 'Spell Mastery', 'Choose a 1st- and 2nd-level spell you can cast at will without expending a slot.'),
      feat(20, 'Signature Spells', 'Choose two 3rd-level spells you always have prepared and can cast once each without a slot per short/long rest.'),
    ],
    subclasses: [
      {
        key: 'evocation',
        name: 'Evoker',
        features: [
          feat(3, 'Evocation Savant', 'The gold and time you must spend to copy an evocation spell into your spellbook is halved.'),
          feat(3, 'Sculpt Spells', 'Choose allies caught in your evocation spells to automatically succeed their saves and take no damage.'),
          feat(6, 'Potent Cantrip', 'When a creature succeeds on a save against your cantrip, it still takes half damage (if the cantrip deals damage).'),
          feat(10, 'Empowered Evocation', 'Add your Intelligence modifier to the damage of one evocation spell you cast.'),
          feat(14, 'Overchannel', 'Deal maximum damage with a 1st–5th level evocation spell instead of rolling, at the risk of taking necrotic damage yourself on repeated uses.'),
        ],
      },
      {
        key: 'abjuration',
        name: 'Abjurer',
        features: [
          feat(3, 'Abjuration Savant', 'The gold and time you must spend to copy an abjuration spell into your spellbook is halved.'),
          feat(3, 'Arcane Ward', 'Casting an abjuration spell creates a shield of magical energy (hit points = 2 × wizard level + Int modifier) that absorbs damage until depleted.'),
          feat(6, 'Projected Ward', 'When a creature you can see takes damage, use your reaction to absorb some of it into your Arcane Ward.'),
          feat(10, 'Improved Abjuration', 'Add your proficiency bonus to any ability check made as part of an abjuration spell you cast.'),
          feat(14, 'Spell Resistance', 'Advantage on saving throws against spells, and resistance to damage from spells.'),
        ],
      },
      {
        key: 'divination',
        name: 'Diviner',
        features: [
          feat(3, 'Divination Savant', 'The gold and time you must spend to copy a divination spell into your spellbook is halved.'),
          feat(3, 'Portent', 'Roll two d20s after a long rest; you can replace any attack roll, ability check, or saving throw made by you or a creature you can see with one of these rolls.'),
          feat(6, 'Expert Divination', 'When you cast a divination spell of 2nd level or higher using a spell slot, regain one expended spell slot of lower level.'),
          feat(10, 'The Third Eye', 'Use your action to gain darkvision, see invisible creatures, read any language, or see the true form of a shapechanged/polymorphed creature, until you use this feature again.'),
          feat(14, 'Greater Portent', 'Roll three d20s for your Portent feature instead of two.'),
        ],
      },
      {
        key: 'illusion',
        name: 'Illusionist',
        features: [
          feat(3, 'Illusion Savant', 'The gold and time you must spend to copy an illusion spell into your spellbook is halved.'),
          feat(3, 'Improved Minor Illusion', 'Learn the Minor Illusion cantrip (or gain a bonus one), and it can create both a sound and an image with a single casting.'),
          feat(6, 'Malleable Illusions', 'You can change the nature of an illusion you’ve already cast, as long as you can see it and spend an action.'),
          feat(10, 'Illusory Self', 'Use your reaction to interpose an illusory duplicate of yourself between you and an attacker, causing the attack to automatically miss.'),
          feat(14, 'Illusory Reality', 'Make one inanimate, nonmagical object within an illusion you’ve created briefly real for a short time.'),
        ],
      },
    ],
    spellcasting: {
      ability: 'int',
      progression: 'full',
      cantripsKnown: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      slotTable: toSlotTable(FULL_CASTER_SLOTS),
      preparedCasterAbilityMod: true,
    },
  },
};
