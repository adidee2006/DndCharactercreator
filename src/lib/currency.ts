import type { Currency } from '../types/character';

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
