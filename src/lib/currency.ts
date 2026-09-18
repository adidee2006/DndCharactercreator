import type { Currency } from '../types/character';
import type { Item } from '../types/compendium';

/** Value of each coin in gold pieces, per the PHB exchange rates. */
export const GP_VALUE: Record<keyof Currency, number> = {
  cp: 0.01,
  sp: 0.1,
  ep: 0.5,
  gp: 1,
  pp: 10,
};

export function totalValueInGp(currency: Currency): number {
  return (Object.keys(GP_VALUE) as (keyof Currency)[]).reduce((sum, key) => sum + currency[key] * GP_VALUE[key], 0);
}

/**
 * Consolidates coinage upward wherever it divides evenly — 10 cp -> 1 sp,
 * 10 sp -> 1 gp, 10 gp -> 1 pp — so a heavy pouch of copper turns into a
 * lighter one of gold. Electrum is left alone since it doesn't convert
 * cleanly (1 ep = 5 sp), matching how most tables actually handle it.
 */
export function autoExchange(currency: Currency): Currency {
  let { cp, sp, gp, pp } = currency;
  sp += Math.floor(cp / 10);
  cp %= 10;
  gp += Math.floor(sp / 10);
  sp %= 10;
  pp += Math.floor(gp / 10);
  gp %= 10;
  return { ...currency, cp, sp, gp, pp };
}

export function formatGp(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(2);
}

const COIN_PATTERN = /(\d[\d,]*)\s*(cp|sp|ep|gp|pp)\b/i;

/**
 * Recognizes a compendium entry that's really just a stack of coins rather
 * than a physical item — common in imported compendiums, whose "treasure"
 * category is often literally named things like "50 gp" or "12 pp" instead
 * of describing an object. Returns the coin type and amount if this looks
 * like one, so it can be added straight to the character's purse instead of
 * cluttering the inventory list with a line item that has no weight or
 * description.
 */
export function parseMoneyItem(item: Item): { denom: keyof Currency; amount: number } | null {
  if (item.type !== 'treasure') return null;
  const match = item.name.match(COIN_PATTERN) ?? item.cost?.match(COIN_PATTERN);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!amount || amount <= 0) return null;
  return { denom: match[2].toLowerCase() as keyof Currency, amount };
}
