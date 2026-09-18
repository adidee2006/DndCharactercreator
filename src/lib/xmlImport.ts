/**
 * Converts a compendium XML document into the same plain-object shape the
 * JSON custom-compendium import expects, so both formats go through the
 * same importCustomCompendium() validation/sanitization/merge logic.
 *
 * Expected shape (mirrors the JSON one):
 *
 *   <compendium label="My Homebrew Pack">
 *     <items>
 *       <item key="flametongue-dagger">
 *         <name>Flametongue Dagger</name>
 *         <type>weapon</type>
 *         <damage>1d4</damage>
 *         <damageType>fire</damageType>
 *         <rarity>Rare</rarity>
 *       </item>
 *     </items>
 *     <spells>
 *       <spell key="my-spell">
 *         <name>...</name>
 *         <level>2</level>
 *         <classes><item>wizard</item><item>sorcerer</item></classes>
 *       </spell>
 *     </spells>
 *     <!-- races, classes, backgrounds, feats follow the same pattern -->
 *   </compendium>
 *
 * A field written as plain text (e.g. <name>...</name>) becomes a string.
 * A field written with nested <item> children becomes a string array. A
 * field written with other nested element children becomes a nested object
 * (e.g. a feat's <abilityBonusChoice><abilities><item>str</item></abilities>
 * <amount>1</amount></abilityBonusChoice>).
 */

const CATEGORY_TAGS = ['races', 'classes', 'backgrounds', 'feats', 'spells', 'items'] as const;

function textOf(el: Element): string {
  return el.textContent?.trim() ?? '';
}

function parseFieldElement(el: Element): unknown {
  const children = Array.from(el.children);
  if (children.length === 0) return textOf(el);
  if (children.every((c) => c.tagName === 'item')) return children.map(textOf);
  return parseEntryElement(el);
}

function parseEntryElement(el: Element): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const key = el.getAttribute('key');
  if (key) obj.key = key;
  for (const child of Array.from(el.children)) {
    obj[child.tagName] = parseFieldElement(child);
  }
  return obj;
}

export function parseCompendiumXml(xmlText: string): unknown {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`Invalid XML: ${parserError.textContent?.trim() || 'could not be parsed'}.`);
  }
  const root = doc.documentElement;
  if (!root) throw new Error('Empty XML document.');

  const result: Record<string, unknown> = {};
  const label = root.getAttribute('label');
  if (label) result.label = label;

  for (const categoryEl of Array.from(root.children)) {
    const tag = categoryEl.tagName.toLowerCase();
    if (!(CATEGORY_TAGS as readonly string[]).includes(tag)) continue;
    const entries = Array.from(categoryEl.children).map(parseEntryElement);
    result[tag] = entries;
  }

  const foundAnyCategory = CATEGORY_TAGS.some((t) => t in result);
  if (!foundAnyCategory) {
    throw new Error(
      `No recognized category elements found under <${root.tagName}>. Expected one or more of: <races>, <classes>, <backgrounds>, <feats>, <spells>, <items>.`,
    );
  }

  return result;
}
