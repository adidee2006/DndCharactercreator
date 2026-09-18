import type { InventoryEntry } from '../types/character';
import type { Compendium } from '../types/compendium';
import { isWieldedTwoHanded } from './calc';

/**
 * Equip-slot rules: only one body armor at a time (equipping a new one
 * unequips the old one), and a two-handed weapon — inherently, or a
 * Versatile weapon with its two-handed toggle on — can't be worn alongside
 * a shield, since a shield needs a free hand. Equipping either one unequips
 * the other.
 */
export function equipInventoryItem(inventory: InventoryEntry[], compendium: Compendium, id: string): InventoryEntry[] {
  const target = inventory.find((i) => i.id === id);
  const item = target?.itemKey ? compendium.items[target.itemKey] : undefined;
  if (!target || !item) return inventory.map((i) => (i.id === id ? { ...i, equipped: true } : i));

  let next = inventory.map((i) => (i.id === id ? { ...i, equipped: true } : i));
  if (item.type === 'armor') {
    next = next.map((i) => {
      if (i.id === id) return i;
      const other = i.itemKey ? compendium.items[i.itemKey] : undefined;
      return other?.type === 'armor' ? { ...i, equipped: false } : i;
    });
  } else if (item.type === 'shield' || isWieldedTwoHanded(item, target.twoHanded)) {
    next = next.map((i) => {
      if (i.id === id) return i;
      const other = i.itemKey ? compendium.items[i.itemKey] : undefined;
      if (!other || !i.equipped) return i;
      const otherConflicts = other.type === 'shield' || (other.type === 'weapon' && isWieldedTwoHanded(other, i.twoHanded));
      return otherConflicts ? { ...i, equipped: false } : i;
    });
  }
  return next;
}

/** Toggles an inventory entry's equipped state, applying the slot rules above when equipping. */
export function toggleInventoryEquipped(inventory: InventoryEntry[], compendium: Compendium, id: string): InventoryEntry[] {
  const target = inventory.find((i) => i.id === id);
  if (!target) return inventory;
  if (target.equipped) return inventory.map((i) => (i.id === id ? { ...i, equipped: false } : i));
  return equipInventoryItem(inventory, compendium, id);
}

/** Sets a Versatile weapon's two-handed toggle, unequipping a conflicting shield if switching to two-handed while equipped. */
export function setInventoryTwoHanded(inventory: InventoryEntry[], compendium: Compendium, id: string, twoHanded: boolean): InventoryEntry[] {
  const target = inventory.find((i) => i.id === id);
  let next = inventory.map((i) => (i.id === id ? { ...i, twoHanded } : i));
  if (twoHanded && target?.equipped) {
    next = next.map((i) => {
      if (i.id === id) return i;
      const other = i.itemKey ? compendium.items[i.itemKey] : undefined;
      return other?.type === 'shield' && i.equipped ? { ...i, equipped: false } : i;
    });
  }
  return next;
}

/**
 * Auto-equips a fresh batch of newly-added inventory entries (e.g. starting
 * equipment): armor and shields equip normally, but anything that would
 * conflict with what's already been auto-equipped in this same batch (a
 * second armor, or a shield alongside a two-handed weapon) is added
 * unequipped instead, left for the player to sort out — auto-granted kits
 * routinely include a two-handed weapon and a shield together (a martial
 * class's melee option vs. its shield option), and both being equipped by
 * default was an invalid state.
 */
export function autoEquipBatch(existing: InventoryEntry[], newEntries: InventoryEntry[], compendium: Compendium): InventoryEntry[] {
  let inventory = [...existing];
  for (const entry of newEntries) {
    const item = entry.itemKey ? compendium.items[entry.itemKey] : undefined;
    const wantsEquip = entry.equipped;
    inventory = [...inventory, { ...entry, equipped: false }];
    if (wantsEquip && item) {
      const beforeAttempt = inventory;
      const attempted = equipInventoryItem(inventory, compendium, entry.id);
      // If equipping this would silently unequip something already equipped
      // from this same batch, leave it unequipped instead of clobbering an
      // earlier pick — the player can equip it manually once they've chosen.
      const wouldConflict = attempted.some((i) => i.equipped === false && beforeAttempt.find((b) => b.id === i.id)?.equipped === true);
      inventory = wouldConflict ? beforeAttempt : attempted;
    }
  }
  return inventory;
}
