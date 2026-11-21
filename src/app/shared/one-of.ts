/**
 * The allowed value `raw` names, or `null` — how a screen reads a choice out of its address, where
 * anything a hand-edited link got wrong reads as "not set".
 */
export const oneOf = <T extends string>(allowed: readonly T[], raw: string | null): T | null =>
  allowed.find((value) => value === raw) ?? null;
