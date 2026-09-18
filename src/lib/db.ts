import Dexie, { type Table } from 'dexie';
import type { Character } from '../types/character';
import type { Race, DndClass, Background, Feat, Spell, Item } from '../types/compendium';

export interface CompendiumMeta {
  key: string; // e.g. "lastRemoteSync"
  value: string;
}

class AppDatabase extends Dexie {
  characters!: Table<Character, string>;
  races!: Table<Race, string>;
  classes!: Table<DndClass, string>;
  backgrounds!: Table<Background, string>;
  feats!: Table<Feat, string>;
  spells!: Table<Spell, string>;
  items!: Table<Item, string>;
  meta!: Table<CompendiumMeta, string>;

  constructor() {
    super('dnd-character-creator');
    this.version(1).stores({
      characters: 'id, name, updatedAt',
      races: 'key',
      classes: 'key',
      backgrounds: 'key',
      feats: 'key',
      spells: 'key, level',
      items: 'key, type',
      meta: 'key',
    });
  }
}

export const db = new AppDatabase();
