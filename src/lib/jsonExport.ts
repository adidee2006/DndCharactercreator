import type { Character } from '../types/character';

export const CHARACTER_EXPORT_FORMAT = 'dnd-character-creator/character';
export const CHARACTER_EXPORT_VERSION = 1;

export interface CharacterExportFile {
  format: typeof CHARACTER_EXPORT_FORMAT;
  version: typeof CHARACTER_EXPORT_VERSION;
  exportedAt: string;
  character: Character;
}

export function characterToExportFile(character: Character): CharacterExportFile {
  return {
    format: CHARACTER_EXPORT_FORMAT,
    version: CHARACTER_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    character,
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugFilename(name: string, ext: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'character';
  return `${slug}.${ext}`;
}

export function parseCharacterImport(json: unknown): Character {
  if (json && typeof json === 'object' && 'character' in (json as Record<string, unknown>)) {
    return (json as CharacterExportFile).character;
  }
  return json as Character;
}
