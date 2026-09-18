import type { Item } from '../../types/compendium';

const SRD = { origin: 'srd' as const, label: 'SRD 5.1' };

function weapon(
  key: string,
  name: string,
  cost: string,
  damage: string,
  damageType: string,
  weight: number,
  properties: string[] = [],
  category: 'simple' | 'martial' = 'simple',
): Item {
  return { key, name, source: SRD, type: 'weapon', cost, damage, damageType, weight, weaponProperties: properties, weaponCategory: category };
}

function armor(
  key: string,
  name: string,
  cost: string,
  ac: number,
  weight: number,
  opts: Partial<Item> = {},
): Item {
  return {
    key,
    name,
    source: SRD,
    type: opts.type ?? 'armor',
    cost,
    armorClassBase: ac,
    weight,
    ...opts,
  };
}

function gear(key: string, name: string, cost: string, weight: number, description?: string): Item {
  return { key, name, source: SRD, type: 'gear', cost, weight, description };
}

function pack(key: string, name: string, cost: string, weight: number, contains: string[]): Item {
  return {
    key,
    name,
    source: SRD,
    type: 'gear',
    cost,
    weight,
    contains,
    description: `A ${name.toLowerCase()} contains: ${contains.join(', ')}.`,
  };
}

export const items: Record<string, Item> = {
  // Simple Melee Weapons
  club: weapon('club', 'Club', '1 sp', '1d4', 'bludgeoning', 2, ['Light']),
  dagger: weapon('dagger', 'Dagger', '2 gp', '1d4', 'piercing', 1, ['Finesse', 'Light', 'Thrown (20/60)']),
  greatclub: weapon('greatclub', 'Greatclub', '2 sp', '1d8', 'bludgeoning', 10, ['Two-Handed']),
  handaxe: weapon('handaxe', 'Handaxe', '5 gp', '1d6', 'slashing', 2, ['Light', 'Thrown (20/60)']),
  javelin: weapon('javelin', 'Javelin', '5 sp', '1d6', 'piercing', 2, ['Thrown (30/120)']),
  'light-hammer': weapon('light-hammer', 'Light Hammer', '2 gp', '1d4', 'bludgeoning', 2, ['Light', 'Thrown (20/60)']),
  mace: weapon('mace', 'Mace', '5 gp', '1d6', 'bludgeoning', 4, []),
  quarterstaff: weapon('quarterstaff', 'Quarterstaff', '2 sp', '1d6', 'bludgeoning', 4, ['Versatile (1d8)']),
  sickle: weapon('sickle', 'Sickle', '1 gp', '1d4', 'slashing', 2, ['Light']),
  spear: weapon('spear', 'Spear', '1 gp', '1d6', 'piercing', 3, ['Thrown (20/60)', 'Versatile (1d8)']),
  // Simple Ranged
  'light-crossbow': weapon('light-crossbow', 'Crossbow, Light', '25 gp', '1d8', 'piercing', 5, ['Ammunition (80/320)', 'Loading', 'Two-Handed']),
  dart: weapon('dart', 'Dart', '5 cp', '1d4', 'piercing', 0.25, ['Finesse', 'Thrown (20/60)']),
  shortbow: weapon('shortbow', 'Shortbow', '25 gp', '1d6', 'piercing', 2, ['Ammunition (80/320)', 'Two-Handed']),
  sling: weapon('sling', 'Sling', '1 sp', '1d4', 'bludgeoning', 0, ['Ammunition (30/120)']),
  // Martial Melee
  battleaxe: weapon('battleaxe', 'Battleaxe', '10 gp', '1d8', 'slashing', 4, ['Versatile (1d10)'], 'martial'),
  flail: weapon('flail', 'Flail', '10 gp', '1d8', 'bludgeoning', 2, [], 'martial'),
  glaive: weapon('glaive', 'Glaive', '20 gp', '1d10', 'slashing', 6, ['Heavy', 'Reach', 'Two-Handed'], 'martial'),
  greataxe: weapon('greataxe', 'Greataxe', '30 gp', '1d12', 'slashing', 7, ['Heavy', 'Two-Handed'], 'martial'),
  greatsword: weapon('greatsword', 'Greatsword', '50 gp', '2d6', 'slashing', 6, ['Heavy', 'Two-Handed'], 'martial'),
  halberd: weapon('halberd', 'Halberd', '20 gp', '1d10', 'slashing', 6, ['Heavy', 'Reach', 'Two-Handed'], 'martial'),
  lance: weapon('lance', 'Lance', '10 gp', '1d12', 'piercing', 6, ['Reach', 'Special'], 'martial'),
  longsword: weapon('longsword', 'Longsword', '15 gp', '1d8', 'slashing', 3, ['Versatile (1d10)'], 'martial'),
  maul: weapon('maul', 'Maul', '10 gp', '2d6', 'bludgeoning', 10, ['Heavy', 'Two-Handed'], 'martial'),
  morningstar: weapon('morningstar', 'Morningstar', '15 gp', '1d8', 'piercing', 4, [], 'martial'),
  pike: weapon('pike', 'Pike', '5 gp', '1d10', 'piercing', 18, ['Heavy', 'Reach', 'Two-Handed'], 'martial'),
  rapier: weapon('rapier', 'Rapier', '25 gp', '1d8', 'piercing', 2, ['Finesse'], 'martial'),
  scimitar: weapon('scimitar', 'Scimitar', '25 gp', '1d6', 'slashing', 3, ['Finesse', 'Light'], 'martial'),
  shortsword: weapon('shortsword', 'Shortsword', '10 gp', '1d6', 'piercing', 2, ['Finesse', 'Light'], 'martial'),
  trident: weapon('trident', 'Trident', '5 gp', '1d6', 'piercing', 4, ['Thrown (20/60)', 'Versatile (1d8)'], 'martial'),
  warhammer: weapon('warhammer', 'Warhammer', '15 gp', '1d8', 'bludgeoning', 2, ['Versatile (1d10)'], 'martial'),
  whip: weapon('whip', 'Whip', '2 gp', '1d4', 'slashing', 3, ['Finesse', 'Reach'], 'martial'),
  // Martial Ranged
  blowgun: weapon('blowgun', 'Blowgun', '10 gp', '1', 'piercing', 1, ['Ammunition (25/100)', 'Loading'], 'martial'),
  'hand-crossbow': weapon('hand-crossbow', 'Crossbow, Hand', '75 gp', '1d6', 'piercing', 3, ['Ammunition (30/120)', 'Light', 'Loading'], 'martial'),
  'heavy-crossbow': weapon('heavy-crossbow', 'Crossbow, Heavy', '50 gp', '1d10', 'piercing', 18, ['Ammunition (100/400)', 'Heavy', 'Loading', 'Two-Handed'], 'martial'),
  longbow: weapon('longbow', 'Longbow', '50 gp', '1d8', 'piercing', 2, ['Ammunition (150/600)', 'Heavy', 'Two-Handed'], 'martial'),

  // Light Armor
  padded: armor('padded', 'Padded', '5 gp', 11, 8, { armorCategory: 'light', armorClassAddDex: true, stealthDisadvantage: true }),
  leather: armor('leather', 'Leather', '10 gp', 11, 10, { armorCategory: 'light', armorClassAddDex: true }),
  'studded-leather': armor('studded-leather', 'Studded Leather', '45 gp', 12, 13, { armorCategory: 'light', armorClassAddDex: true }),
  // Medium Armor
  hide: armor('hide', 'Hide', '10 gp', 12, 12, { armorCategory: 'medium', armorClassAddDex: true, armorClassMaxDex: 2 }),
  'chain-shirt': armor('chain-shirt', 'Chain Shirt', '50 gp', 13, 20, { armorCategory: 'medium', armorClassAddDex: true, armorClassMaxDex: 2 }),
  scalemail: armor('scalemail', 'Scale Mail', '50 gp', 14, 45, { armorCategory: 'medium', armorClassAddDex: true, armorClassMaxDex: 2, stealthDisadvantage: true }),
  breastplate: armor('breastplate', 'Breastplate', '400 gp', 14, 20, { armorCategory: 'medium', armorClassAddDex: true, armorClassMaxDex: 2 }),
  'half-plate': armor('half-plate', 'Half Plate', '750 gp', 15, 40, { armorCategory: 'medium', armorClassAddDex: true, armorClassMaxDex: 2, stealthDisadvantage: true }),
  // Heavy Armor
  'ring-mail': armor('ring-mail', 'Ring Mail', '30 gp', 14, 40, { armorCategory: 'heavy', stealthDisadvantage: true }),
  chainmail: armor('chainmail', 'Chain Mail', '75 gp', 16, 55, { armorCategory: 'heavy', strengthRequirement: 13, stealthDisadvantage: true }),
  splint: armor('splint', 'Splint', '200 gp', 17, 60, { armorCategory: 'heavy', strengthRequirement: 15, stealthDisadvantage: true }),
  plate: armor('plate', 'Plate', '1500 gp', 18, 65, { armorCategory: 'heavy', strengthRequirement: 15, stealthDisadvantage: true }),
  // Shield
  shield: armor('shield', 'Shield', '10 gp', 2, 6, { type: 'shield' }),

  // Adventuring Gear
  backpack: gear('backpack', 'Backpack', '2 gp', 5),
  bedroll: gear('bedroll', 'Bedroll', '1 gp', 7),
  'rope-hempen': gear('rope-hempen', 'Rope, Hempen (50 ft)', '1 gp', 10),
  'rope-silk': gear('rope-silk', 'Rope, Silk (50 ft)', '10 gp', 5),
  torch: gear('torch', 'Torch', '1 cp', 1),
  rations: gear('rations', "Rations (1 day)", '5 sp', 2),
  waterskin: gear('waterskin', 'Waterskin', '2 sp', 5),
  tinderbox: gear('tinderbox', 'Tinderbox', '5 sp', 1),
  'holy-symbol': gear('holy-symbol', 'Holy Symbol', '5 gp', 1),
  'component-pouch': gear('component-pouch', 'Component Pouch', '25 gp', 2),
  'arcane-focus': gear('arcane-focus', 'Arcane Focus', '10 gp', 1),
  'druidic-focus': gear('druidic-focus', 'Druidic Focus', '10 gp', 0),
  'thieves-tools': { key: 'thieves-tools', name: "Thieves' Tools", source: SRD, type: 'tool', cost: '25 gp', weight: 1 },
  'healers-kit': gear('healers-kit', "Healer's Kit", '5 gp', 3, 'Has 10 uses. Stabilize a creature or restore 1 hp without a Wisdom (Medicine) check.'),
  'climbers-kit': gear('climbers-kit', "Climber's Kit", '25 gp', 12),
  'crowbar': gear('crowbar', 'Crowbar', '2 gp', 5),
  'grappling-hook': gear('grappling-hook', 'Grappling Hook', '2 gp', 4),
  lantern: gear('lantern', 'Lantern, Hooded', '5 gp', 2),
  'oil-flask': gear('oil-flask', 'Oil (flask)', '1 sp', 1),
  'potion-of-healing': { key: 'potion-of-healing', name: 'Potion of Healing', source: SRD, type: 'consumable', cost: '50 gp', weight: 0.5, description: 'Regain 2d4+2 hit points when you drink this potion.' },
  arrows: gear('arrows', 'Arrows (20)', '1 gp', 1),
  bolts: gear('bolts', 'Crossbow Bolts (20)', '1 gp', 1.5),
  bullets: gear('bullets', 'Sling Bullets (20)', '4 cp', 1.5),

  // Equipment Packs
  'burglars-pack': pack('burglars-pack', "Burglar's Pack", '16 gp', 44.5, [
    'Backpack',
    '1,000 ball bearings',
    '10 ft of string',
    'A bell',
    '5 candles',
    'A crowbar',
    'A hammer',
    '10 pitons',
    'A hooded lantern',
    '2 flasks of oil',
    "5 days' rations",
    'A tinderbox',
    'A waterskin',
    '50 ft of hempen rope (coiled)',
  ]),
  'diplomats-pack': pack('diplomats-pack', "Diplomat's Pack", '39 gp', 36, [
    'A chest',
    '2 cases for maps and scrolls',
    'A set of fine clothes',
    'A bottle of ink',
    'An ink pen',
    'A lamp',
    '2 flasks of oil',
    '5 sheets of paper',
    'A vial of perfume',
    'Sealing wax',
    'Soap',
  ]),
  'dungeoneers-pack': pack('dungeoneers-pack', "Dungeoneer's Pack", '12 gp', 61.5, [
    'Backpack',
    'A crowbar',
    'A hammer',
    '10 pitons',
    '10 torches',
    'A tinderbox',
    "10 days' rations",
    'A waterskin',
    '50 ft of hempen rope (coiled)',
  ]),
  'entertainers-pack': pack('entertainers-pack', "Entertainer's Pack", '40 gp', 38, [
    'Backpack',
    'A bedroll',
    '2 costumes',
    '5 candles',
    "5 days' rations",
    'A waterskin',
    'A disguise kit',
  ]),
  'explorers-pack': pack('explorers-pack', "Explorer's Pack", '10 gp', 59, [
    'Backpack',
    'A bedroll',
    'A mess kit',
    'A tinderbox',
    '10 torches',
    "10 days' rations",
    'A waterskin',
    '50 ft of hempen rope (coiled)',
  ]),
  'priests-pack': pack('priests-pack', "Priest's Pack", '19 gp', 24.5, [
    'Backpack',
    'A blanket',
    '10 candles',
    'A tinderbox',
    'An alms box',
    '2 blocks of incense',
    'A censer',
    'Vestments',
    "2 days' rations",
    'A waterskin',
  ]),
  'scholars-pack': pack('scholars-pack', "Scholar's Pack", '40 gp', 11, [
    'Backpack',
    'A book of lore',
    'A bottle of ink',
    'An ink pen',
    '10 sheets of parchment',
    'A little bag of sand',
    'A small knife',
  ]),

  // Tools (musical instruments / gaming sets / artisan)
  'herbalism-kit': { key: 'herbalism-kit', name: 'Herbalism Kit', source: SRD, type: 'tool', cost: '5 gp', weight: 3 },
  'disguise-kit': { key: 'disguise-kit', name: 'Disguise Kit', source: SRD, type: 'tool', cost: '25 gp', weight: 3 },
  'forgery-kit': { key: 'forgery-kit', name: 'Forgery Kit', source: SRD, type: 'tool', cost: '15 gp', weight: 5 },
  'poisoners-kit': { key: 'poisoners-kit', name: "Poisoner's Kit", source: SRD, type: 'tool', cost: '50 gp', weight: 2 },
  bagpipes: { key: 'bagpipes', name: 'Bagpipes', source: SRD, type: 'tool', cost: '30 gp', weight: 6 },
  lute: { key: 'lute', name: 'Lute', source: SRD, type: 'tool', cost: '35 gp', weight: 2 },
  'playing-card-set': { key: 'playing-card-set', name: 'Playing Card Set', source: SRD, type: 'tool', cost: '5 sp', weight: 0 },
  'dice-set': { key: 'dice-set', name: 'Dice Set', source: SRD, type: 'tool', cost: '1 sp', weight: 0 },
  "smiths-tools": { key: 'smiths-tools', name: "Smith's Tools", source: SRD, type: 'tool', cost: '20 gp', weight: 8 },
  "alchemists-supplies": { key: 'alchemists-supplies', name: "Alchemist's Supplies", source: SRD, type: 'tool', cost: '50 gp', weight: 8 },
};
