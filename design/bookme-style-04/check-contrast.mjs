// Run from beauty_admin: node design/bookme-style-04/check-contrast.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const theme = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries(
  [...theme.matchAll(/--bm-([\w-]+):\s*(#[\da-f]{6})/g)].map(([, key, value]) => [key, value]),
);
const luminance = (hex) => {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const ratios = [];
function check(role, foreground, background, minimum = 4.5) {
  const fg = luminance(foreground),
    bg = luminance(background);
  const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  ratios.push({ role, foreground, background, ratio: Number(ratio.toFixed(2)), minimum });
  if (ratio < minimum) throw new Error(`${role}: ${ratio.toFixed(2)} < ${minimum}`);
}
for (const background of [tokens.bg, tokens.panel, tokens.raised, '#352e20']) {
  check('text', tokens.text, background);
  check('secondary text', tokens.muted, background);
  check('warning text', tokens.warning, background);
  check('focus', tokens.accent, background, 3);
  check('control boundary', tokens['input-border'], background, 3);
}
check('destructive action / warning', tokens.danger, tokens.panel);
check('destructive action border', '#f87171', tokens.panel, 3);
check('primary action text', tokens.bg, tokens.accent);
for (const [status, color, tint] of [
  ['visible review', '#86efac', '#22c55e'],
  ['hidden review', '#fdba74', '#f97316'],
]) {
  // PrimeNG dark tags: a 16% status tint composited onto the table/detail surface.
  for (const surface of [tokens.panel, tokens.raised, '#352e20']) {
    const channels = (hex) =>
      hex
        .slice(1)
        .match(/../g)
        .map((value) => parseInt(value, 16));
    const base = channels(surface);
    const background =
      '#' +
      channels(tint)
        .map((value, index) =>
          Math.round(value * 0.16 + base[index] * 0.84)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    check(`${status}`, color, background);
  }
}

writeFileSync(new URL('contrast.json', import.meta.url), JSON.stringify(ratios, null, 2) + '\n');
console.log(`${ratios.length} combinations pass; text ≥4.5:1, focus and control boundaries ≥3:1.`);
