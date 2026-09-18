/**
 * Converts a compendium XML document into the same plain-object shape the
 * JSON custom-compendium import expects, so both formats go through the
 * same importCustomCompendium() validation/sanitization/merge logic.
 *
 * Two XML shapes are recognized:
 *
 * 1. This app's own shape (mirrors the JSON one):
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
 *   A field written as plain text (e.g. <name>...</name>) becomes a string.
 *   A field written with nested <item> children becomes a string array. A
 *   field written with other nested element children becomes a nested
 *   object.
 *
 * 2. The widely-used "Fight Club 5" / Improved Initiative compendium shape:
 *
 *   <compendium version="5">
 *     <spell><name>...</name><level>2</level><school>A</school>...</spell>
 *     <item><name>...</name><type>M</type>...</item>
 *     <race>...</race> <class>...</class> <background>...</background>
 *     <feat>...</feat> <monster>...</monster>
 *   </compendium>
 *
 *   One element per entry, directly under <compendium>, no plural wrapper.
 *   Only <spell> and <item> map cleanly onto this app's structured schema —
 *   <race>/<class>/<background>/<feat> in this format store their mechanics
 *   as free-form prose (<trait>/<feature> text blocks) with no reliable way
 *   to extract structured proficiencies/ability bonuses/spell tables
 *   without guessing, and <monster> isn't a concept this app models at all.
 *   Those are skipped with a clear warning rather than silently invented.
 */

import type { ItemType, SpellSchool } from '../types/compendium';

const CATEGORY_TAGS = ['races', 'classes', 'backgrounds', 'feats', 'spells', 'items'] as const;

export interface XmlImportResult {
  data: unknown;
  warnings: string[];
}

function textOf(el: Element | null): string {
  return el?.textContent?.trim() ?? '';
}

function child(el: Element, tag: string): Element | null {
  return el.querySelector(`:scope > ${tag}`);
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
  for (const c of Array.from(el.children)) {
    obj[c.tagName] = parseFieldElement(c);
  }
  return obj;
}

/**
 * Some real-world compendium exports contain a bare "&" that isn't part of a
 * valid XML entity reference (e.g. "natural & tailored leather"), which
 * makes the entire document fail to parse with a cryptic
 * "xmlParseEntityRef: no name" error and no usable data at all. Escaping
 * only the truly bare ampersands — not ones already part of &amp; &lt; &gt;
 * &quot; &apos; or a numeric &#123; / &#x7B; reference — fixes real files
 * without touching anything that was already valid.
 */
function sanitizeXmlText(xmlText: string): string {
  return xmlText.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
}

const FC5_SCHOOLS: Record<string, SpellSchool> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  EN: 'Enchantment',
  EV: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
};

/** Strips the "Source:\t..." line FC5-style entries append to their description text — that's a citation, not part of the rules text, and this app tracks source separately. */
function stripFC5Source(text: string): string {
  return text.replace(/\n?Source:[\s\S]*$/i, '').trim();
}

function fc5SpellFromElement(el: Element): Record<string, unknown> | null {
  const name = textOf(child(el, 'name'));
  if (!name) return null;
  const levelText = textOf(child(el, 'level'));
  const level = levelText ? Math.max(0, Math.min(9, parseInt(levelText, 10) || 0)) : 0;
  const school = FC5_SCHOOLS[textOf(child(el, 'school'))] ?? 'Evocation';
  const duration = textOf(child(el, 'duration')) || 'Instantaneous';
  const classesRaw = textOf(child(el, 'classes'));
  const classes = classesRaw
    .split(',')
    .map((s) => s.replace(/\(.*\)/g, '').trim())
    .filter((s) => s && !/^school:/i.test(s));
  return {
    name,
    level,
    school,
    castingTime: textOf(child(el, 'time')) || '1 action',
    range: textOf(child(el, 'range')) || 'Self',
    components: textOf(child(el, 'components')) || 'V, S',
    duration,
    concentration: /^concentration/i.test(duration),
    ritual: textOf(child(el, 'ritual')).toUpperCase() === 'YES',
    classes,
    description: stripFC5Source(textOf(child(el, 'text'))),
  };
}

const FC5_ITEM_TYPES: Record<string, ItemType> = {
  M: 'weapon',
  R: 'weapon',
  LA: 'armor',
  MA: 'armor',
  HA: 'armor',
  S: 'shield',
  W: 'magic',
  P: 'consumable',
  SC: 'consumable',
  WD: 'magic',
  RD: 'magic',
  RG: 'magic',
  ST: 'magic',
  A: 'gear',
  G: 'gear',
  $: 'treasure',
};

const FC5_DAMAGE_TYPES: Record<string, string> = { B: 'Bludgeoning', P: 'Piercing', S: 'Slashing' };

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fc5ItemFromElement(el: Element): Record<string, unknown> | null {
  const name = textOf(child(el, 'name'));
  if (!name) return null;
  const type = FC5_ITEM_TYPES[textOf(child(el, 'type'))] ?? 'gear';
  const weightText = textOf(child(el, 'weight'));
  const entry: Record<string, unknown> = {
    name,
    type,
    description: stripFC5Source(textOf(child(el, 'text'))) || undefined,
    weight: weightText ? Number(weightText) || undefined : undefined,
  };
  const dmg1 = textOf(child(el, 'dmg1'));
  if (dmg1) {
    entry.damage = dmg1;
    entry.damageType = FC5_DAMAGE_TYPES[textOf(child(el, 'dmgType'))];
    const properties = textOf(child(el, 'property'));
    if (properties) entry.weaponProperties = properties.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const ac = textOf(child(el, 'ac'));
  if (ac) entry.armorClassBase = Number(ac) || undefined;
  if (textOf(child(el, 'magic')).toUpperCase() === 'YES') {
    const detail = textOf(child(el, 'detail'));
    entry.rarity = detail ? titleCase(detail) : undefined;
  }
  return entry;
}

const FC5_TAGS = ['spell', 'item', 'race', 'class', 'background', 'feat', 'monster'] as const;

/** Detects and converts a Fight Club 5-style compendium (see file header); returns null if this doesn't look like one. */
function tryParseFC5Compendium(root: Element): XmlImportResult | null {
  const byTag = new Map<string, Element[]>();
  for (const c of Array.from(root.children)) {
    const tag = c.tagName.toLowerCase();
    byTag.set(tag, [...(byTag.get(tag) ?? []), c]);
  }
  if (!FC5_TAGS.some((t) => byTag.has(t))) return null;

  const data: Record<string, unknown> = {};
  const warnings: string[] = [];

  const spellEls = byTag.get('spell') ?? [];
  if (spellEls.length) {
    data.spells = spellEls.map(fc5SpellFromElement).filter((s): s is Record<string, unknown> => s != null);
  }
  const itemEls = byTag.get('item') ?? [];
  if (itemEls.length) {
    data.items = itemEls.map(fc5ItemFromElement).filter((i): i is Record<string, unknown> => i != null);
  }

  const skipped = (['race', 'class', 'background', 'feat', 'monster'] as const)
    .map((tag) => ({ tag, count: (byTag.get(tag) ?? []).length }))
    .filter((s) => s.count > 0);
  if (skipped.length) {
    const parts = skipped.map(({ tag, count }) => `${count} ${tag}${count === 1 ? '' : tag === 'class' ? 'es' : 's'}`);
    warnings.push(
      `This is a Fight Club 5-style compendium — only spells and items can be auto-imported from that format. Skipped ${parts.join(
        ', ',
      )}: their mechanics are free-form text in this format with no reliable way to convert them into this app's structured data. Add those by hand via the Compendium page's custom-content forms if you need them.`,
    );
  }

  return { data, warnings };
}

export function parseCompendiumXml(xmlText: string): XmlImportResult {
  const doc = new DOMParser().parseFromString(sanitizeXmlText(xmlText), 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`Invalid XML: ${parserError.textContent?.trim() || 'could not be parsed'}.`);
  }
  const root = doc.documentElement;
  if (!root) throw new Error('Empty XML document.');

  const result: Record<string, unknown> = {};
  const label = root.getAttribute('label');
  if (label) result.label = label;

  let foundAnyCategory = false;
  for (const categoryEl of Array.from(root.children)) {
    const tag = categoryEl.tagName.toLowerCase();
    if (!(CATEGORY_TAGS as readonly string[]).includes(tag)) continue;
    result[tag] = Array.from(categoryEl.children).map(parseEntryElement);
    foundAnyCategory = true;
  }
  if (foundAnyCategory) return { data: result, warnings: [] };

  const fc5 = tryParseFC5Compendium(root);
  if (fc5) {
    if (label) (fc5.data as Record<string, unknown>).label = label;
    return fc5;
  }

  throw new Error(
    `No recognized category elements found under <${root.tagName}>. Expected one or more of: <races>, <classes>, <backgrounds>, <feats>, <spells>, <items> — or a Fight Club 5-style compendium with <spell>/<item>/<race>/<class>/... entries directly under <compendium>.`,
  );
}
