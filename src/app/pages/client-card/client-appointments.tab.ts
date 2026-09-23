import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { catchError, EMPTY, exhaustMap, startWith, Subject, switchMap } from 'rxjs';
import {
  APPOINTMENT_STATUS_SEVERITY,
  APPOINTMENT_STATUSES,
  AppointmentsClient,
  type AppointmentDetails,
  type AppointmentStatus,
  type VenueAppointment,
} from '../../core/api/appointments.client';
import { ClientsClient } from '../../core/api/clients.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { AppointmentDetailsPanel } from '../../shared/appointments/appointment-details';
import { appointmentRowPatch } from '../../shared/appointments/appointment-interaction';
import { appointmentStatusLabel, formatPrice } from '../../shared/appointments/appointment-wording';
import { isStaleBooking } from '../../shared/appointments/appointment-filters';
import { formatVenueDateTime } from '../../shared/venue-date';
import { ClientCardStore } from './client-card.store';

/**
 * Записи of one Клієнт — everywhere he has ever booked, newest first, each row opening into the
 * whole Запис.
 *
 * It is **not** the shared Записи tab of a card, and the difference is the point. That one asks for
 * a window of one venue's calendar and prints every row on that venue's clock; this feed spans
 * places, so there is no one clock for the page and the venue travels on the row. It is also not
 * cut by dates at all: a person's own history is already the bound, and the backend's sort key
 * means two different moments depending on whether a Запис is still open — so the feed pages by
 * cursor and «показати давніші» is how it is read further.
 *
 * A Запис is never **made** here, and the actions over one are the Запис's own card, exactly as on
 * a Салон's tab: what comes back from an action is absorbed into the row it came from.
 */
@Component({
  selector: 'app-client-appointments-tab',
  imports: [AppointmentDetailsPanel, ButtonDirective, FormsModule, Select, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="appointment-filters mb-4 flex flex-wrap items-end gap-3">
      <p-select
        data-testid="appointments-filter-status"
        class="w-52"
        optionLabel="label"
        optionValue="value"
        [options]="statusOptions()"
        [showClear]="true"
        [placeholder]="'appointments.filter.status' | t"
        [ariaLabel]="'appointments.filter.status' | t"
        [ngModel]="status()"
        (ngModelChange)="setStatus($event)"
      />
    </div>

    @if (rows(); as rows) {
      <div class="profile-table-scroll" tabindex="0" role="region" [attr.aria-label]="'nav.appointments' | t"><table class="profile-data-table appointments-table">
        <thead class="text-xs text-muted">
          <tr class="border-b border-divider">
            <th class="w-10 px-3 py-3"></th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.when' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'client.appointments.column.venue' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.master' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.services' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.price' | t }}</th>
            <th class="px-4 py-3 font-normal">{{ 'appointments.column.status' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track row.appointment.appointmentId) {
            <tr
              class="cursor-pointer border-b border-divider last:border-0 hover:bg-raised"
              data-testid="appointment-row"
              [class.appointment-stale]="row.stale"
              (click)="toggle(row.appointment)"
            >
              <td class="px-3 py-3">
                <button
                  type="button"
                  class="appointment-toggle pi text-muted"
                  data-testid="appointment-row-toggle"
                  [class.pi-chevron-right]="!isOpen(row.appointment)"
                  [class.pi-chevron-down]="isOpen(row.appointment)"
                  [attr.aria-expanded]="isOpen(row.appointment)"
                  [attr.aria-label]="'appointments.details.open' | t"
                ></button>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span data-testid="appointment-row-when">{{ row.when }}</span>
                <p class="text-xs text-muted" data-testid="appointment-row-timezone">{{ row.timezone }}</p>
                @if (row.stale) {
                  <p class="text-xs text-warning whitespace-normal" data-testid="appointment-row-stale">
                    {{ 'appointments.stale' | t }}
                  </p>
                }
              </td>
              <td class="px-4 py-3" data-testid="appointment-row-venue">{{ row.appointment.venueName || '—' }}</td>
              <td class="px-4 py-3" data-testid="appointment-row-master">{{ row.appointment.masterName || '—' }}</td>
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
                <p-tag data-testid="appointment-row-status" [severity]="row.statusSeverity" [value]="row.status" />
              </td>
            </tr>
            @if (isOpen(row.appointment)) {
              <tr class="border-b border-divider bg-raised" data-testid="appointment-details">
                <td></td>
                <td class="px-4 py-4" colspan="6">
                  @if (details(); as details) {
                    <app-appointment-details [details]="details" (changed)="absorb($event)" />
                  } @else if (detailsFailed()) {
                    <p class="text-muted" data-testid="appointment-details-failed">{{ 'card.failed' | t }}</p>
                  } @else {
                    <p class="text-muted" data-testid="appointment-details-loading">
                      {{ 'appointments.details.loading' | t }}
                    </p>
                  }
                </td>
              </tr>
            }
          } @empty {
            <tr>
              <td colspan="7" class="py-8 text-center text-muted" data-testid="appointments-empty">
                {{ 'appointments.empty' | t }}
              </td>
            </tr>
          }
        </tbody>
      </table></div>
      <p class="mt-2 max-w-6xl text-xs text-muted" data-testid="appointments-readonly">
        {{ 'appointments.readonly' | t }}
      </p>
      @if (nextCursor()) {
        <div class="mt-3">
          <button
            pButton
            type="button"
            severity="secondary"
            size="small"
            data-testid="appointments-more"
            [label]="'history.more' | t"
            [loading]="loading()"
            (click)="more.next()"
          ></button>
        </div>
      }
    } @else if (failed()) {
      <p class="text-muted" data-testid="appointments-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class ClientAppointmentsTab implements OnInit {
  private readonly clients = inject(ClientsClient);
  private readonly appointments = inject(AppointmentsClient);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  // The card renders its tabs only once the client is loaded, and rebuilds them for another one.
  private readonly clientId = inject(ClientCardStore).client()?.clientId ?? '';

  /** The one narrowing this feed offers; kept in the component, since the feed has no window. */
  protected readonly status = signal<AppointmentStatus | null>(null);
  private readonly asked = new Subject<AppointmentStatus | null>();

  private readonly items = signal<VenueAppointment[] | null>(null);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly more = new Subject<void>();

  /** The Запис whose card is open, or `null`; every change goes through `opened`. */
  private readonly openId = signal<string | null>(null);
  private readonly opened = new Subject<string | null>();
  protected readonly details = signal<AppointmentDetails | null>(null);
  protected readonly detailsFailed = signal(false);

  protected readonly statusOptions = computed(() =>
    APPOINTMENT_STATUSES.map((value) => ({ value, label: this.i18n.t(`appointments.status.${value}`) })),
  );

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    const money = new Intl.NumberFormat(locale);
    const now = new Date();
    return (
      this.items()?.map((appointment) => ({
        appointment,
        // Each row on the clock its own Запис was booked under: this feed spans venues.
        when: formatVenueDateTime(appointment.startTime, locale, appointment.timezone),
        timezone: appointment.timezone,
        services: appointment.serviceNames.join(', ') || '—',
        price: formatPrice(money, appointment.totalPrice),
        status: appointmentStatusLabel(this.i18n, appointment.status),
        statusSeverity: APPOINTMENT_STATUS_SEVERITY[appointment.status] ?? 'secondary',
        // A Запис still «заброньовано» whose time has passed: nobody closed it.
        stale: isStaleBooking(appointment, now),
      })) ?? null
    );
  });

  // Not the constructor: the store is read after the card has filled it.
  ngOnInit(): void {
    // One card at a time: opening another drops the request for the last one, so a slow answer
    // cannot land under the row that replaced it.
    this.opened
      .pipe(
        switchMap((appointmentId) => {
          this.details.set(null);
          this.detailsFailed.set(false);
          return appointmentId === null
            ? EMPTY
            : this.appointments
                .details(appointmentId)
                // Including a Запис that has since vanished: the row says so instead of a toast.
                .pipe(catchError(() => (this.detailsFailed.set(true), EMPTY)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((details) => this.details.set(details));

    this.asked
      .pipe(
        startWith(null),
        // A new filter starts the feed over; the answer to the old one is dropped.
        switchMap((status) => {
          this.items.set(null);
          this.nextCursor.set(null);
          this.close();
          return this.more.pipe(
            startWith(undefined),
            exhaustMap(() => {
              this.loading.set(true);
              this.failed.set(false);
              return this.clients
                .appointments(this.clientId, { status, cursor: this.nextCursor() ?? undefined })
                // The interceptor has already worded the refusal as a toast; rows already shown stay.
                .pipe(
                  catchError(() => {
                    this.failed.set(true);
                    this.loading.set(false);
                    return EMPTY;
                  }),
                );
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.items.update((shown) => [...(shown ?? []), ...page.items]);
        this.nextCursor.set(page.nextCursor);
        this.loading.set(false);
      });
  }

  protected setStatus(status: AppointmentStatus | null): void {
    this.status.set(status);
    this.asked.next(status);
  }

  protected isOpen(appointment: VenueAppointment): boolean {
    return this.openId() === appointment.appointmentId;
  }

  protected toggle(appointment: VenueAppointment): void {
    const next = this.isOpen(appointment) ? null : appointment.appointmentId;
    this.openId.set(next);
    this.opened.next(next);
  }

  /**
   * A Запис an action just changed. The backend answers with the whole row, so the table redraws
   * from that rather than re-reading the feed — a re-read under a status filter would drop the row
   * from under the card still showing it.
   */
  protected absorb(details: AppointmentDetails): void {
    this.details.set(details);
    this.items.update(
      (rows) =>
        rows?.map((row) =>
          row.appointmentId === details.appointmentId ? { ...row, ...appointmentRowPatch(details) } : row,
        ) ?? rows,
    );
  }

  private close(): void {
    this.openId.set(null);
    this.opened.next(null);
  }
}
