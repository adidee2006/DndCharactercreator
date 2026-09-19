import { v4 as uuid } from 'uuid';
import { db } from './db';
import { createBlankCharacter, type Character } from '../types/character';
import { uploadCharacterToCloud, deleteCharacterFromCloud } from './cloudSync';

export async function listCharacters(): Promise<Character[]> {
  const all = await db.characters.toArray();
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCharacter(id: string): Promise<Character | undefined> {
  return db.characters.get(id);
}

export async function createCharacter(): Promise<Character> {
  const character = createBlankCharacter(uuid());
  await db.characters.put(character);
  void uploadCharacterToCloud(character);
  return character;
}

export async function saveCharacter(character: Character): Promise<void> {
  const updated: Character = { ...character, updatedAt: new Date().toISOString() };
  await db.characters.put(updated);
  void uploadCharacterToCloud(updated);
}

/**
 * Stores a character exactly as given — no `updatedAt` bump, no cloud
 * re-upload. Used when importing a character that's already the source of
 * truth (pulled from the cloud or a sync code): treating that as a fresh
 * "edit" would keep nudging its timestamp forward on every sync and
 * defeat the newer-wins comparison sync relies on.
 */
export async function putCharacterRaw(character: Character): Promise<void> {
  await db.characters.put(character);
}

export async function deleteCharacter(id: string): Promise<void> {
  await db.characters.delete(id);
  void deleteCharacterFromCloud(id);
}

/** Removes a character locally only — used when a cloud tombstone says another device already deleted it. */
export async function deleteCharacterLocalOnly(id: string): Promise<void> {
  await db.characters.delete(id);
}

export async function duplicateCharacter(id: string): Promise<Character | undefined> {
  const original = await db.characters.get(id);
  if (!original) return undefined;
  const now = new Date().toISOString();
  const copy: Character = { ...original, id: uuid(), name: `${original.name} (Copy)`, createdAt: now, updatedAt: now };
  await db.characters.put(copy);
  void uploadCharacterToCloud(copy);
  return copy;
}

export async function importCharacterFromJson(json: unknown): Promise<Character> {
  const parsed = json as Partial<Character>;
  if (!parsed || typeof parsed !== 'object' || !parsed.name) {
    throw new Error('That file doesn’t look like a valid character export.');
  }
  const now = new Date().toISOString();
  const blank = createBlankCharacter(uuid());
  const character: Character = { ...blank, ...parsed, id: uuid(), createdAt: now, updatedAt: now };
  await db.characters.put(character);
  void uploadCharacterToCloud(character);
  return character;
}
