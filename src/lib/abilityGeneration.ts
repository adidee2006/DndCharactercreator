import type { AbilityScores } from '../types/character';
import { ABILITY_KEYS } from '../types/compendium';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_BUDGET = 27;

export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export function pointBuySpent(scores: AbilityScores): number {
  return ABILITY_KEYS.reduce((sum, key) => sum + (POINT_BUY_COST[scores[key]] ?? 0), 0);
}

function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** Rolls 4d6, drops the lowest, for a single ability score. */
export function roll4d6DropLowest(): number {
  const rolls = [rollDie(), rollDie(), rollDie(), rollDie()].sort((a, b) => b - a);
  return rolls[0] + rolls[1] + rolls[2];
}

export function rollAbilitySet(): number[] {
  return Array.from({ length: 6 }, () => roll4d6DropLowest());
}

export function blankAbilityScores(value = 10): AbilityScores {
  return { str: value, dex: value, con: value, wis: value, int: value, cha: value };
}
