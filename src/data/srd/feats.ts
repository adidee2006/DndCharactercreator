import type { Feat } from '../../types/compendium';

const SRD = { origin: 'srd' as const, label: 'SRD-style feats' };

export const feats: Record<string, Feat> = {
  alert: {
    key: 'alert',
    name: 'Alert',
    source: SRD,
    description: 'You gain +5 to initiative. You can’t be surprised while you are conscious, and other creatures don’t gain advantage on attack rolls against you as a result of being unseen by you.',
  },
  athlete: {
    key: 'athlete',
    name: 'Athlete',
    source: SRD,
    description: 'Increase Strength or Dexterity by 1. Climbing no longer costs extra movement, you can stand up from prone using only 5 feet of movement, and you gain distance on running long/high jumps.',
    abilityBonusChoice: { abilities: ['str', 'dex'], amount: 1 },
  },
  'dual-wielder': {
    key: 'dual-wielder',
    name: 'Dual Wielder',
    source: SRD,
    description: 'You gain +1 AC while wielding two melee weapons, can two-weapon fight with non-light weapons, and can draw or stow two one-handed weapons at once.',
  },
  durable: {
    key: 'durable',
    name: 'Durable',
    source: SRD,
    description: 'Increase Constitution by 1. When you roll a Hit Die to regain hit points, the minimum result is twice your Constitution modifier.',
    abilityBonusChoice: { abilities: ['con'], amount: 1 },
  },
  'great-weapon-master': {
    key: 'great-weapon-master',
    name: 'Great Weapon Master',
    source: SRD,
    description: 'On a critical hit or reducing a creature to 0 HP with a melee weapon, make one bonus-action melee attack. Before a heavy-weapon melee attack you can take -5 to hit for +10 damage.',
  },
  lucky: {
    key: 'lucky',
    name: 'Lucky',
    source: SRD,
    description: 'You have 3 luck points. Spend one to roll an additional d20 for an attack roll, ability check, or saving throw (yours or against you), and choose which roll to use. Regain after a long rest.',
  },
  mobile: {
    key: 'mobile',
    name: 'Mobile',
    source: SRD,
    description: 'Your speed increases by 10 feet. When you use the Dash action, difficult terrain doesn’t cost extra movement. Attacking a creature does not provoke opportunity attacks from it for the rest of the turn.',
  },
  observant: {
    key: 'observant',
    name: 'Observant',
    source: SRD,
    description: 'Increase Intelligence or Wisdom by 1. You can read lips, and you gain +5 to passive Perception and passive Investigation.',
    abilityBonusChoice: { abilities: ['int', 'wis'], amount: 1 },
  },
  resilient: {
    key: 'resilient',
    name: 'Resilient',
    source: SRD,
    description: 'Choose one ability score and increase it by 1. You gain proficiency in saving throws using that ability.',
    abilityBonusChoice: { abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'], amount: 1 },
  },
  sentinel: {
    key: 'sentinel',
    name: 'Sentinel',
    source: SRD,
    description: 'When you hit a creature with an opportunity attack, its speed becomes 0. Creatures provoke opportunity attacks from you even if they disengage. When a creature within 5 feet attacks someone other than you, you may make a reaction melee attack against it.',
  },
  sharpshooter: {
    key: 'sharpshooter',
    name: 'Sharpshooter',
    source: SRD,
    description: 'Ranged weapon attacks ignore half and three-quarters cover, and no disadvantage for long range. Before a ranged weapon attack you can take -5 to hit for +10 damage.',
  },
  tough: {
    key: 'tough',
    name: 'Tough',
    source: SRD,
    description: 'Your hit point maximum increases by 2 per character level, and increases by 2 whenever you gain a level thereafter.',
  },
  'war-caster': {
    key: 'war-caster',
    name: 'War Caster',
    source: SRD,
    description: 'Advantage on Constitution saves to maintain concentration. You can perform somatic components even with weapons/shield in hand, and can cast a spell as an opportunity-attack reaction instead of a melee attack.',
  },
};
