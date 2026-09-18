export interface FightingStyle {
  key: string;
  name: string;
  description: string;
}

/**
 * 2024 fighting styles. Available as a class feature to Fighter (lv1),
 * Paladin (lv2), and Ranger (lv2), and also selectable via the Fighting
 * Style general feat by other classes that meet its prerequisite.
 */
export const fightingStyles: FightingStyle[] = [
  { key: 'archery', name: 'Archery', description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.' },
  {
    key: 'blind-fighting',
    name: 'Blind Fighting',
    description: 'You have blindsight with a range of 10 feet. Within that range, you can effectively see anything that isn’t behind total cover, even if you’re blinded or in darkness.',
  },
  { key: 'defense', name: 'Defense', description: 'While you are wearing armor, you gain a +1 bonus to AC.' },
  {
    key: 'dueling',
    name: 'Dueling',
    description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
  },
  {
    key: 'great-weapon-fighting',
    name: 'Great Weapon Fighting',
    description: 'When you roll a 1 or 2 on a damage die for an attack with a two-handed or versatile melee weapon, you can reroll the die and must use the new roll, even if it’s a 1 or 2.',
  },
  {
    key: 'interception',
    name: 'Interception',
    description: 'When a creature you can see hits a target other than you that is within 5 feet of you with an attack, you can use your reaction to reduce the damage the target takes by 1d10 + your proficiency bonus (you must be wielding a weapon or shield to use this).',
  },
  {
    key: 'protection',
    name: 'Protection',
    description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll, provided you are wielding a shield.',
  },
  {
    key: 'superior-technique',
    name: 'Superior Technique',
    description: 'You learn one maneuver of your choice from those available to the Battle Master subclass, fueled by one superiority die (a d6) that you regain on a short or long rest.',
  },
  {
    key: 'thrown-weapon-fighting',
    name: 'Thrown Weapon Fighting',
    description: 'You gain a +2 bonus to damage rolls with weapons you throw, and you can draw a thrown weapon as part of the attack you make with it.',
  },
  {
    key: 'two-weapon-fighting',
    name: 'Two-Weapon Fighting',
    description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
  },
  {
    key: 'unarmed-fighting',
    name: 'Unarmed Fighting',
    description: 'Your unarmed strikes deal 1d6 (or 1d8 if you have no weapon and no shield in hand) bludgeoning damage on a hit, and you can make a bonus-action unarmed strike or grapple attempt against a creature you damaged this turn.',
  },
];

export const fightingStylesByKey: Record<string, FightingStyle> = Object.fromEntries(fightingStyles.map((f) => [f.key, f]));
