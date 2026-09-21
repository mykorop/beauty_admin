import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SalonsClient, type SalonDayHours } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ButtonDirective } from 'primeng/button';
import { SalonCardStore } from './salon-card.store';
import { WEEK_ORDER, weekdayName } from '../../shared/weekday';
import { WeekHoursEditor, type WeekHoursSaveRequest } from '../../shared/working-schedule/week-hours.editor';

/** Години роботи of the Салон by day of week: read first, edited on demand — never a Видалений one. */
@Component({
  selector: 'app-salon-hours-tab',
  imports: [ButtonDirective, WeekHoursEditor, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editing() && days(); as stored) {
      <app-week-hours-editor [stored]="stored" [save]="save" (saved)="days.set($event)" (closed)="editing.set(false)" />
    } @else if (week(); as week) {
      @if (salon()?.status !== 'deleted') {
        <div class="mb-3 flex max-w-xl justify-end">
          <button
            pButton
            type="button"
            size="small"
            icon="pi pi-pencil"
            data-testid="hours-edit"
            [label]="'hours.edit.open' | t"
            (click)="editing.set(true)"
          ></button>
        </div>
      }
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
  private readonly client = inject(SalonsClient);

  protected readonly salon = inject(SalonCardStore).salon.asReadonly();
  protected readonly days = signal<SalonDayHours[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly editing = signal(false);

  protected readonly save = (request: WeekHoursSaveRequest) =>
    this.client.updateHours(this.salon()!.salonId, request).pipe(map((hours) => hours.days));

  protected readonly week = computed(() => {
    const days = this.days();
    if (!days) {
      return null;
    }
    const locale = this.i18n.locale();
    return WEEK_ORDER.map((dayOfWeek) => ({
      dayOfWeek,
      name: weekdayName(locale, dayOfWeek),
      hours: days.find((day) => day.dayOfWeek === dayOfWeek) ?? null,
    }));
  });

  constructor() {
    // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
    const salonId = this.salon()?.salonId;
    if (salonId) {
      this.client
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
