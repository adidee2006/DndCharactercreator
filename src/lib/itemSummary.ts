import type { Item } from '../types/compendium';

/**
 * Most weapons/armor in the bundled SRD data carry their stats as structured
 * fields (damage, AC, properties) rather than prose. Build a readable
 * one-line summary from those fields so the UI always has something useful
 * to show, even for entries without hand-written flavor text.
 */
export function itemSummaryLine(item: Item): string {
  const parts: string[] = [];

  if (item.damage) parts.push(`${item.damage}${item.damageType ? ` ${item.damageType}` : ''}`);
  if (item.weaponProperties?.length) parts.push(item.weaponProperties.join(', '));
  if (item.masteryProperty) parts.push(`Mastery: ${item.masteryProperty}`);
  if (item.armorClassBase != null) {
    let ac = `AC ${item.armorClassBase}`;
    if (item.armorClassAddDex) ac += item.armorClassMaxDex != null ? ` + Dex (max ${item.armorClassMaxDex})` : ' + Dex';
    parts.push(ac);
  }
  if (item.strengthRequirement) parts.push(`Str ${item.strengthRequirement}+`);
  if (item.stealthDisadvantage) parts.push('Stealth disadvantage');
  if (item.rarity) parts.push(item.rarity);
  if (item.requiresAttunement) parts.push('Requires attunement');
  if (item.cost) parts.push(item.cost);
  if (item.weight != null) parts.push(`${item.weight} lb`);

  return parts.join(' • ');
}

export function itemDescription(item: Item): string {
  return item.description || itemSummaryLine(item) || 'No further details available for this item.';
}
