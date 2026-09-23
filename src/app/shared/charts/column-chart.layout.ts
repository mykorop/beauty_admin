/**
 * The geometry of a column chart — pure, so the arithmetic that decides what the reader sees can be
 * checked without drawing anything. The marks follow the panel's data-viz rules: columns no thicker
 * than 24px and never filling their slot, a 2px surface gap between stacked segments instead of a
 * border, and a 4px rounded data end with a square foot on the baseline.
 */

const TARGET_TICKS = 4;
const MAX_BAR_WIDTH = 24;
/** The share of its slot a column may take; the rest is the air between columns. */
const BAR_FILL = 0.72;
const SEGMENT_GAP = 2;
const CORNER_RADIUS = 4;

/**
 * A y scale from zero to a clean number just above `max`, and the ticks along it. A count never
 * gets a fractional tick — «2.5 Записи» is not a thing — and an empty chart still gets a scale.
 */
export function niceScale(
  max: number,
  options: { integer?: boolean } = {},
): { max: number; ticks: number[] } {
  if (!(max > 0)) {
    return { max: 1, ticks: [0, 1] };
  }
  const raw = max / TARGET_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const multipliers = options.integer && magnitude <= 1 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = multipliers.find((multiplier) => multiplier * magnitude >= raw)! * magnitude;
  if (options.integer) {
    step = Math.max(1, step);
  }
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let index = 0; index * step <= top + step / 2; index += 1) {
    ticks.push(round(index * step, 10));
  }
  return { max: round(top, 10), ticks };
}

export type ColumnSegment = {
  /** Which series the segment draws, by its position in the stack. */
  series: number;
  y: number;
  height: number;
  /** The topmost segment of its column — the one that carries the rounded data end. */
  top: boolean;
};

export type ColumnLayout = {
  /** The width of the slot each point owns — also the width of its hover target. */
  band: number;
  barWidth: number;
  columns: { x: number; segments: ColumnSegment[] }[];
};

/**
 * Columns for `stacks[point][series]` in a plot of the given size, `scaleMax` at its top edge.
 * Segments stand on the baseline in series order; each one below the top gives 2px of its own top
 * to the gap above it, unless it is too thin to spare them.
 */
export function layoutColumns(
  stacks: readonly (readonly number[])[],
  plot: { width: number; height: number },
  scaleMax: number,
): ColumnLayout {
  const band = stacks.length === 0 ? 0 : plot.width / stacks.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, band * BAR_FILL);

  const columns = stacks.map((values, index) => {
    const topSeries = values.reduce((last, value, series) => (value > 0 ? series : last), -1);
    let cursor = plot.height;
    const segments: ColumnSegment[] = [];
    values.forEach((value, series) => {
      if (!(value > 0)) {
        return;
      }
      const height = (value / scaleMax) * plot.height;
      cursor -= height;
      const top = series === topSeries;
      const gap = !top && height > SEGMENT_GAP * 1.5 ? SEGMENT_GAP : 0;
      segments.push({ series, y: cursor + gap, height: height - gap, top });
    });
    return { x: index * band + (band - barWidth) / 2, segments };
  });

  return { band, barWidth, columns };
}

/** The SVG path of one segment: square all round, except the rounded top of a column's top one. */
export function segmentPath(segment: ColumnSegment, x: number, width: number): string {
  const { y, height } = segment;
  const bottom = y + height;
  if (!segment.top) {
    return `M${coordinate(x)},${coordinate(bottom)}V${coordinate(y)}H${coordinate(x + width)}V${coordinate(bottom)}Z`;
  }
  const r = Math.min(CORNER_RADIUS, width / 2, height);
  return (
    `M${coordinate(x)},${coordinate(bottom)}V${coordinate(y + r)}Q${coordinate(x)},${coordinate(y)} ${coordinate(x + r)},${coordinate(y)}` +
    `H${coordinate(x + width - r)}Q${coordinate(x + width)},${coordinate(y)} ${coordinate(x + width)},${coordinate(y + r)}V${coordinate(bottom)}Z`
  );
}

/**
 * Which points get an x-axis label: evenly spaced, at most `max` of them, and always the latest —
 * the day the reader is most likely to look for.
 */
export function labelledIndexes(count: number, max: number): number[] {
  if (count <= 0) {
    return [];
  }
  const step = Math.ceil(count / max);
  const indexes: number[] = [];
  for (let index = (count - 1) % step; index < count; index += step) {
    indexes.push(index);
  }
  return indexes;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** A coordinate as it goes into a path: two decimals at most, no trailing zeros. */
function coordinate(value: number): string {
  return String(round(value, 2));
}
