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
): Item {
  return { key, name, source: SRD, type: 'weapon', cost, damage, damageType, weight, weaponProperties: properties };
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
  battleaxe: weapon('battleaxe', 'Battleaxe', '10 gp', '1d8', 'slashing', 4, ['Versatile (1d10)']),
  flail: weapon('flail', 'Flail', '10 gp', '1d8', 'bludgeoning', 2, []),
  glaive: weapon('glaive', 'Glaive', '20 gp', '1d10', 'slashing', 6, ['Heavy', 'Reach', 'Two-Handed']),
  greataxe: weapon('greataxe', 'Greataxe', '30 gp', '1d12', 'slashing', 7, ['Heavy', 'Two-Handed']),
  greatsword: weapon('greatsword', 'Greatsword', '50 gp', '2d6', 'slashing', 6, ['Heavy', 'Two-Handed']),
  halberd: weapon('halberd', 'Halberd', '20 gp', '1d10', 'slashing', 6, ['Heavy', 'Reach', 'Two-Handed']),
  lance: weapon('lance', 'Lance', '10 gp', '1d12', 'piercing', 6, ['Reach', 'Special']),
  longsword: weapon('longsword', 'Longsword', '15 gp', '1d8', 'slashing', 3, ['Versatile (1d10)']),
  maul: weapon('maul', 'Maul', '10 gp', '2d6', 'bludgeoning', 10, ['Heavy', 'Two-Handed']),
  morningstar: weapon('morningstar', 'Morningstar', '15 gp', '1d8', 'piercing', 4, []),
  pike: weapon('pike', 'Pike', '5 gp', '1d10', 'piercing', 18, ['Heavy', 'Reach', 'Two-Handed']),
  rapier: weapon('rapier', 'Rapier', '25 gp', '1d8', 'piercing', 2, ['Finesse']),
  scimitar: weapon('scimitar', 'Scimitar', '25 gp', '1d6', 'slashing', 3, ['Finesse', 'Light']),
  shortsword: weapon('shortsword', 'Shortsword', '10 gp', '1d6', 'piercing', 2, ['Finesse', 'Light']),
  trident: weapon('trident', 'Trident', '5 gp', '1d6', 'piercing', 4, ['Thrown (20/60)', 'Versatile (1d8)']),
  warhammer: weapon('warhammer', 'Warhammer', '15 gp', '1d8', 'bludgeoning', 2, ['Versatile (1d10)']),
  whip: weapon('whip', 'Whip', '2 gp', '1d4', 'slashing', 3, ['Finesse', 'Reach']),
  // Martial Ranged
  blowgun: weapon('blowgun', 'Blowgun', '10 gp', '1', 'piercing', 1, ['Ammunition (25/100)', 'Loading']),
  'hand-crossbow': weapon('hand-crossbow', 'Crossbow, Hand', '75 gp', '1d6', 'piercing', 3, ['Ammunition (30/120)', 'Light', 'Loading']),
  'heavy-crossbow': weapon('heavy-crossbow', 'Crossbow, Heavy', '50 gp', '1d10', 'piercing', 18, ['Ammunition (100/400)', 'Heavy', 'Loading', 'Two-Handed']),
  longbow: weapon('longbow', 'Longbow', '50 gp', '1d8', 'piercing', 2, ['Ammunition (150/600)', 'Heavy', 'Two-Handed']),

  // Light Armor
  padded: armor('padded', 'Padded', '5 gp', 11, 8, { armorClassAddDex: true, stealthDisadvantage: true }),
  leather: armor('leather', 'Leather', '10 gp', 11, 10, { armorClassAddDex: true }),
  'studded-leather': armor('studded-leather', 'Studded Leather', '45 gp', 12, 13, { armorClassAddDex: true }),
  // Medium Armor
  hide: armor('hide', 'Hide', '10 gp', 12, 12, { armorClassAddDex: true, armorClassMaxDex: 2 }),
  'chain-shirt': armor('chain-shirt', 'Chain Shirt', '50 gp', 13, 20, { armorClassAddDex: true, armorClassMaxDex: 2 }),
  scalemail: armor('scalemail', 'Scale Mail', '50 gp', 14, 45, { armorClassAddDex: true, armorClassMaxDex: 2, stealthDisadvantage: true }),
  breastplate: armor('breastplate', 'Breastplate', '400 gp', 14, 20, { armorClassAddDex: true, armorClassMaxDex: 2 }),
  'half-plate': armor('half-plate', 'Half Plate', '750 gp', 15, 40, { armorClassAddDex: true, armorClassMaxDex: 2, stealthDisadvantage: true }),
  // Heavy Armor
  'ring-mail': armor('ring-mail', 'Ring Mail', '30 gp', 14, 40, { stealthDisadvantage: true }),
  chainmail: armor('chainmail', 'Chain Mail', '75 gp', 16, 55, { strengthRequirement: 13, stealthDisadvantage: true }),
  splint: armor('splint', 'Splint', '200 gp', 17, 60, { strengthRequirement: 15, stealthDisadvantage: true }),
  plate: armor('plate', 'Plate', '1500 gp', 18, 65, { strengthRequirement: 15, stealthDisadvantage: true }),
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
