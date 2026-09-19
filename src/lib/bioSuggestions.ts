import type { Character } from '../types/character';
import type { Compendium } from '../types/compendium';

type BioKey = 'appearance' | 'backstory' | 'personalityTraits' | 'ideals' | 'bonds' | 'flaws';

function suggestionList(intro: string, options: string[] | undefined): string | undefined {
  if (!options || options.length === 0) return undefined;
  return `${intro} — pick one, combine them, or write your own:\n${options.map((o) => `• ${o}`).join('\n')}`;
}

/**
 * Suggested starting text for each Bio field, sourced from the character's
 * race and background in the compendium. Only returns a suggestion for a
 * field when the compendium actually has data for it — never invents
 * content. Callers are expected to only apply a suggestion when the
 * character's own field is still blank, so nothing here ever overwrites
 * something the player wrote.
 */
export function getBioSuggestions(character: Character, compendium: Compendium): Partial<Record<BioKey, string>> {
  const race = compendium.races[character.race.key];
  const background = compendium.backgrounds[character.background];
  const suggestions: Partial<Record<BioKey, string>> = {};

  if (race?.description) suggestions.appearance = race.description;
  if (background?.description) suggestions.backstory = background.description;

  const personalityTraits = suggestionList('Suggested personality traits from your background', background?.personalityTraits);
  if (personalityTraits) suggestions.personalityTraits = personalityTraits;

  const idealOptions = background?.ideals;
  const idealsList = suggestionList('Suggested ideals from your background', idealOptions);
  if (character.alignment || idealsList) {
    suggestions.ideals = [character.alignment ? `Alignment: ${character.alignment}` : null, idealsList]
      .filter((part): part is string => Boolean(part))
      .join('\n\n');
  }

  const bonds = suggestionList('Suggested bonds from your background', background?.bonds);
  if (bonds) suggestions.bonds = bonds;

  const flaws = suggestionList('Suggested flaws from your background', background?.flaws);
  if (flaws) suggestions.flaws = flaws;

  return suggestions;
}
