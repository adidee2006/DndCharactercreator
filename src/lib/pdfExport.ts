import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Character } from '../types/character';
import type { Compendium } from '../types/compendium';
import { ABILITY_KEYS, ABILITY_NAMES, SKILLS } from '../types/compendium';
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

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 30;
const INK = rgb(0.12, 0.1, 0.2);
const MUTED = rgb(0.4, 0.4, 0.45);
const LINE = rgb(0.6, 0.6, 0.65);
const ACCENT = rgb(0.45, 0.12, 0.15);

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, borderColor: LINE, borderWidth: 0.75 });
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

/** Draws a small circular proficiency pip (filled = proficient) without relying on font glyph support. */
function pip(ctx: Ctx, cx: number, cy: number, filled: boolean, radius = 3) {
  ctx.page.drawEllipse({
    x: cx,
    y: cy,
    xScale: radius,
    yScale: radius,
    color: filled ? INK : undefined,
    borderColor: INK,
    borderWidth: 0.75,
  });
}

/** Draws a small diamond pip for expertise. */
function diamondPip(ctx: Ctx, cx: number, cy: number, radius = 3.2) {
  ctx.page.drawSvgPath(`M ${-radius} 0 L 0 ${-radius} L ${radius} 0 L 0 ${radius} Z`, {
    x: cx,
    y: cy,
    color: ACCENT,
    borderColor: ACCENT,
    borderWidth: 0.5,
  });
}

function labeledBox(ctx: Ctx, x: number, y: number, w: number, h: number, label: string, value: string, valueSize = 16) {
  box(ctx, x, y, w, h);
  text(ctx, value, x, y + h - valueSize - 4, { size: valueSize, bold: true, align: 'center', maxWidth: w });
  text(ctx, label.toUpperCase(), x, y + 3, { size: 6, color: MUTED, align: 'center', maxWidth: w });
}

function wrapText(font: PDFFont, str: string, size: number, maxWidth: number): string[] {
  const words = sanitizeForPdf(str).split(/\s+/);
  const lines: string[] = [];
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
  if (current) lines.push(current);
  return lines;
}

function sectionHeader(ctx: Ctx, str: string, x: number, y: number, w: number) {
  text(ctx, str.toUpperCase(), x, y, { size: 8, bold: true, color: rgb(1, 1, 1) });
  ctx.page.drawRectangle({ x, y: y - 3, width: w, height: 13, color: ACCENT });
  text(ctx, str.toUpperCase(), x + 3, y, { size: 8, bold: true, color: rgb(1, 1, 1) });
}

function newPage(ctx: Ctx, title: string): PDFPage {
  const page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.page = page;
  text(ctx, title, MARGIN, PAGE_H - MARGIN + 4, { size: 9, color: MUTED });
  return page;
}

export async function generateCharacterSheetPdf(character: Character, compendium: Compendium): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${character.name} - Character Sheet`);
  pdf.setSubject('D&D Character Sheet (generated by DnD Character Creator)');

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = { pdf, page, font, bold };

  const mods = getAbilityModifiers(character, compendium);
  const scores = getFinalAbilityScores(character, compendium);
  const prof = getProficiencyBonus(character);
  const race = compendium.races[character.race.key];
  const subrace = race?.subraces?.find((sr) => sr.key === character.race.subraceKey);
  const background = compendium.backgrounds[character.background];
  const classLine = character.classes
    .filter((c) => c.classKey)
    .map((c) => {
      const cls = compendium.classes[c.classKey];
      const subclass = cls?.subclasses.find((s) => s.key === c.subclassKey);
      const name = cls?.name ?? c.classKey;
      return `${name}${subclass ? ` (${subclass.name})` : ''} ${c.level}`;
    })
    .join(' / ');

  let y = PAGE_H - MARGIN;

  // Header
  text(ctx, character.name || 'Unnamed Character', MARGIN, y - 20, { size: 22, bold: true });
  text(ctx, 'D&D CHARACTER SHEET', PAGE_W - MARGIN - 160, y - 10, { size: 9, color: MUTED, align: 'right', maxWidth: 160 });
  y -= 34;

  const headerFields: [string, string][] = [
    ['Class & Level', classLine || '—'],
    ['Background', background?.name ?? '—'],
    ['Player Name', character.playerName || '—'],
    ['Race', subrace ? `${race?.name} (${subrace.name})` : race?.name ?? '—'],
    ['Alignment', character.alignment || '—'],
  ];
  const hw = (PAGE_W - MARGIN * 2) / headerFields.length;
  headerFields.forEach(([label, value], i) => {
    const x = MARGIN + i * hw;
    box(ctx, x, y - 28, hw - 4, 28);
    text(ctx, value, x + 4, y - 12, { size: 9, bold: true });
    text(ctx, label.toUpperCase(), x + 4, y - 24, { size: 6, color: MUTED });
  });
  y -= 40;

  const colLeftX = MARGIN;
  const colLeftW = 78;
  const colMidX = colLeftX + colLeftW + 8;
  const colMidW = 150;
  const colRightX = colMidX + colMidW + 10;
  const colRightW = PAGE_W - MARGIN - colRightX;

  const topY = y;

  // Abilities column
  let ay = topY;
  for (const key of ABILITY_KEYS) {
    labeledBox(ctx, colLeftX, ay - 62, colLeftW, 62, ABILITY_NAMES[key], formatModifier(mods[key]));
    text(ctx, String(scores[key]), colLeftX, ay - 62 + 4, { size: 8, align: 'center', maxWidth: colLeftW, color: MUTED });
    ay -= 68;
  }

  // Saving throws + Skills column
  let my = topY;
  sectionHeader(ctx, 'Saving Throws', colMidX, my - 10, colMidW);
  my -= 16;
  box(ctx, colMidX, my - ABILITY_KEYS.length * 12 - 4, colMidW, ABILITY_KEYS.length * 12 + 4);
  for (const key of ABILITY_KEYS) {
    const proficient = character.savingThrowProficiencies.includes(key);
    const val = getSavingThrowModifier(character, compendium, key);
    pip(ctx, colMidX + 7, my - 6, proficient);
    text(ctx, ABILITY_NAMES[key], colMidX + 16, my - 9, { size: 8 });
    text(ctx, formatModifier(val), colMidX + colMidW - 24, my - 9, { size: 8, bold: true });
    my -= 12;
  }
  my -= 12;

  const skillKeys = Object.keys(SKILLS) as (keyof typeof SKILLS)[];
  sectionHeader(ctx, 'Skills', colMidX, my - 10, colMidW);
  my -= 16;
  box(ctx, colMidX, my - skillKeys.length * 11 - 4, colMidW, skillKeys.length * 11 + 4);
  for (const key of skillKeys) {
    const isExpert = character.skillExpertise.includes(key);
    const isProficient = character.skillProficiencies.includes(key) || isExpert;
    const val = getSkillModifier(character, compendium, key);
    if (isExpert) diamondPip(ctx, colMidX + 7, my - 5);
    else pip(ctx, colMidX + 7, my - 5, isProficient, 2.6);
    text(ctx, `${SKILLS[key].name} (${SKILLS[key].ability.toUpperCase()})`, colMidX + 16, my - 8, { size: 7.5 });
    text(ctx, formatModifier(val), colMidX + colMidW - 22, my - 8, { size: 7.5, bold: true });
    my -= 11;
  }
  my -= 10;
  labeledBox(ctx, colMidX, my - 30, colMidW, 30, 'Passive Perception', String(getPassiveSkill(character, compendium, 'perception')), 14);

  // Right column: combat stats
  let ry = topY;
  const third = (colRightW - 8) / 3;
  labeledBox(ctx, colRightX, ry - 46, third, 46, 'Armor Class', String(getArmorClass(character, compendium)), 18);
  labeledBox(ctx, colRightX + third + 4, ry - 46, third, 46, 'Initiative', formatModifier(getInitiative(character, compendium)), 18);
  labeledBox(ctx, colRightX + (third + 4) * 2, ry - 46, third, 46, 'Speed', `${getSpeed(character, compendium)} ft`, 16);
  ry -= 54;

  labeledBox(ctx, colRightX, ry - 24, 60, 24, 'Prof. Bonus', formatModifier(prof), 12);
  const hitDice = getHitDice(character, compendium)
    .map((hd) => `${hd.count}d${hd.die}`)
    .join(' + ');
  labeledBox(ctx, colRightX + 64, ry - 24, colRightW - 64, 24, 'Hit Dice', hitDice || '—', 12);
  ry -= 32;

  const hpBoxH = 54;
  box(ctx, colRightX, ry - hpBoxH, colRightW, hpBoxH);
  text(ctx, 'HIT POINTS', colRightX + 4, ry - 10, { size: 6, color: MUTED });
  text(ctx, `Max: ${getHitPointsMax(character, compendium)}`, colRightX + 4, ry - 24, { size: 10, bold: true });
  text(ctx, `Current: ${character.hpCurrent}`, colRightX + 4, ry - 38, { size: 10 });
  text(ctx, `Temp: ${character.hpTemp}`, colRightX + 4, ry - 50, { size: 10 });
  ry -= hpBoxH + 6;

  box(ctx, colRightX, ry - 26, colRightW, 26);
  text(ctx, 'DEATH SAVES', colRightX + 4, ry - 9, { size: 6, color: MUTED });
  text(ctx, 'Successes', colRightX + 4, ry - 20, { size: 7 });
  for (let i = 0; i < 3; i++) pip(ctx, colRightX + 52 + i * 10, ry - 17, i < character.deathSaves.successes);
  text(ctx, 'Failures', colRightX + 120, ry - 20, { size: 7 });
  for (let i = 0; i < 3; i++) pip(ctx, colRightX + 162 + i * 10, ry - 17, i < character.deathSaves.failures);
  ry -= 32;

  text(ctx, `Inspiration: ${character.inspiration ? 'Yes' : 'No'}`, colRightX, ry - 8, { size: 8 });
  text(ctx, `Conditions: ${character.conditions.join(', ') || 'None'}`, colRightX, ry - 20, { size: 8 });

  // Combat/ability/skill info reliably fills page 1; give equipment & features a
  // fresh page rather than cramming it in below (it doesn't reliably fit).
  newPage(ctx, `${character.name} — Equipment & Features`);
  y = PAGE_H - MARGIN - 20;

  // Attacks
  sectionHeader(ctx, 'Attacks & Weapons', MARGIN, y - 10, PAGE_W - MARGIN * 2);
  y -= 18;
  const weaponAttacks = getWeaponAttacks(character, compendium);
  const attackRows = Math.max(4, Math.min(8, weaponAttacks.length));
  box(ctx, MARGIN, y - attackRows * 12 - 14, PAGE_W - MARGIN * 2, attackRows * 12 + 14);
  text(ctx, 'Weapon', MARGIN + 4, y - 10, { size: 7, color: MUTED });
  text(ctx, 'Attack Bonus', MARGIN + 240, y - 10, { size: 7, color: MUTED });
  text(ctx, 'Damage / Type', MARGIN + 340, y - 10, { size: 7, color: MUTED });
  y -= 22;
  for (let i = 0; i < attackRows; i++) {
    const wa = weaponAttacks[i];
    if (wa) {
      text(ctx, wa.item.name, MARGIN + 4, y, { size: 8 });
      text(ctx, formatModifier(wa.attackBonus), MARGIN + 240, y, { size: 8 });
      text(ctx, wa.damageText, MARGIN + 340, y, { size: 8 });
    }
    y -= 12;
  }
  y -= 14;

  // Equipment + Proficiencies (two columns)
  const halfW = (PAGE_W - MARGIN * 2 - 10) / 2;
  sectionHeader(ctx, 'Equipment', MARGIN, y - 10, halfW);
  sectionHeader(ctx, 'Proficiencies & Languages', MARGIN + halfW + 10, y - 10, halfW);
  y -= 18;
  const equipStartY = y;
  const equipLines = character.inventory
    .map((inv) => {
      const name = inv.itemKey ? compendium.items[inv.itemKey]?.name : inv.customName;
      if (!name) return null;
      return `${name}${inv.quantity > 1 ? ` x${inv.quantity}` : ''}${inv.equipped ? ' (equipped)' : ''}`;
    })
    .filter(Boolean) as string[];
  const currency = character.currency;
  equipLines.push(`Currency: ${currency.pp}pp ${currency.gp}gp ${currency.ep}ep ${currency.sp}sp ${currency.cp}cp`);
  const boxHeight = Math.max(60, Math.min(140, equipLines.length * 10 + 8));
  box(ctx, MARGIN, equipStartY - boxHeight, halfW, boxHeight);
  let ey = equipStartY - 10;
  for (const line of equipLines) {
    if (ey < equipStartY - boxHeight + 4) break;
    text(ctx, `• ${line}`, MARGIN + 4, ey, { size: 7.5 });
    ey -= 10;
  }

  const profLines = [
    ...character.languages.map((l) => `Language: ${l}`),
    ...character.armorProficiencies.map((a) => `Armor: ${a}`),
    ...character.weaponProficiencies.map((w) => `Weapon: ${w}`),
    ...character.toolProficiencies.map((t) => `Tool: ${t}`),
  ];
  box(ctx, MARGIN + halfW + 10, equipStartY - boxHeight, halfW, boxHeight);
  let py = equipStartY - 10;
  for (const line of profLines) {
    if (py < equipStartY - boxHeight + 4) break;
    text(ctx, `• ${line}`, MARGIN + halfW + 14, py, { size: 7.5 });
    py -= 10;
  }
  y = equipStartY - boxHeight - 14;

  // Features & Traits
  sectionHeader(ctx, 'Features & Traits', MARGIN, y - 10, PAGE_W - MARGIN * 2);
  y -= 20;
  const featureTexts: string[] = [];
  for (const cl of character.classes) {
    const cls = compendium.classes[cl.classKey];
    if (!cls) continue;
    for (const f of cls.features) {
      if (f.level > cl.level) continue;
      if (f.name.includes('Fighting Style') && character.fightingStyle) {
        const style = fightingStylesByKey[character.fightingStyle];
        featureTexts.push(`Fighting Style: ${style?.name ?? character.fightingStyle} (${cls.name} ${f.level})`);
      } else {
        featureTexts.push(`${f.name} (${cls.name} ${f.level})`);
      }
    }
    const subclass = cls.subclasses.find((s) => s.key === cl.subclassKey);
    if (subclass) for (const f of subclass.features) if (f.level <= cl.level) featureTexts.push(`${f.name} (${subclass.name} ${f.level})`);
    if (subclass?.grantsSecondFightingStyle && cl.level >= subclass.grantsSecondFightingStyle && character.secondFightingStyle) {
      const style = fightingStylesByKey[character.secondFightingStyle];
      featureTexts.push(`Fighting Style: ${style?.name ?? character.secondFightingStyle} (${subclass.name} ${subclass.grantsSecondFightingStyle})`);
    }
  }
  if (race) for (const t of race.traits) featureTexts.push(t.name);
  for (const cf of character.customFeatures) featureTexts.push(cf.name);

  const featureLine = featureTexts.join('  •  ');
  const wrapped = wrapText(font, featureLine, 8, PAGE_W - MARGIN * 2 - 8);
  const featBoxLines = Math.min(wrapped.length, 6);
  box(ctx, MARGIN, y - featBoxLines * 11 - 6, PAGE_W - MARGIN * 2, featBoxLines * 11 + 6);
  wrapped.slice(0, 6).forEach((line, i) => text(ctx, line, MARGIN + 4, y - 10 - i * 11, { size: 8 }));

  // ---- Page 2: Spellcasting + Bio ----
  const spellcasting = getSpellcastingClasses(character, compendium);
  const hasSpells = spellcasting.length > 0 || character.spellsKnown.length > 0;

  newPage(ctx, `${character.name} — Spells & Background`);
  let y2 = PAGE_H - MARGIN - 20;

  if (hasSpells) {
    sectionHeader(ctx, 'Spellcasting', MARGIN, y2 - 10, PAGE_W - MARGIN * 2);
    y2 -= 22;
    for (const sc of spellcasting) {
      const cls = compendium.classes[sc.classKey];
      text(ctx, `${cls?.name ?? sc.classKey}: Ability ${sc.ability.toUpperCase()}  •  Save DC ${sc.saveDC}  •  Attack Bonus ${formatModifier(sc.attackBonus)}`, MARGIN, y2, { size: 9 });
      y2 -= 14;
    }
    const slots = getSpellSlots(character, compendium);
    if (slots.length) {
      text(ctx, `Spell Slots: ${slots.map((n, i) => `Lv${i + 1}: ${n}`).join('   ')}`, MARGIN, y2, { size: 9 });
      y2 -= 14;
    }
    const pact = getPactMagicSlots(character, compendium);
    if (pact) {
      text(ctx, `Pact Magic Slots: ${pact.slots} x Level ${pact.slotLevel}`, MARGIN, y2, { size: 9 });
      y2 -= 14;
    }
    y2 -= 6;

    const spellNames = character.spellsKnown
      .map((k) => compendium.spells[k])
      .filter(Boolean)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const grouped = new Map<number, string[]>();
    for (const sp of spellNames) {
      const arr = grouped.get(sp.level) ?? [];
      const prepared = character.spellsPrepared.includes(sp.key) ? ' (prepared)' : '';
      arr.push(`${sp.name}${prepared}`);
      grouped.set(sp.level, arr);
    }
    const spellBoxTop = y2;
    const levels = [...grouped.keys()].sort((a, b) => a - b);
    const lineCount = levels.reduce((sum, lvl) => sum + 1 + (grouped.get(lvl)?.length ?? 0), 0) + 1;
    const spellBoxH = Math.min(400, lineCount * 10 + 8);
    box(ctx, MARGIN, spellBoxTop - spellBoxH, PAGE_W - MARGIN * 2, spellBoxH);
    let sy = spellBoxTop - 10;
    for (const lvl of levels) {
      text(ctx, lvl === 0 ? 'Cantrips' : `Level ${lvl}`, MARGIN + 4, sy, { size: 8, bold: true });
      sy -= 10;
      for (const name of grouped.get(lvl) ?? []) {
        if (sy < spellBoxTop - spellBoxH + 4) break;
        text(ctx, name, MARGIN + 12, sy, { size: 7.5 });
        sy -= 10;
      }
    }
    y2 = spellBoxTop - spellBoxH - 16;
  }

  sectionHeader(ctx, 'Personality & Background', MARGIN, y2 - 10, PAGE_W - MARGIN * 2);
  y2 -= 22;
  const bioFields: [string, string | undefined][] = [
    ['Personality Traits', character.personalityTraits],
    ['Ideals', character.ideals],
    ['Bonds', character.bonds],
    ['Flaws', character.flaws],
    ['Backstory', character.backstory],
    ['Appearance', character.appearance],
    ['Notes', character.notes],
  ];
  for (const [label, value] of bioFields) {
    if (!value) continue;
    text(ctx, label.toUpperCase(), MARGIN, y2, { size: 7, color: MUTED, bold: true });
    y2 -= 11;
    const lines = wrapText(font, value, 9, PAGE_W - MARGIN * 2);
    for (const line of lines.slice(0, 6)) {
      text(ctx, line, MARGIN, y2, { size: 9 });
      y2 -= 12;
    }
    y2 -= 6;
    if (y2 < MARGIN + 20) break;
  }

  return pdf.save();
}
