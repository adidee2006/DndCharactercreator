import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Character } from '../types/character';
import type { Compendium } from '../types/compendium';
import { ABILITY_NAMES, SKILLS, type AbilityKey } from '../types/compendium';
import { fightingStylesByKey } from '../data/srd/fightingStyles';
import {
  getAbilityModifiers,
  getFinalAbilityScores,
  getArmorClass,
  getInitiative,
  getSpeed,
  getHitPointsMax,
  getHitDice,
  getProficiencyBonus,
  getSkillModifier,
  getSavingThrowModifier,
  getPassiveSkill,
  getSpellcastingClasses,
  getSpellSlots,
  getPactMagicSlots,
  formatModifier,
  getWeaponAttacks,
} from './calc';

/*
 * Mirrors the official 2024 Player's Handbook character sheet's section
 * layout and field labels (two pages: stats/combat/features, then
 * spellcasting/bio) rather than the sheet's illustration (no dragon
 * artwork, ornate dials, or filigree corners — just its information
 * architecture, filled from this app's calculated character data).
 */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 24;
const INK = rgb(0.12, 0.1, 0.2);
const MUTED = rgb(0.45, 0.45, 0.5);
const FAINT = rgb(0.72, 0.72, 0.76);
const LINE = rgb(0.55, 0.55, 0.6);
const ACCENT = rgb(0.45, 0.12, 0.15);

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, opts: { borderColor?: ReturnType<typeof rgb> } = {}) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, borderColor: opts.borderColor ?? LINE, borderWidth: 0.75 });
}

/**
 * The standard 14 PDF fonts only support WinAnsi (cp1252) encoding. Most of Latin-1
 * (codepoints <= 0xFF) maps directly, plus a handful of typographic characters (smart
 * quotes, em dash, bullet, ellipsis, …) that live above 0xFF in Unicode but are
 * still valid single-byte WinAnsi characters. Character names, bios, and custom
 * features are free user input and may contain glyphs (CJK, emoji, etc.) outside all
 * of that, which would otherwise throw and abort the whole export — replace those
 * with "?" rather than fail.
 */
const WINANSI_EXTRA_CODEPOINTS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
  0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122,
  0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function sanitizeForPdf(str: string): string {
  return Array.from(str)
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      return code <= 0xff || WINANSI_EXTRA_CODEPOINTS.has(code) ? ch : '?';
    })
    .join('');
}

function text(ctx: Ctx, str: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'center' | 'right'; maxWidth?: number } = {}) {
  const size = opts.size ?? 8;
  const font = opts.bold ? ctx.bold : ctx.font;
  const color = opts.color ?? INK;
  const safeStr = sanitizeForPdf(str);
  let drawX = x;
  if (opts.align === 'center' && opts.maxWidth) {
    const w = font.widthOfTextAtSize(safeStr, size);
    drawX = x + (opts.maxWidth - w) / 2;
  } else if (opts.align === 'right' && opts.maxWidth) {
    const w = font.widthOfTextAtSize(safeStr, size);
    drawX = x + opts.maxWidth - w;
  }
  try {
    ctx.page.drawText(safeStr, { x: drawX, y, size, font, color });
  } catch {
    ctx.page.drawText(safeStr.replace(/[^\x20-\x7e]/g, '?'), { x: drawX, y, size, font, color });
  }
}

/** Small circular proficiency pip (filled = proficient). */
function pip(ctx: Ctx, cx: number, cy: number, filled: boolean, radius = 3) {
  ctx.page.drawEllipse({ x: cx, y: cy, xScale: radius, yScale: radius, color: filled ? INK : undefined, borderColor: INK, borderWidth: 0.75 });
}

/** Small diamond pip (used for expertise, and death-save/spell-slot "used" marks). */
function diamondPip(ctx: Ctx, cx: number, cy: number, filled: boolean, radius = 3.2, color = ACCENT) {
  ctx.page.drawSvgPath(`M ${-radius} 0 L 0 ${-radius} L ${radius} 0 L 0 ${radius} Z`, {
    x: cx,
    y: cy,
    color: filled ? color : undefined,
    borderColor: color,
    borderWidth: 0.6,
  });
}

function wrapText(font: PDFFont, str: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitizeForPdf(str).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const attempt = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(attempt, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = attempt;
      }
    }
    lines.push(current);
  }
  return lines;
}

/** Section title banner (filled accent bar with white caps text), matching the sheet's colored headers. `y` is the TOP edge of the bar. */
function sectionHeader(ctx: Ctx, str: string, x: number, y: number, w: number, h = 13) {
  ctx.page.drawRectangle({ x, y: y - h, width: w, height: h, color: ACCENT });
  text(ctx, str.toUpperCase(), x + 5, y - h + 4, { size: 7, bold: true, color: rgb(1, 1, 1) });
}

/** A bordered field cell with a small muted label at top and a value below it — the sheet's basic "fill-in" box. */
function fieldCell(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  opts: { valueSize?: number; bold?: boolean; wrap?: boolean; maxLines?: number } = {},
) {
  box(ctx, x, y, w, h);
  const top = y + h;
  text(ctx, label.toUpperCase(), x + 4, top - 8, { size: 5.5, color: MUTED, bold: true });
  if (!value) return;
  const valueSize = opts.valueSize ?? 9;
  const lines = opts.wrap ? wrapText(ctx.font, value, valueSize, w - 8) : [value];
  let ty = top - 20;
  for (const line of lines.slice(0, opts.maxLines ?? 1)) {
    text(ctx, line, x + 4, ty, { size: valueSize, bold: opts.bold });
    ty -= valueSize + 3;
  }
}

/** A stat block with a big centered value and a caption below — used for AC/Initiative/ability scores/etc. */
function statCell(ctx: Ctx, x: number, y: number, w: number, h: number, label: string, value: string, valueSize = 16) {
  box(ctx, x, y, w, h);
  text(ctx, value, x, y + h - valueSize - 5, { size: valueSize, bold: true, align: 'center', maxWidth: w });
  text(ctx, label.toUpperCase(), x, y + 4, { size: 5.5, color: MUTED, align: 'center', maxWidth: w });
}

function newPage(ctx: Ctx): PDFPage {
  const page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.page = page;
  return page;
}

function footer(ctx: Ctx, character: Character) {
  text(ctx, `${character.name || 'Unnamed Character'} — generated by Grimoire Sheets`, MARGIN, 12, { size: 6.5, color: FAINT });
}

export async function generateCharacterSheetPdf(character: Character, compendium: Compendium): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${character.name} - Character Sheet`);
  pdf.setSubject('D&D Character Sheet (generated by DnD Character Creator)');

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { pdf, page: pdf.addPage([PAGE_W, PAGE_H]), font, bold };

  const mods = getAbilityModifiers(character, compendium);
  const scores = getFinalAbilityScores(character, compendium);
  const prof = getProficiencyBonus(character);
  const race = compendium.races[character.race.key];
  const subrace = race?.subraces?.find((sr) => sr.key === character.race.subraceKey);
  const background = compendium.backgrounds[character.background];
  const primaryClass = character.classes[0];
  const primaryClassData = primaryClass ? compendium.classes[primaryClass.classKey] : undefined;
  const primarySubclass = primaryClassData?.subclasses.find((s) => s.key === primaryClass?.subclassKey);
  const totalLevel = character.classes.reduce((sum, c) => sum + (c.level || 0), 0);
  const classLine = character.classes
    .filter((c) => c.classKey)
    .map((c) => `${compendium.classes[c.classKey]?.name ?? c.classKey} ${c.level}`)
    .join(' / ');

  const contentW = PAGE_W - MARGIN * 2;
  const left = MARGIN;
  const right = PAGE_W - MARGIN;

  // ---------- Header band: identity, level, AC, HP, hit dice, death saves ----------
  const headerH = 78;
  let headerTop = PAGE_H - MARGIN;
  const identityW = 190;
  const levelW = 52;
  const acW = 58;
  const hpW = 108;
  const hitDiceW = 62;
  const deathW = contentW - identityW - levelW - acW - hpW - hitDiceW - 20;

  let hx = left;
  const idBottom = headerTop - headerH;
  box(ctx, hx, idBottom, identityW, headerH);
  text(ctx, 'CHARACTER NAME', hx + 4, headerTop - 8, { size: 5.5, color: MUTED, bold: true });
  text(ctx, character.name || 'Unnamed Character', hx + 4, headerTop - 20, { size: 12, bold: true });
  ctx.page.drawLine({ start: { x: hx, y: headerTop - 27 }, end: { x: hx + identityW, y: headerTop - 27 }, color: LINE, thickness: 0.5 });
  text(ctx, 'BACKGROUND', hx + 4, headerTop - 36, { size: 5, color: MUTED, bold: true });
  text(ctx, background?.name ?? '—', hx + 4, headerTop - 46, { size: 8 });
  text(ctx, 'CLASS', hx + identityW / 2 + 4, headerTop - 36, { size: 5, color: MUTED, bold: true });
  text(ctx, classLine || '—', hx + identityW / 2 + 4, headerTop - 46, { size: 8 });
  ctx.page.drawLine({ start: { x: hx, y: headerTop - 53 }, end: { x: hx + identityW, y: headerTop - 53 }, color: LINE, thickness: 0.5 });
  text(ctx, 'SPECIES', hx + 4, headerTop - 62, { size: 5, color: MUTED, bold: true });
  text(ctx, subrace ? `${race?.name ?? '—'} (${subrace.name})` : race?.name ?? '—', hx + 4, headerTop - 72, { size: 8 });
  text(ctx, 'SUBCLASS', hx + identityW / 2 + 4, headerTop - 62, { size: 5, color: MUTED, bold: true });
  text(ctx, primarySubclass?.name ?? '—', hx + identityW / 2 + 4, headerTop - 72, { size: 8 });
  ctx.page.drawLine({ start: { x: hx + identityW / 2, y: idBottom }, end: { x: hx + identityW / 2, y: headerTop - 27 }, color: LINE, thickness: 0.4 });
  hx += identityW + 4;

  statCell(ctx, hx, idBottom, levelW, headerH - 22, 'Level', String(totalLevel || 1), 18);
  fieldCell(ctx, hx, idBottom + headerH - 22, levelW, 22, 'XP', '');
  hx += levelW + 4;

  statCell(ctx, hx, idBottom, acW, headerH, 'Armor Class', String(getArmorClass(character, compendium)), 22);
  hx += acW + 4;

  box(ctx, hx, idBottom, hpW, headerH);
  text(ctx, 'HIT POINTS', hx + 4, headerTop - 8, { size: 5.5, color: MUTED, bold: true });
  text(ctx, `Current  ${character.hpCurrent}`, hx + 4, headerTop - 24, { size: 9, bold: true });
  text(ctx, `Temp  ${character.hpTemp}`, hx + 4, headerTop - 38, { size: 8 });
  text(ctx, `Max  ${getHitPointsMax(character, compendium)}`, hx + 4, headerTop - 52, { size: 8 });
  hx += hpW + 4;

  const hitDice = getHitDice(character, compendium)
    .map((hd) => `${hd.count}d${hd.die}`)
    .join(' + ');
  box(ctx, hx, idBottom, hitDiceW, headerH);
  text(ctx, 'HIT DICE', hx + 4, headerTop - 8, { size: 5.5, color: MUTED, bold: true });
  text(ctx, `Spent  ${character.hitDiceUsed}`, hx + 4, headerTop - 26, { size: 8 });
  text(ctx, `Max  ${hitDice || '—'}`, hx + 4, headerTop - 40, { size: 8, wordSpacing: 0 } as never);
  hx += hitDiceW + 4;

  box(ctx, hx, idBottom, deathW, headerH);
  text(ctx, 'DEATH SAVES', hx + 4, headerTop - 8, { size: 5.5, color: MUTED, bold: true });
  text(ctx, 'Successes', hx + 4, headerTop - 24, { size: 7 });
  for (let i = 0; i < 3; i++) pip(ctx, hx + 12 + i * 12, headerTop - 36, i < character.deathSaves.successes);
  text(ctx, 'Failures', hx + 4, headerTop - 50, { size: 7 });
  for (let i = 0; i < 3; i++) pip(ctx, hx + 12 + i * 12, headerTop - 62, i < character.deathSaves.failures);

  headerTop -= headerH + 6;

  // ---------- Title banner ----------
  ctx.page.drawRectangle({ x: left, y: headerTop - 15, width: contentW, height: 18, color: ACCENT });
  text(ctx, 'DUNGEONS & DRAGONS — CHARACTER SHEET', left, headerTop - 6, { size: 9, bold: true, color: rgb(1, 1, 1), align: 'center', maxWidth: contentW });
  headerTop -= 24;

  // ---------- Stat row: Prof Bonus / Initiative / Speed / Size / Passive Perception ----------
  const statRowH = 38;
  const statW = (contentW - 16) / 5;
  let sx = left;
  statCell(ctx, sx, headerTop - statRowH, statW, statRowH, 'Prof. Bonus', formatModifier(prof), 15);
  sx += statW + 4;
  statCell(ctx, sx, headerTop - statRowH, statW, statRowH, 'Initiative', formatModifier(getInitiative(character, compendium)), 15);
  sx += statW + 4;
  statCell(ctx, sx, headerTop - statRowH, statW, statRowH, 'Speed', `${getSpeed(character, compendium)} ft`, 13);
  sx += statW + 4;
  statCell(ctx, sx, headerTop - statRowH, statW, statRowH, 'Size', race?.size ?? '—', 13);
  sx += statW + 4;
  statCell(ctx, sx, headerTop - statRowH, statW, statRowH, 'Passive Perception', String(getPassiveSkill(character, compendium, 'perception')), 15);
  headerTop -= statRowH + 8;

  // ---------- Ability columns (left: STR/DEX/CON, mid: INT/WIS/CHA) + right column (combat/features) ----------
  const abilColW = 130;
  const gap = 8;
  const rightColX = left + abilColW * 2 + gap * 2;
  const rightColW = right - rightColX;
  const columnsTop = headerTop;

  const SKILLS_BY_ABILITY: Record<AbilityKey, (keyof typeof SKILLS)[]> = { str: [], dex: [], con: [], int: [], wis: [], cha: [] };
  for (const [key, def] of Object.entries(SKILLS) as [keyof typeof SKILLS, (typeof SKILLS)[keyof typeof SKILLS]][]) {
    SKILLS_BY_ABILITY[def.ability].push(key);
  }

  function abilityBlock(x: number, yTop: number, ability: AbilityKey): number {
    let y = yTop;
    const scoreBoxH = 44;
    box(ctx, x, y - scoreBoxH, abilColW, scoreBoxH);
    text(ctx, ABILITY_NAMES[ability].toUpperCase(), x + 4, y - 9, { size: 6.5, bold: true, color: MUTED });
    text(ctx, formatModifier(mods[ability]), x, y - 34, { size: 17, bold: true, align: 'center', maxWidth: abilColW });
    text(ctx, `Score ${scores[ability]}`, x, y - scoreBoxH + 4, { size: 6.5, color: MUTED, align: 'center', maxWidth: abilColW });
    y -= scoreBoxH + 2;

    const rowH = 12;
    const skillList = SKILLS_BY_ABILITY[ability];
    const listH = (1 + skillList.length) * rowH + 4;
    box(ctx, x, y - listH, abilColW, listH);
    let ry = y - 9;
    const savingProf = character.savingThrowProficiencies.includes(ability);
    pip(ctx, x + 8, ry - 2, savingProf);
    text(ctx, 'Saving Throw', x + 16, ry - 4, { size: 7 });
    text(ctx, formatModifier(getSavingThrowModifier(character, compendium, ability)), x + abilColW - 20, ry - 4, { size: 7, bold: true });
    ry -= rowH;
    for (const sk of skillList) {
      const isExpert = character.skillExpertise.includes(sk);
      const isProficient = character.skillProficiencies.includes(sk) || isExpert;
      if (isExpert) diamondPip(ctx, x + 8, ry - 2, true);
      else pip(ctx, x + 8, ry - 2, isProficient, 2.6);
      text(ctx, SKILLS[sk].name, x + 16, ry - 4, { size: 7 });
      text(ctx, formatModifier(getSkillModifier(character, compendium, sk)), x + abilColW - 20, ry - 4, { size: 7, bold: true });
      ry -= rowH;
    }
    y -= listH + 6;
    return y;
  }

  let leftY = columnsTop;
  leftY = abilityBlock(left, leftY, 'str');
  leftY = abilityBlock(left, leftY, 'dex');
  leftY = abilityBlock(left, leftY, 'con');
  statCell(ctx, left, leftY - 40, abilColW, 40, 'Heroic Inspiration', character.inspiration ? 'Yes' : '—', 13);
  leftY -= 40;

  const midX = left + abilColW + gap;
  let midY = columnsTop;
  midY = abilityBlock(midX, midY, 'int');
  midY = abilityBlock(midX, midY, 'wis');
  midY = abilityBlock(midX, midY, 'cha');

  // ---------- Right column: weapons table, class features, species traits + feats ----------
  let ry2 = columnsTop;
  sectionHeader(ctx, 'Weapons & Damage Cantrips', rightColX, ry2, rightColW);
  ry2 -= 16;
  const weaponAttacks = getWeaponAttacks(character, compendium);
  const wRows = Math.max(5, weaponAttacks.length);
  const wRowH = 12;
  const wTableH = wRowH * (wRows + 1) + 6;
  box(ctx, rightColX, ry2 - wTableH, rightColW, wTableH);
  const wCols = { name: rightColX + 4, atk: rightColX + rightColW * 0.42, dmg: rightColX + rightColW * 0.62, notes: rightColX + rightColW * 0.85 };
  text(ctx, 'Name', wCols.name, ry2 - 9, { size: 6, color: MUTED });
  text(ctx, 'Atk Bonus/DC', wCols.atk, ry2 - 9, { size: 6, color: MUTED });
  text(ctx, 'Damage & Type', wCols.dmg, ry2 - 9, { size: 6, color: MUTED });
  text(ctx, 'Notes', wCols.notes, ry2 - 9, { size: 6, color: MUTED });
  let wy = ry2 - 9 - wRowH;
  for (let i = 0; i < wRows; i++) {
    const wa = weaponAttacks[i];
    if (wa) {
      text(ctx, wa.item.name, wCols.name, wy, { size: 7.5 });
      text(ctx, formatModifier(wa.attackBonus), wCols.atk, wy, { size: 7.5 });
      text(ctx, wa.damageText, wCols.dmg, wy, { size: 7.5 });
    }
    ctx.page.drawLine({ start: { x: rightColX, y: wy - 3 }, end: { x: rightColX + rightColW, y: wy - 3 }, color: FAINT, thickness: 0.4 });
    wy -= wRowH;
  }
  ry2 -= wTableH + 8;

  sectionHeader(ctx, 'Class Features', rightColX, ry2, rightColW);
  ry2 -= 16;
  const featureTexts: string[] = [];
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    if (!cls) continue;
    for (const f of cls.features) {
      if (f.level > cl.level) continue;
      if (f.name.includes('Fighting Style') && character.fightingStyle) {
        const style = fightingStylesByKey[character.fightingStyle];
        featureTexts.push(`${f.name}: ${style?.name ?? character.fightingStyle} (${cls.name} ${f.level})`);
      } else {
        featureTexts.push(`${f.name} (${cls.name} ${f.level})`);
      }
    }
    const subclass = cls.subclasses.find((s) => s.key === cl.subclassKey);
    if (subclass) for (const f of subclass.features) if (f.level <= cl.level) featureTexts.push(`${f.name} (${subclass.name} ${f.level})`);
    if (subclass?.grantsSecondFightingStyle && cl.level >= subclass.grantsSecondFightingStyle && character.secondFightingStyle) {
      const style = fightingStylesByKey[character.secondFightingStyle];
      featureTexts.push(`Additional Fighting Style: ${style?.name ?? character.secondFightingStyle} (${subclass.name} ${subclass.grantsSecondFightingStyle})`);
    }
  }
  for (const cf of character.customFeatures) featureTexts.push(cf.name);
  const featureBoxH = 138;
  box(ctx, rightColX, ry2 - featureBoxH, rightColW, featureBoxH);
  let fy = ry2 - 10;
  for (const line of featureTexts) {
    const wrapped = wrapText(font, `• ${line}`, 7.5, rightColW - 8);
    for (const wl of wrapped) {
      if (fy < ry2 - featureBoxH + 4) break;
      text(ctx, wl, rightColX + 4, fy, { size: 7.5 });
      fy -= 9.5;
    }
  }
  ry2 -= featureBoxH + 8;

  const halfRightW = (rightColW - 8) / 2;
  sectionHeader(ctx, 'Species Traits', rightColX, ry2, halfRightW);
  sectionHeader(ctx, 'Feats', rightColX + halfRightW + 8, ry2, halfRightW);
  ry2 -= 16;
  const traitsBoxH = 118;
  box(ctx, rightColX, ry2 - traitsBoxH, halfRightW, traitsBoxH);
  let tY = ry2 - 10;
  for (const t of race?.traits ?? []) {
    if (tY < ry2 - traitsBoxH + 4) break;
    const wrapped = wrapText(font, `• ${t.name}`, 7, halfRightW - 8);
    for (const wl of wrapped) {
      if (tY < ry2 - traitsBoxH + 4) break;
      text(ctx, wl, rightColX + 4, tY, { size: 7 });
      tY -= 9;
    }
  }
  box(ctx, rightColX + halfRightW + 8, ry2 - traitsBoxH, halfRightW, traitsBoxH);
  let feY = ry2 - 10;
  for (const featKey of character.feats) {
    const feat = compendium.feats[featKey];
    if (!feat) continue;
    if (feY < ry2 - traitsBoxH + 4) break;
    const wrapped = wrapText(font, `• ${feat.name}`, 7, halfRightW - 8);
    for (const wl of wrapped) {
      if (feY < ry2 - traitsBoxH + 4) break;
      text(ctx, wl, rightColX + halfRightW + 12, feY, { size: 7 });
      feY -= 9;
    }
  }
  ry2 -= traitsBoxH;

  // ---------- Bottom-left: Equipment Training & Proficiencies ----------
  const equipTop = Math.min(leftY, midY) - 6;
  const equipW = abilColW * 2 + gap;
  // Align this box's bottom edge with the right column's (ry2) so both columns
  // end flush, falling back to a sane minimum height if that would be too short.
  const equipBottom = Math.max(MARGIN + 16, Math.min(ry2, equipTop - 130));
  sectionHeader(ctx, 'Equipment Training & Proficiencies', left, equipTop, equipW);
  box(ctx, left, equipBottom, equipW, equipTop - 13 - equipBottom);
  let eq = equipTop - 26;
  text(ctx, 'ARMOR TRAINING', left + 4, eq, { size: 6, color: MUTED, bold: true });
  const armorLabels: [string, string][] = [
    ['Light', 'Light armor'],
    ['Medium', 'Medium armor'],
    ['Heavy', 'Heavy armor'],
    ['Shields', 'Shields'],
  ];
  let ax = left + 90;
  for (const [label, match] of armorLabels) {
    const has = character.armorProficiencies.some((a) => a.toLowerCase().startsWith(match.toLowerCase()));
    diamondPip(ctx, ax, eq - 2, has, 3, INK);
    text(ctx, label, ax + 6, eq - 4, { size: 7 });
    ax += 55;
  }
  eq -= 16;
  text(ctx, 'WEAPONS', left + 4, eq, { size: 6, color: MUTED, bold: true });
  eq -= 10;
  const weaponProfLines = wrapText(font, character.weaponProficiencies.join(', ') || '—', 7.5, equipW - 8);
  for (const line of weaponProfLines.slice(0, 3)) {
    text(ctx, line, left + 4, eq, { size: 7.5 });
    eq -= 10;
  }
  eq -= 6;
  text(ctx, 'TOOLS', left + 4, eq, { size: 6, color: MUTED, bold: true });
  eq -= 10;
  const toolLines = wrapText(font, character.toolProficiencies.join(', ') || '—', 7.5, equipW - 8);
  for (const line of toolLines.slice(0, 3)) {
    text(ctx, line, left + 4, eq, { size: 7.5 });
    eq -= 10;
  }

  footer(ctx, character);

  // ================= PAGE 2: Spellcasting + Bio =================
  newPage(ctx);
  const spellcasting = getSpellcastingClasses(character, compendium);
  const primarySpellcasting = spellcasting[0];
  const bioColW = 190;
  const bioColX = right - bioColW;
  const spellColW = bioColX - left - 10;

  let p2Top = PAGE_H - MARGIN;
  // Spellcasting stat block (top-left) + spell slots (top-right of the left area)
  const scBlockW = 140;
  box(ctx, left, p2Top - 4 * 20 - 4, scBlockW, 4 * 20 + 4);
  const scRows: [string, string][] = [
    ['Spellcasting Ability', primarySpellcasting ? ABILITY_NAMES[primarySpellcasting.ability] : '—'],
    ['Spellcasting Modifier', primarySpellcasting ? formatModifier(mods[primarySpellcasting.ability]) : '—'],
    ['Spell Save DC', primarySpellcasting ? String(primarySpellcasting.saveDC) : '—'],
    ['Spell Attack Bonus', primarySpellcasting ? formatModifier(primarySpellcasting.attackBonus) : '—'],
  ];
  let scy = p2Top - 12;
  for (const [label, value] of scRows) {
    text(ctx, label.toUpperCase(), left + 4, scy, { size: 5.5, color: MUTED, bold: true });
    text(ctx, value, left + scBlockW - 8 - font.widthOfTextAtSize(value, 9), scy, { size: 9, bold: true });
    ctx.page.drawLine({ start: { x: left, y: scy - 6 }, end: { x: left + scBlockW, y: scy - 6 }, color: FAINT, thickness: 0.4 });
    scy -= 20;
  }

  const slotsX = left + scBlockW + 10;
  const slotsW = spellColW - scBlockW - 10;
  const slotsH = 4 * 20 + 4;
  sectionHeader(ctx, 'Spell Slots', slotsX, p2Top, slotsW, 13);
  box(ctx, slotsX, p2Top - slotsH - 13, slotsW, slotsH + 13 - 13);
  const slots = getSpellSlots(character, compendium);
  const slotColW = slotsW / 3;
  for (let lvl = 1; lvl <= 9; lvl++) {
    const col = Math.floor((lvl - 1) / 3);
    const row = (lvl - 1) % 3;
    const cx = slotsX + col * slotColW + 4;
    const cy = p2Top - 26 - row * 20;
    const total = slots[lvl - 1] ?? 0;
    const expended = character.spellSlotsUsed[lvl] ?? 0;
    text(ctx, `Lv ${lvl}`, cx, cy, { size: 6.5, bold: true, color: total > 0 ? INK : FAINT });
    if (total > 0) {
      for (let i = 0; i < total; i++) diamondPip(ctx, cx + 26 + i * 6, cy + 2, i < expended, 2.6, ACCENT);
    }
  }
  p2Top -= Math.max(4 * 20 + 4, slotsH + 13) + 10;

  // Cantrips & Prepared Spells table (left/main column)
  sectionHeader(ctx, 'Cantrips & Prepared Spells', left, p2Top, spellColW);
  p2Top -= 16;
  const spCols = {
    level: left + 2,
    name: left + 22,
    time: left + spellColW * 0.42,
    range: left + spellColW * 0.58,
    crm: left + spellColW * 0.74,
    notes: left + spellColW * 0.9,
  };
  text(ctx, 'Lv', spCols.level, p2Top, { size: 6, color: MUTED });
  text(ctx, 'Name', spCols.name, p2Top, { size: 6, color: MUTED });
  text(ctx, 'Cast Time', spCols.time, p2Top, { size: 6, color: MUTED });
  text(ctx, 'Range', spCols.range, p2Top, { size: 6, color: MUTED });
  text(ctx, 'C/R/M', spCols.crm, p2Top, { size: 6, color: MUTED });
  text(ctx, 'Notes', spCols.notes, p2Top, { size: 6, color: MUTED });
  p2Top -= 10;
  const spellTableTop = p2Top;

  const knownSpells = character.spellsKnown
    .map((k) => compendium.spells[k])
    .filter(Boolean)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const spellRowH = 13;
  const bioBottomEstimate = MARGIN + 4; // spell table can run the rest of the page
  const spellRows = Math.max(knownSpells.length, Math.floor((spellTableTop - bioBottomEstimate) / spellRowH) - 1);
  for (let i = 0; i < spellRows; i++) {
    const sp = knownSpells[i];
    const rowY = spellTableTop - i * spellRowH;
    if (rowY < bioBottomEstimate) break;
    if (sp) {
      const prepared = character.spellsPrepared.includes(sp.key);
      text(ctx, sp.level === 0 ? 'C' : String(sp.level), spCols.level, rowY - 9, { size: 7 });
      text(ctx, `${sp.name}${prepared ? ' •' : ''}`, spCols.name, rowY - 9, { size: 7.5, bold: prepared });
      text(ctx, sp.castingTime, spCols.time, rowY - 9, { size: 6.5 });
      text(ctx, sp.range, spCols.range, rowY - 9, { size: 6.5 });
      const crm = [sp.concentration ? 'C' : null, sp.ritual ? 'R' : null, /\bM\b/.test(sp.components) ? 'M' : null].filter(Boolean).join(' ');
      text(ctx, crm || '—', spCols.crm, rowY - 9, { size: 6.5, color: crm ? INK : FAINT });
    }
    ctx.page.drawLine({ start: { x: left, y: rowY - spellRowH + 2 }, end: { x: left + spellColW, y: rowY - spellRowH + 2 }, color: FAINT, thickness: 0.4 });
  }
  ctx.page.drawLine({ start: { x: left, y: spellTableTop + 4 }, end: { x: left + spellColW, y: spellTableTop + 4 }, color: LINE, thickness: 0.6 });
  box(ctx, left, spellTableTop - spellRows * spellRowH, spellColW, spellRows * spellRowH + 4);
  const pactSlots = getPactMagicSlots(character, compendium);
  if (pactSlots) {
    text(ctx, `Pact Magic: ${pactSlots.slots} slot${pactSlots.slots === 1 ? '' : 's'} of level ${pactSlots.slotLevel}`, left, spellTableTop - spellRows * spellRowH - 10, { size: 7, color: MUTED });
  }

  // ---------- Right column: Appearance, Backstory & Personality, Languages, Equipment, Coins ----------
  let by = PAGE_H - MARGIN;
  function bioBox(label: string, value: string | undefined, h: number, opts: { valueSize?: number; extraLine?: string } = {}) {
    sectionHeader(ctx, label, bioColX, by, bioColW, 13);
    by -= 15;
    box(ctx, bioColX, by - h, bioColW, h);
    const lines = wrapText(font, value || '', opts.valueSize ?? 7.5, bioColW - 8);
    let vy = by - 10;
    const maxLines = Math.floor((h - (opts.extraLine ? 14 : 4)) / 10);
    for (const line of lines.slice(0, maxLines)) {
      text(ctx, line, bioColX + 4, vy, { size: opts.valueSize ?? 7.5 });
      vy -= 10;
    }
    if (opts.extraLine) {
      text(ctx, opts.extraLine, bioColX + 4, by - h + 8, { size: 7.5, bold: true });
    }
    by -= h + 6;
  }

  bioBox('Appearance', character.appearance, 90);
  bioBox(
    'Backstory & Personality',
    [character.backstory, character.personalityTraits, character.ideals, character.bonds, character.flaws].filter(Boolean).join('\n\n'),
    190,
    { extraLine: `Alignment: ${character.alignment || '—'}` },
  );
  bioBox('Languages', character.languages.join(', '), 60);

  // Equipment (+ attunement)
  sectionHeader(ctx, 'Equipment', bioColX, by, bioColW, 13);
  by -= 15;
  const attunedItems = character.inventory.filter((inv) => inv.attuned).map((inv) => (inv.itemKey ? compendium.items[inv.itemKey]?.name : inv.customName)).filter(Boolean) as string[];
  const equipBoxH = 150;
  box(ctx, bioColX, by - equipBoxH, bioColW, equipBoxH);
  const equipItemLines = character.inventory
    .map((inv) => {
      const name = inv.itemKey ? compendium.items[inv.itemKey]?.name : inv.customName;
      if (!name) return null;
      return `${name}${inv.quantity > 1 ? ` x${inv.quantity}` : ''}`;
    })
    .filter(Boolean) as string[];
  let eqy = by - 10;
  const attuneReserve = 34;
  for (const line of equipItemLines) {
    if (eqy < by - equipBoxH + attuneReserve) break;
    text(ctx, `• ${line}`, bioColX + 4, eqy, { size: 7 });
    eqy -= 9.5;
  }
  text(ctx, 'MAGIC ITEM ATTUNEMENT', bioColX + 4, by - equipBoxH + 26, { size: 5.5, color: MUTED, bold: true });
  // Three attunement slots on one line, marked used up to attunedItems.length.
  for (let i = 0; i < 3; i++) {
    diamondPip(ctx, bioColX + 8 + i * 14, by - equipBoxH + 14, i < attunedItems.length, 3, ACCENT);
  }
  text(ctx, attunedItems.join(', ') || '', bioColX + 44, by - equipBoxH + 11, { size: 6.5, color: MUTED });
  by -= equipBoxH + 6;

  // Coins
  sectionHeader(ctx, 'Coins', bioColX, by, bioColW, 13);
  by -= 15;
  const coinBoxH = 40;
  box(ctx, bioColX, by - coinBoxH, bioColW, coinBoxH);
  const coinCols: [string, number][] = [
    ['CP', character.currency.cp],
    ['SP', character.currency.sp],
    ['EP', character.currency.ep],
    ['GP', character.currency.gp],
    ['PP', character.currency.pp],
  ];
  const coinW = bioColW / 5;
  coinCols.forEach(([label, value], i) => {
    const cx = bioColX + i * coinW;
    text(ctx, label, cx, by - 12, { size: 6, color: MUTED, align: 'center', maxWidth: coinW });
    text(ctx, String(value), cx, by - 28, { size: 10, bold: true, align: 'center', maxWidth: coinW });
  });

  footer(ctx, character);

  return pdf.save();
}
