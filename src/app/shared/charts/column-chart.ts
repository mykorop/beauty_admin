import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { labelledIndexes, layoutColumns, niceScale, segmentPath } from './column-chart.layout';

/** One position on the x axis: its key, its axis label and the fuller name its tooltip gives it. */
export type ChartPoint = { key: string; label: string; title: string };

/** One series: its colour (a slot of `CHART_SERIES_COLORS`) and a value per point. */
export type ChartSeries = { key: string; label: string; color: string; values: readonly number[] };

/**
 * The categorical slots of the panel's charts, in their fixed order — the data-viz reference palette,
 * retained in the same order on graphite cards. A series takes the next slot, never a skipped or
 * a made-up one. Every chart also carries a table view with the same values.
 */
export const CHART_SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const;

/** Chart chrome: recessive hairlines and muted axis text, never the colour of a series. */
const INK = {
  grid: 'var(--bm-border)',
  axis: 'var(--bm-input-border)',
  muted: 'var(--bm-muted)',
  hover: 'rgba(245, 242, 235, 0.08)',
};

const MARGIN = { top: 8, right: 8, bottom: 24, left: 52 };
/** Room an x-axis label needs, so a narrow chart gets fewer of them rather than a crowd. */
const X_LABEL_SPACING = 80;
const MAX_X_LABELS = 10;
/** Preferred gap from the column; on narrow charts the tooltip stays inside the plot's width. */
const TOOLTIP_OFFSET = 12;
const TOOLTIP_WIDTH = 240;

/**
 * A column chart — stacked when it is given more than one series — drawn as plain SVG.
 *
 * Hovering or focusing it shows every series at that point; the arrow keys walk the points, so the
 * values are never the mouse's alone. Every chart has a table view with the same numbers, which is
 * also what keeps the lighter colours readable. The geometry lives in `column-chart.layout.ts`.
 */
@Component({
  selector: 'app-column-chart',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '[attr.data-testid]': 'testId()' },
  template: `
    @if (stacked()) {
      <ul
        class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"
        [attr.data-testid]="testId() + '-legend'"
      >
        @for (item of series(); track item.key) {
          <li class="flex items-center gap-1.5">
            <span class="inline-block size-2.5 rounded-sm" [style.background]="item.color"></span>
            {{ item.label }}
          </li>
        }
      </ul>
    }

    @if (empty()) {
      <p class="py-10 text-center text-sm text-muted" [attr.data-testid]="testId() + '-empty'">
        {{ 'chart.empty' | t }}
      </p>
    } @else if (showTable()) {
      <div class="max-h-80 overflow-auto rounded border border-divider">
        <table
          class="w-full text-left text-xs tabular-nums"
          [attr.data-testid]="testId() + '-table'"
        >
          <caption class="sr-only">
            {{
              name()
            }}
          </caption>
          <thead class="sticky top-0 bg-raised text-muted">
            <tr>
              <th class="px-2 py-1 font-medium">{{ 'chart.table.point' | t }}</th>
              @for (item of series(); track item.key) {
                <th class="px-2 py-1 text-right font-medium">{{ item.label }}</th>
              }
              @if (stacked()) {
                <th class="px-2 py-1 text-right font-medium">{{ 'chart.table.total' | t }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (point of points(); track point.key; let index = $index) {
              <tr class="border-t border-divider">
                <td class="px-2 py-1">{{ point.title }}</td>
                @for (item of series(); track item.key) {
                  <td class="px-2 py-1 text-right">{{ formatValue()(item.values[index]) }}</td>
                }
                @if (stacked()) {
                  <td class="px-2 py-1 text-right font-medium">
                    {{ formatValue()(totals()[index]) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="relative">
        <svg
          class="block max-w-full select-none rounded"
          role="img"
          tabindex="0"
          [attr.width]="width()"
          [attr.height]="svgHeight()"
          [attr.aria-label]="name()"
          (pointermove)="pointAt($event)"
          (pointerleave)="hovered.set(null)"
          (focus)="hovered.set(points().length - 1)"
          (blur)="hovered.set(null)"
          (keydown)="step($event)"
        >
          @for (tick of ticks(); track tick.value) {
            @if (tick.value !== 0) {
              <line
                [attr.x1]="margin.left"
                [attr.x2]="width() - margin.right"
                [attr.y1]="tick.y"
                [attr.y2]="tick.y"
                [attr.stroke]="ink.grid"
                stroke-width="1"
                shape-rendering="crispEdges"
              />
            }
            <text
              class="text-[11px] tabular-nums"
              text-anchor="end"
              dominant-baseline="middle"
              [attr.x]="margin.left - 6"
              [attr.y]="tick.y"
              [attr.fill]="ink.muted"
            >
              {{ tick.label }}
            </text>
          }
          @if (hoverBand(); as band) {
            <rect
              [attr.x]="band.x"
              [attr.y]="margin.top"
              [attr.width]="band.width"
              [attr.height]="plotHeight()"
              [attr.fill]="ink.hover"
            />
          }
          <g [attr.transform]="'translate(' + margin.left + ',' + margin.top + ')'">
            @for (mark of marks(); track $index) {
              <path [attr.d]="mark.d" [attr.fill]="mark.color" />
            }
          </g>
          <line
            [attr.x1]="margin.left"
            [attr.x2]="width() - margin.right"
            [attr.y1]="margin.top + plotHeight()"
            [attr.y2]="margin.top + plotHeight()"
            [attr.stroke]="ink.axis"
            stroke-width="1"
            shape-rendering="crispEdges"
          />
          @for (label of xLabels(); track label.index) {
            <text
              class="text-[11px]"
              text-anchor="middle"
              [attr.x]="label.x"
              [attr.y]="margin.top + plotHeight() + 16"
              [attr.fill]="ink.muted"
            >
              {{ label.text }}
            </text>
          }
        </svg>

        @if (tooltip(); as tip) {
          <div
            role="status"
            class="chart-tooltip pointer-events-none absolute top-0 z-10 rounded-md border border-control bg-raised px-3 py-2 text-xs shadow-md"
            [style.left.px]="tip.left"
            [style.width.px]="tooltipWidth"
            [attr.data-testid]="testId() + '-tooltip'"
          >
            <p class="mb-1 text-muted">{{ tip.title }}</p>
            @for (row of tip.rows; track row.key) {
              <p class="flex items-center gap-2">
                <span class="inline-block h-0.5 w-3" [style.background]="row.color"></span>
                <span class="font-semibold tabular-nums text-ink">{{ row.value }}</span>
                @if (stacked()) {
                  <span class="text-muted">{{ row.label }}</span>
                }
              </p>
            }
            @if (tip.total !== null) {
              <p class="mt-1 border-t border-divider pt-1 text-muted">
                {{ 'chart.table.total' | t }}:
                <span class="font-semibold tabular-nums text-ink">{{ tip.total }}</span>
              </p>
            }
          </div>
        }
      </div>
    }

    @if (!empty()) {
      <button
        type="button"
        class="chart-table-toggle mt-1 text-xs"
        [attr.data-testid]="testId() + '-table-toggle'"
        (click)="showTable.set(!showTable())"
      >
        {{ (showTable() ? 'chart.table.hide' : 'chart.table.show') | t }}
      </button>
    }
  `,
})
export class ColumnChart {
  /** What the chart shows — its accessible name and its table's caption. */
  readonly name = input.required<string>();
  readonly points = input.required<readonly ChartPoint[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  /** Counts get whole-number ticks only; money does not. */
  readonly integer = input(true);
  readonly formatValue = input<(value: number) => string>(String);
  readonly formatTick = input<(value: number) => string>(String);
  readonly plotHeight = input(160);
  readonly testId = input.required<string>();

  protected readonly margin = MARGIN;
  protected readonly ink = INK;
  protected readonly tooltipWidth = TOOLTIP_WIDTH;

  protected readonly width = signal(640);
  protected readonly hovered = signal<number | null>(null);
  protected readonly showTable = signal(false);

  protected readonly stacked = computed(() => this.series().length > 1);
  protected readonly svgHeight = computed(() => MARGIN.top + this.plotHeight() + MARGIN.bottom);

  private readonly stacks = computed(() =>
    this.points().map((_, index) => this.series().map((series) => series.values[index] ?? 0)),
  );
  protected readonly totals = computed(() =>
    this.stacks().map((stack) => stack.reduce((sum, value) => sum + value, 0)),
  );
  protected readonly empty = computed(() => this.totals().every((total) => total === 0));

  private readonly scale = computed(() =>
    niceScale(Math.max(0, ...this.totals()), { integer: this.integer() }),
  );
  private readonly layout = computed(() =>
    layoutColumns(
      this.stacks(),
      { width: Math.max(0, this.width() - MARGIN.left - MARGIN.right), height: this.plotHeight() },
      this.scale().max,
    ),
  );

  protected readonly ticks = computed(() => {
    const { max, ticks } = this.scale();
    return ticks.map((value) => ({
      value,
      y: MARGIN.top + this.plotHeight() - (value / max) * this.plotHeight(),
      label: this.formatTick()(value),
    }));
  });

  protected readonly marks = computed(() => {
    const { columns, barWidth } = this.layout();
    const series = this.series();
    return columns.flatMap((column) =>
      column.segments.map((segment) => ({
        d: segmentPath(segment, column.x, barWidth),
        color: series[segment.series].color,
      })),
    );
  });

  protected readonly xLabels = computed(() => {
    const { band } = this.layout();
    const points = this.points();
    const edge = MARGIN.left + 16;
    const room = Math.floor((band * points.length) / X_LABEL_SPACING);
    return labelledIndexes(points.length, Math.min(MAX_X_LABELS, Math.max(2, room))).map(
      (index) => ({
        index,
        text: points[index].label,
        x: clamp(MARGIN.left + (index + 0.5) * band, edge, this.width() - 16),
      }),
    );
  });

  protected readonly hoverBand = computed(() => {
    const index = this.hovered();
    const { band } = this.layout();
    return index === null ? null : { x: MARGIN.left + index * band, width: band };
  });

  protected readonly tooltip = computed(() => {
    const index = this.hovered();
    const point = index === null ? undefined : this.points()[index];
    if (index === null || !point) {
      return null;
    }
    const format = this.formatValue();
    const { band } = this.layout();
    const center = MARGIN.left + (index + 0.5) * band;
    // Beside the column, on whichever side has the room: to its right on the left half of the chart,
    // to its left on the right half.
    const flipped = center > this.width() / 2;
    const offset = band / 2 + TOOLTIP_OFFSET;
    return {
      title: point.title,
      // Top of the stack first, the way the column reads.
      rows: this.series()
        .map((series) => ({
          key: series.key,
          label: series.label,
          color: series.color,
          value: format(series.values[index] ?? 0),
        }))
        .reverse(),
      total: this.stacked() ? format(this.totals()[index]) : null,
      left: clamp(
        flipped ? center - offset - TOOLTIP_WIDTH : center + offset,
        0,
        this.width() - TOOLTIP_WIDTH,
      ),
    };
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    // Drawn at the width it is given rather than stretched from a fixed one, so text stays its size.
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => {
        this.width.set(Math.floor(entry.contentRect.width));
      });
      observer.observe(host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** The point under the pointer: the whole slot of a column is its target, not its painted part. */
  protected pointAt(event: PointerEvent): void {
    const { band } = this.layout();
    const left = (event.currentTarget as Element).getBoundingClientRect().left;
    const index = Math.floor((event.clientX - left - MARGIN.left) / band);
    this.hovered.set(band > 0 && index >= 0 && index < this.points().length ? index : null);
  }

  protected step(event: KeyboardEvent): void {
    const last = this.points().length - 1;
    const current = this.hovered() ?? last;
    const next =
      event.key === 'ArrowLeft'
        ? current - 1
        : event.key === 'ArrowRight'
          ? current + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) {
      return;
    }
    event.preventDefault();
    this.hovered.set(clamp(next, 0, last));
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
