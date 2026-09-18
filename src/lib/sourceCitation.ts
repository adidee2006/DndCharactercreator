import type { SourceInfo } from '../types/compendium';

/** "Player's Handbook, p. 241" / "Player's Handbook" / null when no book is known for this entry. */
export function sourceCitation(source: SourceInfo | undefined): string | null {
  if (!source?.book) return null;
  return source.page != null ? `${source.book}, p. ${source.page}` : source.book;
}
