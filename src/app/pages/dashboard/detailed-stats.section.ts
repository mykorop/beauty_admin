import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { ProgressBar } from 'primeng/progressbar';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { exhaustMap, type Subscription, takeWhile, timer } from 'rxjs';
import {
  ATTENTION_FLAGS,
  type AppointmentsDay,
  type AttentionFlag,
  type DetailedStats,
  type DetailedStatsState,
  type GrowthDay,
  StatsClient,
  type StatsWindow,
} from '../../core/api/stats.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { formatBuiltAt } from '../../shared/built-at';
import { calendarDayAsUtcDate } from '../../shared/calendar-day';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { formatRating } from '../../shared/rating';
import { formatVenueDate } from '../../shared/venue-date';
import {
  CHART_SERIES_COLORS,
  type ChartPoint,
  type ChartSeries,
  ColumnChart,
} from '../../shared/charts/column-chart';
import {
  appointmentTotals,
  attentionCounts,
  attentionFiltered,
  attentionLink,
  daysFrom,
  lowRatedFeed,
  profileCardLink,
  weeksFrom,
  growthTotals,
  periodStart,
  runProgress,
  STATS_PERIODS,
  type StatsPeriod,
  valueTotals,
} from './detailed-stats-view';

/** How often the dashboard asks how a run is getting on. */
export const DETAILED_STATS_POLL_MS = 2000;

const GROWTH_KINDS = [
  'salons',
  'masters',
  'clients',
] as const satisfies readonly (keyof GrowthDay)[];

/**
 * The stack of the Записи chart, from the baseline up: what happened, then what is still ahead,
 * then what did not happen. Each takes the next colour slot, in this order, always.
 */
const APPOINTMENT_SERIES = [
  'completed',
  'pastBooked',
  'upcoming',
  'noShow',
  'cancelled',
] as const satisfies readonly (keyof AppointmentsDay)[];

const VALUE_SERIES = ['past', 'ahead'] as const;

type GrowthStep = 'day' | 'week';

/**
 * «Детальна статистика» — the lower half of the dashboard: a button that has the backend read the
 * whole table (ADR-0003), a bar that follows it, and the last result — the three charts of growth,
 * Записи and Вартість Записів, the tops, the quality block and «Потребують уваги».
 *
 * The backend works in the background and one run at a time, so this polls until the run ends; a
 * dashboard opened while one is under way picks it up and follows it too. The last result stays on
 * screen, dimmed, while a new one is read, and stays for good if the new one fails. The period and
 * the growth step only slice the result already here — neither asks the backend anything.
 */
@Component({
  selector: 'app-detailed-stats',
  imports: [
    Button,
    ColumnChart,
    FormsModule,
    Message,
    ProgressBar,
    RouterLink,
    SelectButton,
    Tag,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detailed-stats.section.html',
})
export class DetailedStatsSection {
  private readonly client = inject(StatsClient);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<DetailedStatsState | null>(null);
  protected readonly loadFailed = signal(false);
  private readonly starting = signal(false);
  /** Polling is under way. */
  private readonly following = signal(false);
  /** Polling stopped on a refusal — the run may still be reading; a press follows it again. */
  protected readonly followFailed = signal(false);

  protected readonly period = signal<StatsPeriod>('90');
  protected readonly growthStep = signal<GrowthStep>('day');
  /** The «Потребують уваги» filters chosen; none chosen shows everyone. */
  protected readonly attentionChosen = signal<AttentionFlag[]>([]);

  protected readonly run = computed(() => this.state()?.run ?? null);
  protected readonly result = computed(() => this.state()?.result ?? null);
  protected readonly running = computed(() => this.run()?.status === 'running');
  protected readonly busy = computed(() => this.starting() || (this.running() && this.following()));
  protected readonly neverRun = computed(
    () => this.state() !== null && !this.run() && !this.result(),
  );

  protected readonly progress = computed(() => {
    const run = this.run();
    return run && this.running() ? runProgress(run) : null;
  });

  protected readonly progressText = computed(() => {
    const run = this.run();
    if (!run) {
      return '';
    }
    const count = this.formats().count;
    return run.estimatedItems
      ? this.i18n.t('stats.detailed.progress', {
          scanned: count(run.scannedItems),
          estimated: count(run.estimatedItems),
        })
      : this.i18n.t('stats.detailed.progressCount', { scanned: count(run.scannedItems) });
  });

  protected readonly failureKey = computed(() => {
    const run = this.run();
    return run?.status === 'failed'
      ? (`stats.detailed.failed.${run.errorCode ?? 'FAILED'}` as TranslationKey)
      : null;
  });

  protected readonly builtAt = computed(() =>
    formatBuiltAt(this.result()?.builtAt, this.i18n.locale()),
  );

  protected readonly ratesNote = computed(() => {
    const result = this.result();
    if (!result) {
      return null;
    }
    return result.ratesUpdatedAt
      ? this.i18n.t('stats.detailed.rates', {
          date: new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'medium' }).format(
            new Date(result.ratesUpdatedAt),
          ),
        })
      : this.i18n.t('stats.detailed.ratesDefault');
  });

  protected readonly periodOptions = computed(() =>
    STATS_PERIODS.map((value) => ({
      value,
      label: this.i18n.t(`stats.period.${value}` as TranslationKey),
    })),
  );

  protected readonly stepOptions = computed(() =>
    (['day', 'week'] as const).map((value) => ({
      value,
      label: this.i18n.t(`stats.step.${value}` as TranslationKey),
    })),
  );

  /** Everything the formatters of this section depend on is the language, so they follow it. */
  private readonly formats = computed(() => {
    const locale = this.i18n.locale();
    const count = new Intl.NumberFormat(locale);
    const money = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const compact = new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
    const short = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    });
    const long = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const date = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const rating = (value: number | null, reviews: number) =>
      value === null ? '—' : formatRating(locale, value, reviews);
    return {
      count: (value: number) => count.format(value),
      compact: (value: number) => compact.format(value),
      percent: (value: number) => percent.format(value),
      mdl: (value: number) => this.i18n.t('stats.value.amount', { amount: money.format(value) }),
      dayPoint: (day: string): ChartPoint => ({
        key: day,
        label: short.format(calendarDayAsUtcDate(day)),
        title: long.format(calendarDayAsUtcDate(day)),
      }),
      /** A window of calendar days, as one range: «25 серпня – 23 вересня 2026 р.». */
      window: ({ from, to }: StatsWindow) =>
        date.formatRange(calendarDayAsUtcDate(from), calendarDayAsUtcDate(to)),
      /** An instant as the day it fell on in Chișinău — the calendar every figure here is cut on. */
      platformDay: (iso: string | null) => formatVenueDate(iso, locale, PLATFORM_TIME_ZONE),
      rating,
      weekPoint: (monday: string): ChartPoint => ({
        key: monday,
        label: short.format(calendarDayAsUtcDate(monday)),
        title: this.i18n.t('stats.weekOf', { date: date.format(calendarDayAsUtcDate(monday)) }),
      }),
    };
  });

  /** The three charts of the last result, cut to the period. */
  protected readonly view = computed(() => {
    const result = this.result();
    return result ? this.chartsOf(result) : null;
  });

  /**
   * The tops, the quality block and «Потребують уваги» of the last result. They describe the
   * moment it was built over windows of their own, so the period above does not cut them.
   */
  protected readonly standing = computed(() => {
    const result = this.result();
    return result ? this.standingOf(result) : null;
  });

  private followSubscription: Subscription | undefined;

  constructor() {
    this.client
      .detailed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.state.set(state);
          if (state.run?.status === 'running') {
            this.follow();
          }
        },
        // The interceptor has already worded the refusal as a toast.
        error: () => this.loadFailed.set(true),
      });
  }

  /** «Порахувати». While a run is under way the backend answers with that run, and this follows it. */
  protected start(): void {
    this.starting.set(true);
    this.client
      .startDetailed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (run) => {
          this.starting.set(false);
          this.loadFailed.set(false);
          this.state.update((state) => ({ run, result: state?.result ?? null }));
          this.follow();
        },
        error: () => this.starting.set(false),
      });
  }

  private follow(): void {
    this.followSubscription?.unsubscribe();
    this.following.set(true);
    this.followFailed.set(false);
    this.followSubscription = timer(DETAILED_STATS_POLL_MS, DETAILED_STATS_POLL_MS)
      .pipe(
        // A slow answer is waited for rather than cancelled by the next tick.
        exhaustMap(() => this.client.detailed()),
        takeWhile((state) => state.run?.status === 'running', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (state) => this.state.set(state),
        // One toast, not one every two seconds: polling stops, and a press picks the run up again.
        error: () => {
          this.following.set(false);
          this.followFailed.set(true);
        },
        complete: () => this.following.set(false),
      });
  }

  /** The series of a stacked chart: one per key, in its fixed order, each on the next colour slot. */
  private stack<Key extends string>(
    keys: readonly Key[],
    labelPrefix: string,
    days: readonly Record<Key, number>[],
  ): ChartSeries[] {
    return keys.map((key, slot) => ({
      key,
      label: this.i18n.t(`${labelPrefix}.${key}` as TranslationKey),
      color: CHART_SERIES_COLORS[slot],
      values: days.map((day) => day[key]),
    }));
  }

  private chartsOf(result: DetailedStats) {
    const formats = this.formats();
    const start = periodStart(result.today, this.period());
    const weekly = this.growthStep() === 'week';

    const growthDays = weekly
      ? weeksFrom(result.growth.weekly, start)
      : daysFrom(result.growth.daily, start);
    const growthPoints = growthDays.map(({ day }) =>
      weekly ? formats.weekPoint(day) : formats.dayPoint(day),
    );
    // Always the days of the period, whichever step draws them: a week view keeps its first week
    // whole, and «+N за період» must not change because the chart did.
    const growthSums = growthTotals(daysFrom(result.growth.daily, start));
    const growth = GROWTH_KINDS.map((kind) => {
      const label = this.i18n.t(`stats.growth.${kind}` as TranslationKey);
      const series: ChartSeries[] = [
        {
          key: kind,
          label,
          color: CHART_SERIES_COLORS[0],
          values: growthDays.map((day) => day[kind]),
        },
      ];
      return { kind, label, total: formats.count(growthSums[kind]), series };
    });

    const appointmentDays = daysFrom(result.appointments.daily, start);
    const appointmentSums = appointmentTotals(appointmentDays, result.today);
    const appointmentSeries = this.stack(
      APPOINTMENT_SERIES,
      'stats.appointments.series',
      appointmentDays,
    );

    const valueDays = daysFrom(result.value.daily, start);
    const valueSums = valueTotals(valueDays);
    const valueSeries = this.stack(VALUE_SERIES, 'stats.value.series', valueDays);

    return {
      growthPoints,
      growth,
      growthUndated: result.growth.undated,
      appointmentPoints: appointmentDays.map(({ day }) => formats.dayPoint(day)),
      appointmentSeries,
      appointmentTotal: formats.count(appointmentSums.total),
      cancellationShare:
        appointmentSums.cancellationShare === null
          ? '—'
          : formats.percent(appointmentSums.cancellationShare),
      appointmentsUndated: result.appointments.undated,
      valuePoints: valueDays.map(({ day }) => formats.dayPoint(day)),
      valueSeries,
      valuePast: formats.mdl(valueSums.past),
      valueAhead: formats.mdl(valueSums.ahead),
      unconverted: result.value.unconverted,
      formatCount: formats.count,
      formatMdl: formats.mdl,
      formatCompact: formats.compact,
    };
  }

  private standingOf(result: DetailedStats) {
    const formats = this.formats();
    const { tops, quality, attention } = result;
    const counts = attentionCounts(attention.items);

    return {
      topsWindow: formats.window(tops.window),
      tops: [
        {
          key: 'salons',
          titleKey: 'stats.tops.salons' as TranslationKey,
          rows: tops.salons.map((salon) => ({
            key: salon.salonId,
            name: salon.name || salon.salonId,
            city: salon.city,
            appointments: formats.count(salon.appointments),
            link: profileCardLink('salon', salon.salonId) as string[] | null,
          })),
        },
        {
          key: 'independentMasters',
          titleKey: 'stats.tops.independentMasters' as TranslationKey,
          rows: tops.independentMasters.map((master) => ({
            key: master.masterId,
            name: master.name || master.masterId,
            city: master.city,
            appointments: formats.count(master.appointments),
            link: profileCardLink('independentMaster', master.masterId) as string[] | null,
          })),
        },
        {
          key: 'cities',
          titleKey: 'stats.tops.cities' as TranslationKey,
          // A city is not a profile: there is no card to open.
          rows: tops.cities.map((city) => ({
            key: city.cityCode || city.city,
            name: city.city,
            city: '',
            appointments: formats.count(city.appointments),
            link: null as string[] | null,
          })),
        },
      ],
      quality: {
        window: formats.window(quality.window),
        reviews: formats.count(quality.reviews),
        averageRating: formats.rating(quality.averageRating, quality.reviews),
        lowRated: formats.count(quality.lowRated),
        profiles: quality.lowRatedProfiles.map((profile) => ({
          key: `${profile.kind}:${profile.id}`,
          name: profile.name || profile.id,
          kindKey: `stats.quality.kind.${profile.kind}` as TranslationKey,
          lowRated: formats.count(profile.lowRated),
          feed: lowRatedFeed(profile, quality.window),
        })),
      },
      attention: {
        empty: attention.items.length === 0,
        filters: ATTENTION_FLAGS.map((flag) => ({
          value: flag,
          label: this.i18n.t('stats.attention.filter', {
            label: this.i18n.t(`stats.attention.flag.${flag}` as TranslationKey),
            count: formats.count(counts[flag]),
          }),
        })),
        rows: attentionFiltered(attention.items, this.attentionChosen()).map((item) => ({
          key: `${item.kind}:${item.salonId ?? ''}:${item.id}`,
          name: item.name || item.id,
          kindKey: `stats.attention.kind.${item.kind}` as TranslationKey,
          salonName: item.kind === 'salonMaster' ? item.salonName || item.salonId : null,
          city: item.city || '—',
          link: attentionLink(item),
          registered: formats.platformDay(item.createdAt),
          lastAppointment: item.lastAppointmentAt
            ? formats.platformDay(item.lastAppointmentAt)
            : null,
          flags: item.flags.map((flag) => `stats.attention.flag.${flag}` as TranslationKey),
          missing:
            item.gaps.length === 0
              ? null
              : this.i18n.t('stats.attention.missing', {
                  gaps: item.gaps
                    .map((gap) => this.i18n.t(`stats.attention.gap.${gap}` as TranslationKey))
                    .join(', '),
                }),
        })),
      },
    };
  }
}
