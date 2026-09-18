export interface FightingStyle {
  key: string;
  name: string;
  description: string;
}

/** SRD fighting styles, available to Fighter (lv1), Paladin (lv2), and Ranger (lv2). */
export const fightingStyles: FightingStyle[] = [
  { key: 'archery', name: 'Archery', description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.' },
  { key: 'defense', name: 'Defense', description: 'While you are wearing armor, you gain a +1 bonus to AC.' },
  {
    key: 'dueling',
    name: 'Dueling',
    description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
  },
  {
    key: 'great-weapon-fighting',
    name: 'Great Weapon Fighting',
    description: 'When you roll a 1 or 2 on a damage die for an attack with a two-handed or versatile melee weapon, you can reroll the die and must use the new roll.',
  },
  {
    key: 'protection',
    name: 'Protection',
    description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll, provided you are wielding a shield.',
  },
  {
    key: 'two-weapon-fighting',
    name: 'Two-Weapon Fighting',
    description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
  },
];

export const fightingStylesByKey: Record<string, FightingStyle> = Object.fromEntries(fightingStyles.map((f) => [f.key, f]));
