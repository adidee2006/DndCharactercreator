/** 2024 rules condition effects, for reference display — the app can't fold "advantage/disadvantage" into a flat modifier, so these are shown as text rather than baked into calculated numbers (unlike exhaustion and Grappled/Restrained's speed-0, which are numeric and applied directly). */
export const CONDITION_EFFECTS: Record<string, string> = {
  blinded: 'Can’t see, automatically fails sight-based checks. Attack rolls against you have advantage; your attack rolls have disadvantage.',
  charmed: 'Can’t attack the charmer or target them with harmful abilities/spells. The charmer has advantage on social checks against you.',
  deafened: 'Can’t hear, automatically fails hearing-based checks.',
  frightened: 'Disadvantage on ability checks and attack rolls while the source of fear is in sight. Can’t willingly move closer to it.',
  grappled: 'Speed is 0 and can’t benefit from any bonus to speed. Ends if the grappler is incapacitated or you’re moved out of reach.',
  incapacitated: 'Can’t take actions, bonus actions, or reactions; can’t speak; ability checks made against you have advantage.',
  invisible: 'Impossible to see without magic/special sense. Heavily obscured for hiding purposes. Attack rolls against you have disadvantage; your attack rolls have advantage.',
  paralyzed: 'Incapacitated and can’t move or speak. Automatically fails Str/Dex saves. Attacks against you have advantage, and any hit that lands within 5 feet is a critical hit.',
  petrified: 'Transformed to stone; incapacitated, can’t move or speak, unaware of surroundings. Resistance to all damage, immune to poison and disease. Fails Str/Dex saves; attacks against you have advantage.',
  poisoned: 'Disadvantage on attack rolls and ability checks.',
  prone: 'Can only crawl unless it stands up. Disadvantage on attack rolls. Melee attacks against you have advantage; ranged attacks against you have disadvantage.',
  restrained: 'Speed is 0. Attack rolls against you have advantage, your attack rolls have disadvantage. Disadvantage on Dexterity saving throws.',
  stunned: 'Incapacitated, can’t move, can speak only falteringly. Automatically fails Str/Dex saves. Attack rolls against you have advantage.',
  unconscious: 'Incapacitated, can’t move or speak, unaware of surroundings, drops what it’s holding, falls prone. Automatically fails Str/Dex saves. Attacks against you have advantage, and any hit within 5 feet is a critical hit.',
  exhaustion: 'Each level gives -2 to ability checks, attack rolls, and saving throws, and reduces speed by 5 feet — both already applied to this sheet’s numbers. At level 6, you die.',
};

/** Best-effort match against the known condition list (case/whitespace-insensitive; ignores anything typed that isn't a recognized condition name). */
export function knownConditionEffect(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return CONDITION_EFFECTS[key] ?? null;
}
