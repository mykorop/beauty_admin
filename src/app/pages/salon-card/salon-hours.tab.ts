import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SalonsClient, type SalonDayHours } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { SalonCardStore } from './salon-card.store';

/** Monday first, as every calendar of the region reads; the backend numbers days from Sunday = 0. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** 2024-01-07 was a Sunday, so day `n` of that week names `dayOfWeek = n`. */
const weekdayDate = (dayOfWeek: number): Date => new Date(Date.UTC(2024, 0, 7 + dayOfWeek));

/** Години роботи of the Салон by day of week, read-only. */
@Component({
  selector: 'app-salon-hours-tab',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (week(); as week) {
      <table class="w-full max-w-xl rounded-lg border border-slate-200 bg-white text-sm">
        <tbody>
          @for (day of week; track day.dayOfWeek) {
            <tr class="border-b border-slate-100 last:border-0" data-testid="hours-day">
              <th class="w-48 px-6 py-3 text-left font-medium first-letter:uppercase">{{ day.name }}</th>
              <td class="px-6 py-3">
                @if (!day.hours) {
                  <span class="text-slate-400">{{ 'hours.notSet' | t }}</span>
                } @else if (!day.hours.isOpen || day.hours.slots.length === 0) {
                  <span class="text-slate-500">{{ 'hours.closed' | t }}</span>
                } @else {
                  @for (slot of day.hours.slots; track $index) {
                    <div>{{ slot.start }} – {{ slot.end }}</div>
                  }
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    } @else if (failed()) {
      <p class="text-slate-600" data-testid="hours-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class SalonHoursTab {
  private readonly i18n = inject(I18nService);

  private readonly days = signal<SalonDayHours[] | null>(null);
  protected readonly failed = signal(false);

  protected readonly week = computed(() => {
    const days = this.days();
    if (!days) {
      return null;
    }
    const weekday = new Intl.DateTimeFormat(this.i18n.locale(), { weekday: 'long', timeZone: 'UTC' });
    return WEEK_ORDER.map((dayOfWeek) => ({
      dayOfWeek,
      name: weekday.format(weekdayDate(dayOfWeek)),
      hours: days.find((day) => day.dayOfWeek === dayOfWeek) ?? null,
    }));
  });

  constructor() {
    // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
    const salonId = inject(SalonCardStore).salon()?.salonId;
    if (salonId) {
      inject(SalonsClient)
        .hours(salonId)
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (hours) => this.days.set(hours.days),
          // The interceptor has already worded the refusal as a toast.
          error: () => this.failed.set(true),
        });
    }
  }
}
