import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Tag } from 'primeng/tag';
import { catchError, EMPTY, Subject, switchMap, tap } from 'rxjs';
import {
  APPOINTMENT_STATUS_SEVERITY,
  AppointmentsClient,
  type AppointmentDetails,
  type VenueAppointment,
} from '../../core/api/appointments.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { AppointmentDetailsPanel } from '../../shared/appointments/appointment-details';
import { isStaleBooking } from '../../shared/appointments/appointment-filters';
import { appointmentRowPatch } from '../../shared/appointments/appointment-row';
import { appointmentStatusLabel, formatPrice } from '../../shared/appointments/appointment-wording';
import { formatVenueDateTime } from '../../shared/venue-date';

/**
 * The rows of the наскрізний список — whichever read produced them, a narrowed window or a
 * gathered day — each opening into the whole Запис with the actions over it.
 *
 * Every row carries its own venue and its own clock: the list spans venues, so there is no one
 * clock to print the page on, and an hour is printed as both sides of that Запис remember it.
 *
 * What an action changes is absorbed into the row it came from rather than re-read, exactly as on a
 * card's Записи tab: a Запис just cancelled under a «заброньовано» filter stays under the card still
 * showing it instead of vanishing. A new list — another window, another day, a new gathering —
 * starts from what it says.
 */
@Component({
  selector: 'app-platform-appointments-table',
  imports: [AppointmentDetailsPanel, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full max-w-7xl rounded-lg border border-slate-200 bg-white text-left text-sm">
        <thead class="text-xs text-slate-500">
          <tr class="border-b border-slate-200">
            <th class="w-10 px-3 py-3"></th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.when' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'client.appointments.column.venue' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.client' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.master' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.services' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.price' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.status' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.appointment.appointmentId) {
            <tr
              class="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              data-testid="appointment-row"
              [class.bg-amber-50]="row.stale"
              (click)="toggle(row.appointment)"
            >
              <td class="px-3 py-3">
                <button
                  type="button"
                  class="pi text-slate-500"
                  data-testid="appointment-row-toggle"
                  [class.pi-chevron-right]="!isOpen(row.appointment)"
                  [class.pi-chevron-down]="isOpen(row.appointment)"
                  [attr.aria-expanded]="isOpen(row.appointment)"
                  [attr.aria-label]="'appointments.details.open' | t"
                ></button>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span data-testid="appointment-row-when">{{ row.when }}</span>
                <p class="text-xs text-slate-500" data-testid="appointment-row-timezone">
                  {{ row.appointment.timezone }}
                </p>
                @if (row.stale) {
                  <p class="text-xs text-amber-700" data-testid="appointment-row-stale">
                    {{ 'appointments.stale' | t }}
                  </p>
                }
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-venue">
                {{ row.appointment.venueName || '—' }}
                @if (!row.appointment.salonId) {
                  <p class="text-xs text-slate-500">{{ 'appointments.details.independent' | t }}</p>
                }
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-client">
                {{ row.appointment.clientName || '—' }}
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-master">
                {{ row.appointment.masterName || '—' }}
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-services">
                {{ row.services }}
                @if (row.appointment.isManual) {
                  <p-tag
                    class="ml-2"
                    severity="warn"
                    data-testid="appointment-row-manual"
                    [value]="'appointments.manual' | t"
                  />
                }
              </td>
              <td class="px-4 py-3 whitespace-nowrap" data-testid="appointment-row-price">
                {{ row.price }} {{ row.appointment.currency }}
              </td>
              <td class="px-4 py-3">
                <p-tag
                  data-testid="appointment-row-status"
                  [severity]="row.statusSeverity"
                  [value]="row.status"
                />
              </td>
            </tr>
            @if (isOpen(row.appointment)) {
              <tr
                class="border-b border-slate-100 bg-slate-50/50"
                data-testid="appointment-details"
              >
                <td></td>
                <td class="px-4 py-4" colspan="7">
                  @if (details(); as details) {
                    <app-appointment-details [details]="details" (changed)="absorb($event)" />
                  } @else if (detailsFailed()) {
                    <p class="text-slate-600" data-testid="appointment-details-failed">
                      {{ 'card.failed' | t }}
                    </p>
                  } @else {
                    <p class="text-slate-500" data-testid="appointment-details-loading">
                      {{ 'appointments.details.loading' | t }}
                    </p>
                  }
                </td>
              </tr>
            }
          } @empty {
            <tr>
              <td
                colspan="8"
                class="py-8 text-center text-slate-600"
                data-testid="appointments-empty"
              >
                {{ emptyKey() | t }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="mt-2 max-w-6xl text-xs text-slate-500" data-testid="appointments-readonly">
      {{ 'appointments.readonly' | t }}
    </p>
  `,
})
export class PlatformAppointmentsTable {
  readonly appointments = input.required<VenueAppointment[]>();
  /** What an empty list says — «за цей період» or «цього дня». */
  readonly emptyKey = input<TranslationKey>('appointments.empty');

  private readonly client = inject(AppointmentsClient);
  private readonly i18n = inject(I18nService);

  /** The rows as shown: the list handed in, with whatever the actions since have changed in it. */
  private readonly shown = linkedSignal(() => this.appointments());

  /** The Запис whose card is open, or `null`; a new list closes it. Every change goes through `opened`. */
  private readonly openId = linkedSignal<VenueAppointment[], string | null>({
    source: this.appointments,
    computation: () => null,
  });
  private readonly opened = new Subject<string | null>();
  protected readonly details = signal<AppointmentDetails | null>(null);
  protected readonly detailsFailed = signal(false);

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    const money = new Intl.NumberFormat(locale);
    const now = new Date();
    return this.shown().map((appointment) => ({
      appointment,
      // Each row on the clock its own Запис was booked under: this list spans venues.
      when: formatVenueDateTime(appointment.startTime, locale, appointment.timezone),
      services: appointment.serviceNames.join(', ') || '—',
      price: formatPrice(money, appointment.totalPrice),
      status: appointmentStatusLabel(this.i18n, appointment.status),
      statusSeverity: APPOINTMENT_STATUS_SEVERITY[appointment.status] ?? 'secondary',
      // A Запис still «заброньовано» whose time has passed: nobody closed it.
      stale: isStaleBooking(appointment, now),
    }));
  });

  constructor() {
    // One card at a time: opening another drops the request for the last one, so a slow answer
    // cannot land under the row that replaced it.
    this.opened
      .pipe(
        tap(() => {
          this.details.set(null);
          this.detailsFailed.set(false);
        }),
        switchMap((appointmentId) =>
          appointmentId === null
            ? EMPTY
            : this.client
                .details(appointmentId)
                // Including a Запис that has since vanished: the row says so instead of a toast.
                .pipe(catchError(() => (this.detailsFailed.set(true), EMPTY))),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((details) => this.details.set(details));
  }

  protected isOpen(appointment: VenueAppointment): boolean {
    return this.openId() === appointment.appointmentId;
  }

  protected toggle(appointment: VenueAppointment): void {
    const next = this.isOpen(appointment) ? null : appointment.appointmentId;
    this.openId.set(next);
    this.opened.next(next);
  }

  /** A Запис an action just changed: the backend answers with the whole of it. */
  protected absorb(details: AppointmentDetails): void {
    this.details.set(details);
    this.shown.update((rows) =>
      rows.map((row) =>
        row.appointmentId === details.appointmentId
          ? { ...row, ...appointmentRowPatch(details) }
          : row,
      ),
    );
  }
}
